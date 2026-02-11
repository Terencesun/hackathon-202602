import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AgentsService } from '../agents/agents.service';
import { TransactionsService } from '../transactions/transactions.service';
import { AgentDecisionService } from '../decision/decision.service';
import { EconomyService } from '../economy/economy.service';
import { AgentIdentity } from '../agents/agent.entity';
import { SUPABASE_CLIENT } from '../supabase/supabase.constants';
import { throwIfSupabaseError } from '../supabase/supabase.errors';

type SystemRow = {
  tickNum: number | string | null;
};

@Injectable()
export class TickService {
  private readonly logger = new Logger(TickService.name);
  private currentTick = 0;
  private isProcessingTick = false;

  constructor(
    @Inject(SUPABASE_CLIENT)
    private readonly supabase: SupabaseClient,
    private agentsService: AgentsService,
    private transactionsService: TransactionsService,
    private decisionService: AgentDecisionService,
    private economyService: EconomyService,
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

  async processTick() {
    this.currentTick = await this.incTick();
    this.logger.log(`Processing Tick ${this.currentTick}`);

    const agents = await this.agentsService.getActiveAgents();
    const systemStats = await this.economyService.getSystemStats();

    for (const agent of agents) {
      try {
        // 1. 扣除生活成本。
        const costs = this.economyService.getLivingCosts(agent.identity);
        for (const [type, amount] of Object.entries(costs)) {
          await this.transactionsService.createTransaction(
            agent.id,
            type + '_cost',
            -Number(amount),
            `Tick ${this.currentTick} Cost`,
            this.currentTick,
          );
        }

        if (agent.identity === AgentIdentity.BROKER) {
          await this.decisionService.processInviteBind(agent, this.currentTick);
        }

        // 2. 决策逻辑。
        if (this.currentTick % 24 === 0) {
          // 身份决策
          await this.decisionService.processIdentityThinking(
            agent,
            this.currentTick,
            systemStats,
          );
        } else {
          // 普通决策
          await this.decisionService.processRegularThinking(
            agent,
            this.currentTick,
          );
        }

        // 更新 Agent 的 tick。
        await this.agentsService.update(agent.id, {
          currentTick: this.currentTick,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.error(`Error processing agent ${agent.id}: ${msg}`);
      }
    }
  }
}
