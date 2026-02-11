import { Injectable } from '@nestjs/common';
import { ChatService } from '../chat/chat.service';
import type { DecisionResult } from '../chat/chat.service';
import { Agent } from '../agents/agent.entity';
import { AgentsService } from '../agents/agents.service';
import { AgentIdentity } from '../agents/agent.entity';
import type { SystemStats } from '../economy/economy.service';
import { EconomyService } from '../economy/economy.service';
import { BrokerBindingsService } from '../broker-bindings/broker-bindings.service';

@Injectable()
export class AgentDecisionService {
  constructor(
    private chatService: ChatService,
    private agentsService: AgentsService,
    private economyService: EconomyService,
    private brokerBindingsService: BrokerBindingsService,
  ) {}

  async processRoleChange(
    agentId: string,
    oldRole: AgentIdentity,
    newRole: AgentIdentity,
  ): Promise<void> {
    if (oldRole === newRole) return;

    if (
      oldRole === AgentIdentity.WORKER &&
      (newRole === AgentIdentity.BROKER || newRole === AgentIdentity.LAYFLAT)
    ) {
      await this.brokerBindingsService.removeRelFromWorker(agentId);
    }

    if (
      oldRole === AgentIdentity.BROKER &&
      (newRole === AgentIdentity.WORKER || newRole === AgentIdentity.LAYFLAT)
    ) {
      await this.brokerBindingsService.removeRelFromBroker(agentId);
    }
  }

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

  async processInviteBind(agent: Agent, tickNumber: number): Promise<void> {
    if (agent.identity !== AgentIdentity.BROKER) return;

    const candidates = await this.agentsService.getLatestActiveLayflatAgents(5);

    for (const target of candidates) {
      if (target.id === agent.id) continue;

      const existingBinding =
        await this.brokerBindingsService.findLatestByWorkerAgentId(target.id);
      if (existingBinding) continue;

      const tickCoverage = this.calcTickCoverageFromAssets(
        Number(target.currentIncome),
      );
      const ecoStatus = `资产能覆盖${tickCoverage}个tick`;

      const targetInterests = target.interestTags ? target.interestTags.join(',') : '';
      const prompt = `你是一个在模拟制造业系统中的AI Agent。你收到来自中介（broker）${agent.id}的打工邀请，决定是否接受邀请并与其建立绑定关系。你的当前状态：收入${target.currentIncome}元，兴趣标签：${targetInterests}，经济状态：${ecoStatus}。决定是否接受邀请。`;

      let decision: DecisionResult = { accept: false, reason: 'default reject' };
      try {
        decision = await this.chatService.sendChat(target.id, prompt);
      } catch {
        decision = { accept: false, reason: 'chat fail' };
      }

      if (decision?.accept !== true || decision?.error) continue;

      const inserted = await this.brokerBindingsService.createBinding({
        brokerAgentId: agent.id,
        workerAgentId: target.id,
        decisionReason: decision.reason ?? null,
      });
      if (!inserted) continue;

      await this.agentsService.update(target.id, {
        identity: AgentIdentity.WORKER,
      });
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
