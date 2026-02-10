import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AgentsService } from '../agents/agents.service';
import { TransactionsService } from '../transactions/transactions.service';
import { AgentDecisionService } from '../decision/decision.service';
import { EconomyService } from '../economy/economy.service';

@Injectable()
export class TickService {
  private readonly logger = new Logger(TickService.name);
  private currentTick = 0;
  private isProcessingTick = false;

  constructor(
    private agentsService: AgentsService,
    private transactionsService: TransactionsService,
    private decisionService: AgentDecisionService,
    private economyService: EconomyService,
  ) {}

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
    this.currentTick++;
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
