import { Injectable } from '@nestjs/common';
import { ChatService } from '../chat/chat.service';
import type { DecisionResult } from '../chat/chat.service';
import { Agent } from '../agents/agent.entity';
import { AgentsService } from '../agents/agents.service';
import { AgentIdentity } from '../agents/agent.entity';
import type { SystemStats } from '../economy/economy.service';
import { EconomyService } from '../economy/economy.service';

@Injectable()
export class AgentDecisionService {
  constructor(
    private chatService: ChatService,
    private agentsService: AgentsService,
    private economyService: EconomyService,
  ) {}

  async processRegularThinking(
    agent: Agent,
    tickNumber: number,
  ): Promise<void> {
    const interests = agent.interestTags ? agent.interestTags.join(',') : '';

    const prompt = `你是一个在模拟制造业系统中的AI Agent，当前身份是${agent.identity}，你需要根据当前状态和个人兴趣标签决定是否继续当前身份。当前状态：收入${agent.currentIncome}元，工作时长${agent.workingHours}小时，当前tick：${tickNumber}。兴趣标签：${interests}。`;

    const decision: DecisionResult = await this.chatService.sendChat(
      agent.id,
      prompt,
    );

    if (decision && decision.continue === false) {
      // 处理“退出/躺平”的逻辑；如果尚未躺平则默认设为 layflat。
      if (agent.identity !== AgentIdentity.LAYFLAT) {
        await this.agentsService.update(agent.id, {
          identity: AgentIdentity.LAYFLAT,
        });
      }
    }
  }

  async processIdentityThinking(
    agent: Agent,
    tickNumber: number,
    systemStats: SystemStats,
  ): Promise<void> {
    const interests = agent.interestTags ? agent.interestTags.join(',') : '';
    const tickCoverage = this.calcTickCoverageFromAssets(
      Number(agent.currentIncome),
    );
    const ecoStatus = `资产能覆盖${tickCoverage}个tick`;

    const prompt = `你是一个需要选择未来24tick身份的AI Agent，根据你的兴趣标签和当前系统状态，选择最适合的身份。系统统计：总Agent数${systemStats.total_agents}，工人比例${systemStats.worker_ratio}，中介比例${systemStats.broker_ratio}，躺平者比例${systemStats.layflat_ratio}。经济状态：${ecoStatus}。兴趣标签：${interests}。当前tick：${tickNumber}。`;

    const decision: DecisionResult = await this.chatService.sendChat(
      agent.id,
      prompt,
    );

    if (decision && decision.next_identity) {
      const newIdentity =
        decision.next_identity === 'worker'
          ? AgentIdentity.WORKER
          : decision.next_identity === 'broker'
            ? AgentIdentity.BROKER
            : AgentIdentity.LAYFLAT;

      if (
        newIdentity === AgentIdentity.WORKER ||
        newIdentity === AgentIdentity.BROKER ||
        newIdentity === AgentIdentity.LAYFLAT
      ) {
        await this.agentsService.update(agent.id, {
          identity: newIdentity,
        });
        // TODO：记录身份历史。
      }
    }
  }

  private calcTickCoverageFromAssets(totalAssets: number): number {
    const livingCosts = this.economyService.getLivingCosts(AgentIdentity.LAYFLAT);
    const costPerTick = Object.values(livingCosts).reduce((sum, v) => {
      const n = typeof v === 'number' ? v : Number(v);
      return Number.isFinite(n) ? sum + n : sum;
    }, 0);

    if (!Number.isFinite(totalAssets)) return 0;
    if (!Number.isFinite(costPerTick) || costPerTick <= 0) return 0;
    const n = Math.floor(totalAssets / costPerTick);
    return n > 0 ? n : 0;
  }
}
