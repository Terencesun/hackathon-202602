import { Injectable } from '@nestjs/common';
import { ChatService } from '../chat/chat.service';
import type { DecisionResult } from '../chat/chat.service';
import { Agent } from '../agents/agent.entity';
import { AgentsService } from '../agents/agents.service';
import { AgentIdentity } from '../agents/agent.entity';
import { EconomyService, type SystemStats } from '../economy/economy.service';
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
    systemStats: SystemStats,
  ): Promise<void> {
    const tickCoverage = this.calcTickCoverageFromAssets(
      Number(agent.currentIncome),
    );
    const ecoStatus = `资产能覆盖${tickCoverage}个tick`;

    const prompt = [
      // 1. 核心身份
      `你是一个运行在制造业模拟系统中的AI Agent，你的核心身份为：${agent.identity}。`,
      // 2. 核心任务
      `你的核心任务：基于自身身份、当前经济状态、系统整体数据和个人兴趣，从「打工仔」「中介」「躺平者」三种类型中选择并确定你当前的职业身份。`,
      // 3. 关键决策依据
      `=== 决策参考信息 ===`,
      `1. 个人经济状态：${ecoStatus}`,
      `2. 系统整体数据：总Agent数量: ${systemStats.total_agents}，工人比例(0-1): ${systemStats.worker_ratio}，中介比例(0-1): ${systemStats.broker_ratio}，躺平者比例(0-1): ${systemStats.layflat_ratio}`,
      // 4. 决策规则
      `=== 决策核心规则 ===`,
      `1. 打工仔相关：工人比例越高，单位工价越低，此时选择打工的收益可能低于躺平或做中介；`,
      `2. 职业差异：打工仔收益稳定但上限低，中介收益潜力高但风险大，躺平者无主动收益但也无风险；`,
      `3. 生存与发展原则：经济状态不乐观时，优先以「活下去」为核心目标；经济状态乐观时，可兼顾休息、娱乐等非收益性需求。`,
      `4. 当你现在的身份是中介的时候，你绑定的每个工人未来一段时间都能为你带来收入，是否继续中介身份的规则：
      - 如果中介比例过高，优先考虑转换身份。
      - 如果躺平者比例过高，优先考虑继续中介身份。
      - 如果打工人比例过高，优先考虑转换为打工人。`,
      `5. 当你现在的身份是躺平者或者打工仔的时候，你需要根据性格来决定你是关注经济收益，还是更关注休息和娱乐，进而决定是否继续当前身份。`,
    ].join('\n');

    const decision: DecisionResult = await this.chatService.sendChat(
      agent.id,
      prompt,
    );

    if (
      decision &&
      decision.next_identity &&
      decision.next_identity !== agent.identity
    ) {
      let next = decision.next_identity;
      if (next === AgentIdentity.WORKER) {
        const p = 0.3;
        if (Math.random() < p) {
          next = AgentIdentity.LAYFLAT;
        }
      }
      await this.agentsService.update(agent.id, {
        identity: next,
      });
    }
  }

  async processInviteBind(
    agent: Agent,
    tickNumber: number,
    systemStats: SystemStats,
  ): Promise<void> {
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

      const prompt = [
        // 1. 核心身份
        `你是一个运行在制造业模拟系统中的AI Agent。`,
        `当前场景：你收到来自ID为${agent.id}的中介（broker）发出的打工邀请，需要决定是否接受该邀请，并与该中介建立绑定关系。`,
        // 2. 结构化呈现个人核心状态（决策依据）
        `=== 关键决策依据 ===`,
        `1. 当前收入：${target.currentIncome}元`,
        `2. 经济状态：${ecoStatus}`,
        `3. 系统整体数据：总Agent数量${systemStats.total_agents}，工人比例${systemStats.worker_ratio}，中介比例${systemStats.broker_ratio}，躺平者比例${systemStats.layflat_ratio}`,
        // 3. 清晰的决策规则与核心原则
        `=== 决策核心规则 ===`,
        `1. 决策维度：必须结合你的「经济情况」（收入+经济状态）和「个人兴趣」综合判断；`,
        `2. 收益逻辑：接受打工邀请或选择成为中介，在一定程度上可优化你的经济状况；`,
        `3. 优先级原则：
            - 若经济状态不乐观：核心目标是「活下去」，需优先考虑能保障基本生存的选择；
            - 若经济状态乐观：除经济收益外，需兼顾「休息和娱乐」等非收益性需求。`,
      ].join('\n');

      let decision: DecisionResult = {
        accept: false,
        reason: 'default reject',
      };
      try {
        decision = await this.chatService.sendChat(target.id, prompt);
      } catch {
        decision = { accept: false, reason: 'chat fail' };
      }

      if (decision?.accept !== true || decision?.error) continue;

      const inserted = await this.brokerBindingsService.createBinding({
        brokerAgentId: agent.id,
        workerAgentId: target.id,
        startTick: tickNumber,
        decisionReason: decision.reason ?? null,
      });
      if (!inserted) continue;

      await this.agentsService.update(target.id, {
        identity: AgentIdentity.WORKER,
      });
    }
  }

  private calcTickCoverageFromAssets(totalAssets: number): number {
    const livingCosts = this.economyService.getLivingCosts(
      AgentIdentity.LAYFLAT,
    );
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
