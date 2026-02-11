import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AgentsService } from '../agents/agents.service';
import { TransactionsService } from '../transactions/transactions.service';
import { AgentDecisionService } from '../decision/decision.service';
import { EconomyService, type SystemStats } from '../economy/economy.service';
import {
  IncomeService,
  type AgentIncomeIdentity,
} from '../economy/income.service';
import { Agent, AgentIdentity } from '../agents/agent.entity';
import { BrokerBindingsService } from '../broker-bindings/broker-bindings.service';
import { SUPABASE_CLIENT } from '../supabase/supabase.constants';
import { throwIfSupabaseError } from '../supabase/supabase.errors';
import { from, of, lastValueFrom } from 'rxjs';
import { mergeMap, catchError, map } from 'rxjs/operators';

type SystemRow = {
  tickNum: number | string | null;
};

@Injectable()
export class TickService {
  private readonly logger = new Logger(TickService.name);
  private currentTick = 0;
  private isProcessingTick = false;
  private readonly brokerBindingCommissionTicks = 24 * 30;
  private readonly brokerBindingCommissionRate = 0.1;

  constructor(
    @Inject(SUPABASE_CLIENT)
    private readonly supabase: SupabaseClient,
    private agentsService: AgentsService,
    private transactionsService: TransactionsService,
    private decisionService: AgentDecisionService,
    private economyService: EconomyService,
    private incomeService: IncomeService,
    private brokerBindingsService: BrokerBindingsService,
  ) {}

  private async ensureSystemRowExists(): Promise<void> {
    const res = await this.supabase.from('system').select('tickNum').limit(1);
    throwIfSupabaseError(res.error, 'system.ensureSystemRowExists.select');
    if ((res.data ?? []).length > 0) return;

    const ins = await this.supabase.from('system').insert({ tickNum: 0 });
    if (ins.error) {
      const anyErr = ins.error as { code?: string };
      if (anyErr?.code === '23505') return;
      throwIfSupabaseError(ins.error, 'system.ensureSystemRowExists.insert');
    }
  }

  async getTick(): Promise<number> {
    await this.ensureSystemRowExists();
    const res = await this.supabase
      .from('system')
      .select('tickNum')
      .limit(1)
      .maybeSingle();
    throwIfSupabaseError(res.error, 'system.getTick');
    const row = res.data as SystemRow | null;
    return Number(row?.tickNum ?? 0);
  }

  async incTick(): Promise<number> {
    await this.ensureSystemRowExists();

    for (let attempt = 0; attempt < 5; attempt++) {
      const current = await this.getTick();
      const next = current + 1;
      const res = await this.supabase
        .from('system')
        .update({ tickNum: next })
        .eq('tickNum', current)
        .select('tickNum')
        .maybeSingle();
      throwIfSupabaseError(res.error, 'system.incTick');
      const row = res.data as SystemRow | null;
      if (row) return Number(row.tickNum ?? next);
    }

    const current = await this.getTick();
    const next = current + 1;
    const res = await this.supabase
      .from('system')
      .update({ tickNum: next })
      .select('tickNum')
      .maybeSingle();
    throwIfSupabaseError(res.error, 'system.incTick.fallback');
    const row = res.data as SystemRow | null;
    return Number(row?.tickNum ?? next);
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async handleTickCron() {
    if (process.env.NODE_ENV === 'test') return;
    if (this.isProcessingTick) return;

    this.isProcessingTick = true;
    try {
      await this.processTick();
    } finally {
      this.isProcessingTick = false;
    }
  }

  private async processTickHandle(
    agent: Agent,
    totalAgents: number,
    currentWorkers: number,
    systemStats: SystemStats,
  ): Promise<void> {
    const oldRole = agent.identity;
    const costs = this.economyService.getLivingCosts(agent.identity);
    for (const [type, amount] of Object.entries(costs)) {
      await this.transactionsService.createTransaction(
        agent.id,
        type + '_cost',
        -Number(amount),
        `生活成本`,
        this.currentTick,
      );
    }

    let brokerBinding =
      agent.identity === AgentIdentity.WORKER
        ? await this.brokerBindingsService.findLatestByWorkerAgentId(agent.id)
        : null;
    if (brokerBinding) {
      const startTick = brokerBinding.startTick;
      if (
        startTick !== null &&
        Number.isFinite(startTick) &&
        this.currentTick - startTick >= this.brokerBindingCommissionTicks
      ) {
        await this.brokerBindingsService.removeRelFromWorker(agent.id);
        brokerBinding = null;
      }
    }

    const incomeItems = this.incomeService.applyIncom({
      identity: agent.identity as unknown as AgentIncomeIdentity,
      totalAgents,
      currentWorkers,
      workHours: agent.workingHours,
      currentTick: this.currentTick,
      invitesInCurrentDay: 0,
      successfulDirectInviteeFirstMonthWages: [],
    });

    if (brokerBinding) {
      const startTick = brokerBinding.startTick;
      const elapsedTicks =
        startTick !== null && Number.isFinite(startTick)
          ? this.currentTick - startTick
          : null;
      if (
        elapsedTicks !== null &&
        elapsedTicks >= 0 &&
        elapsedTicks < this.brokerBindingCommissionTicks
      ) {
        const wage = incomeItems.find(
          (i) => i.type === 'worker_income',
        )?.amount;
        const safeWage = Number.isFinite(wage) ? Number(wage) : 0;
        const commission = Number(
          (Math.max(0, safeWage) * this.brokerBindingCommissionRate).toFixed(2),
        );
        if (commission > 0) {
          await this.transactionsService.createTransaction(
            agent.id,
            'worker_cost_broker_commission',
            -commission,
            '中介抽成',
            this.currentTick,
          );
          await this.transactionsService.createTransaction(
            brokerBinding.brokerAgentId,
            'broker_income_worker_commission',
            commission,
            '工人佣金抽成',
            this.currentTick,
          );
        }
      }
    }

    for (const item of incomeItems) {
      if (item.amount === 0) continue;
      await this.transactionsService.createTransaction(
        agent.id,
        item.type,
        item.amount,
        item.reason,
        this.currentTick,
      );
    }

    if (agent.identity === AgentIdentity.BROKER) {
      await this.decisionService.processInviteBind(agent, this.currentTick);
    }

    await this.decisionService.processRegularThinking(agent, systemStats);

    const latestAgent = await this.agentsService.findOne(agent.id);
    if (latestAgent && latestAgent.identity) {
      await this.decisionService.processRoleChange(
        agent.id,
        oldRole,
        latestAgent.identity,
      );
    }

    await this.agentsService.update(agent.id, {
      currentTick: this.currentTick,
    });
  }

  async processTick() {
    this.currentTick = await this.incTick();
    this.logger.log(`Processing Tick ${this.currentTick}`);

    const agents = await this.agentsService.getActiveAgents();
    const systemStats = await this.economyService.getSystemStats();
    const totalAgents = agents.length;
    const currentWorkers = agents.filter(
      (a) => a.identity === AgentIdentity.WORKER,
    ).length;

    if (agents.length === 0) return;

    const concurrency = Math.max(1, Number(process.env.TICK_CONCURRENCY ?? 4));
    await lastValueFrom(
      from(agents).pipe(
        mergeMap(
          (agent) =>
            from(
              this.processTickHandle(
                agent,
                totalAgents,
                currentWorkers,
                systemStats,
              ),
            ).pipe(
              map(() => null),
              catchError((e) => {
                const msg = e instanceof Error ? e.message : String(e);
                this.logger.error(`Error processing agent ${agent.id}: ${msg}`);
                return of(null);
              }),
            ),
          concurrency,
        ),
      ),
    );
  }
}
