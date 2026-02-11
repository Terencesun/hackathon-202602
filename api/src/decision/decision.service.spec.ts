import { Test, TestingModule } from '@nestjs/testing';
import { AgentDecisionService } from './decision.service';
import { Agent, AgentIdentity } from '../agents/agent.entity';
import { ChatService } from '../chat/chat.service';
import type { DecisionResult } from '../chat/chat.service';
import { AgentsService } from '../agents/agents.service';
import { EconomyService, type SystemStats } from '../economy/economy.service';
import { BrokerBindingsService } from '../broker-bindings/broker-bindings.service';

describe('AgentDecisionService', () => {
  let svc: AgentDecisionService;

  const chatService = {
    sendChat: jest.fn<Promise<DecisionResult>, [string, string]>(),
  };
  const agentsService = {
    update: jest.fn(),
    getLatestActiveLayflatAgents: jest.fn(),
  };
  const economyService = {
    getLivingCosts: jest.fn(),
  };
  const brokerBindingsService = {
    removeRelFromWorker: jest.fn(),
    removeRelFromBroker: jest.fn(),
    findLatestByWorkerAgentId: jest.fn(),
    createBinding: jest.fn(),
  };

  const makeAgent = (partial: Partial<Agent>): Agent =>
    ({
      id: 'agent-1',
      userId: 'user-1',
      user: null,
      identity: AgentIdentity.LAYFLAT,
      interestTags: [],
      currentIncome: 0,
      workingHours: 0,
      currentTick: 0,
      isActive: true,
      createdAt: null,
      updatedAt: null,
      ...partial,
    }) as Agent;

  beforeEach(async () => {
    jest.clearAllMocks();

    economyService.getLivingCosts.mockReturnValue({ basic: 1 });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentDecisionService,
        { provide: ChatService, useValue: chatService },
        { provide: AgentsService, useValue: agentsService },
        { provide: EconomyService, useValue: economyService },
        { provide: BrokerBindingsService, useValue: brokerBindingsService },
      ],
    }).compile();

    svc = module.get(AgentDecisionService);
  });

  describe('processRoleChange', () => {
    it('同身份不触发任何关系清理', async () => {
      await svc.processRoleChange(
        'a1',
        AgentIdentity.WORKER,
        AgentIdentity.WORKER,
      );
      expect(brokerBindingsService.removeRelFromWorker).not.toHaveBeenCalled();
      expect(brokerBindingsService.removeRelFromBroker).not.toHaveBeenCalled();
    });

    it('工人切换到中介会解除其作为工人的绑定关系', async () => {
      await svc.processRoleChange(
        'a1',
        AgentIdentity.WORKER,
        AgentIdentity.BROKER,
      );
      expect(brokerBindingsService.removeRelFromWorker).toHaveBeenCalledWith(
        'a1',
      );
      expect(brokerBindingsService.removeRelFromBroker).not.toHaveBeenCalled();
    });

    it('工人切换到躺平会解除其作为工人的绑定关系', async () => {
      await svc.processRoleChange(
        'a1',
        AgentIdentity.WORKER,
        AgentIdentity.LAYFLAT,
      );
      expect(brokerBindingsService.removeRelFromWorker).toHaveBeenCalledWith(
        'a1',
      );
      expect(brokerBindingsService.removeRelFromBroker).not.toHaveBeenCalled();
    });

    it('中介切换到工人会解除其作为中介的绑定关系', async () => {
      await svc.processRoleChange(
        'a1',
        AgentIdentity.BROKER,
        AgentIdentity.WORKER,
      );
      expect(brokerBindingsService.removeRelFromBroker).toHaveBeenCalledWith(
        'a1',
      );
      expect(brokerBindingsService.removeRelFromWorker).not.toHaveBeenCalled();
    });

    it('中介切换到躺平会解除其作为中介的绑定关系', async () => {
      await svc.processRoleChange(
        'a1',
        AgentIdentity.BROKER,
        AgentIdentity.LAYFLAT,
      );
      expect(brokerBindingsService.removeRelFromBroker).toHaveBeenCalledWith(
        'a1',
      );
      expect(brokerBindingsService.removeRelFromWorker).not.toHaveBeenCalled();
    });

    it('躺平切换身份不会触发关系清理', async () => {
      await svc.processRoleChange(
        'a1',
        AgentIdentity.LAYFLAT,
        AgentIdentity.BROKER,
      );
      await svc.processRoleChange(
        'a1',
        AgentIdentity.LAYFLAT,
        AgentIdentity.WORKER,
      );
      expect(brokerBindingsService.removeRelFromWorker).not.toHaveBeenCalled();
      expect(brokerBindingsService.removeRelFromBroker).not.toHaveBeenCalled();
    });
  });

  describe('processRegularThinking', () => {
    const systemStats: SystemStats = {
      total_agents: 10,
      worker_ratio: 0.4,
      broker_ratio: 0.2,
      layflat_ratio: 0.4,
    };

    it('模型返回不同的 next_identity 时，更新身份', async () => {
      const agent = makeAgent({
        identity: AgentIdentity.WORKER,
        currentIncome: 10,
        workingHours: 3,
        interestTags: ['效率', '赚钱'],
      });
      chatService.sendChat.mockResolvedValueOnce({
        next_identity: AgentIdentity.LAYFLAT,
        reason: '想休息',
      });

      await svc.processRegularThinking(agent, systemStats);

      expect(chatService.sendChat).toHaveBeenCalledTimes(1);
      expect(chatService.sendChat.mock.calls[0][0]).toBe(agent.id);
      expect(chatService.sendChat.mock.calls[0][1]).toContain(
        '决定是否继续当前身份',
      );
      expect(chatService.sendChat.mock.calls[0][1]).toContain(
        `总Agent数${systemStats.total_agents}`,
      );

      expect(agentsService.update).toHaveBeenCalledWith(agent.id, {
        identity: AgentIdentity.LAYFLAT,
      });
    });

    it('模型返回相同的 next_identity 时，不更新身份', async () => {
      const agent = makeAgent({ identity: AgentIdentity.WORKER });
      chatService.sendChat.mockResolvedValueOnce({
        next_identity: AgentIdentity.WORKER,
        reason: '继续工作',
      });

      await svc.processRegularThinking(agent, systemStats);

      expect(agentsService.update).not.toHaveBeenCalled();
    });

    it('模型未返回 next_identity 时，不更新身份', async () => {
      const agent = makeAgent({ identity: AgentIdentity.WORKER });
      chatService.sendChat.mockResolvedValueOnce({ reason: '不知道' });

      await svc.processRegularThinking(agent, systemStats);

      expect(agentsService.update).not.toHaveBeenCalled();
    });
  });

  describe('processInviteBind', () => {
    it('非中介身份不会发起邀请', async () => {
      const agent = makeAgent({ identity: AgentIdentity.WORKER });
      await svc.processInviteBind(agent, 1);
      expect(agentsService.getLatestActiveLayflatAgents).not.toHaveBeenCalled();
      expect(chatService.sendChat).not.toHaveBeenCalled();
      expect(brokerBindingsService.createBinding).not.toHaveBeenCalled();
    });

    it('跳过自己与已有绑定的候选人', async () => {
      const broker = makeAgent({
        id: 'broker-1',
        identity: AgentIdentity.BROKER,
      });
      const self = makeAgent({
        id: 'broker-1',
        identity: AgentIdentity.LAYFLAT,
      });
      const boundWorker = makeAgent({
        id: 'w1',
        identity: AgentIdentity.LAYFLAT,
      });

      agentsService.getLatestActiveLayflatAgents.mockResolvedValueOnce([
        self,
        boundWorker,
      ]);
      brokerBindingsService.findLatestByWorkerAgentId.mockResolvedValueOnce({
        id: 'b1',
      } as any);

      await svc.processInviteBind(broker, 1);

      expect(
        brokerBindingsService.findLatestByWorkerAgentId,
      ).toHaveBeenCalledTimes(1);
      expect(
        brokerBindingsService.findLatestByWorkerAgentId,
      ).toHaveBeenCalledWith('w1');
      expect(chatService.sendChat).not.toHaveBeenCalled();
      expect(brokerBindingsService.createBinding).not.toHaveBeenCalled();
    });

    it('邀请对话失败会直接跳过该候选人', async () => {
      const broker = makeAgent({
        id: 'broker-1',
        identity: AgentIdentity.BROKER,
      });
      const worker = makeAgent({
        id: 'w1',
        identity: AgentIdentity.LAYFLAT,
        currentIncome: 20,
        interestTags: ['稳定'],
      });

      agentsService.getLatestActiveLayflatAgents.mockResolvedValueOnce([
        worker,
      ]);
      brokerBindingsService.findLatestByWorkerAgentId.mockResolvedValueOnce(
        null,
      );
      chatService.sendChat.mockRejectedValueOnce(new Error('chat down'));

      await svc.processInviteBind(broker, 1);

      expect(brokerBindingsService.createBinding).not.toHaveBeenCalled();
      expect(agentsService.update).not.toHaveBeenCalled();
    });

    it('候选人拒绝邀请时不会创建绑定', async () => {
      const broker = makeAgent({
        id: 'broker-1',
        identity: AgentIdentity.BROKER,
      });
      const worker = makeAgent({ id: 'w1', identity: AgentIdentity.LAYFLAT });

      agentsService.getLatestActiveLayflatAgents.mockResolvedValueOnce([
        worker,
      ]);
      brokerBindingsService.findLatestByWorkerAgentId.mockResolvedValueOnce(
        null,
      );
      chatService.sendChat.mockResolvedValueOnce({
        accept: false,
        reason: '不想上班',
      });

      await svc.processInviteBind(broker, 1);

      expect(brokerBindingsService.createBinding).not.toHaveBeenCalled();
      expect(agentsService.update).not.toHaveBeenCalled();
    });

    it('候选人接受但返回 error 时不会创建绑定', async () => {
      const broker = makeAgent({
        id: 'broker-1',
        identity: AgentIdentity.BROKER,
      });
      const worker = makeAgent({ id: 'w1', identity: AgentIdentity.LAYFLAT });

      agentsService.getLatestActiveLayflatAgents.mockResolvedValueOnce([
        worker,
      ]);
      brokerBindingsService.findLatestByWorkerAgentId.mockResolvedValueOnce(
        null,
      );
      chatService.sendChat.mockResolvedValueOnce({
        accept: true,
        error: '模型输出异常',
      });

      await svc.processInviteBind(broker, 1);

      expect(brokerBindingsService.createBinding).not.toHaveBeenCalled();
      expect(agentsService.update).not.toHaveBeenCalled();
    });

    it('创建绑定失败时不会切换候选人身份', async () => {
      const broker = makeAgent({
        id: 'broker-1',
        identity: AgentIdentity.BROKER,
      });
      const worker = makeAgent({ id: 'w1', identity: AgentIdentity.LAYFLAT });

      agentsService.getLatestActiveLayflatAgents.mockResolvedValueOnce([
        worker,
      ]);
      brokerBindingsService.findLatestByWorkerAgentId.mockResolvedValueOnce(
        null,
      );
      chatService.sendChat.mockResolvedValueOnce({
        accept: true,
        reason: '可以试试',
      });
      brokerBindingsService.createBinding.mockResolvedValueOnce(null);

      await svc.processInviteBind(broker, 1);

      expect(brokerBindingsService.createBinding).toHaveBeenCalledTimes(1);
      expect(agentsService.update).not.toHaveBeenCalled();
    });

    it('候选人接受且创建绑定成功后会切换为工人', async () => {
      const broker = makeAgent({
        id: 'broker-1',
        identity: AgentIdentity.BROKER,
      });
      const worker = makeAgent({ id: 'w1', identity: AgentIdentity.LAYFLAT });

      agentsService.getLatestActiveLayflatAgents.mockResolvedValueOnce([
        worker,
      ]);
      brokerBindingsService.findLatestByWorkerAgentId.mockResolvedValueOnce(
        null,
      );
      chatService.sendChat.mockResolvedValueOnce({
        accept: true,
        reason: '想赚钱',
      });
      brokerBindingsService.createBinding.mockResolvedValueOnce({
        id: 'bind-1',
      });

      await svc.processInviteBind(broker, 1);

      expect(brokerBindingsService.createBinding).toHaveBeenCalledWith({
        brokerAgentId: 'broker-1',
        workerAgentId: 'w1',
        startTick: 1,
        decisionReason: '想赚钱',
      });
      expect(agentsService.update).toHaveBeenCalledWith('w1', {
        identity: AgentIdentity.WORKER,
      });
    });
  });

  describe('calcTickCoverageFromAssets（通过 hack 调用 private 方法）', () => {
    it('总资产不是有限数值时返回 0', () => {
      const fn = (svc as any).calcTickCoverageFromAssets.bind(svc) as (
        totalAssets: number,
      ) => number;
      const result = fn(Number.NaN);
      expect(result).toBe(0);
    });

    it('每 tick 成本为 0 或负数时返回 0', () => {
      economyService.getLivingCosts.mockReturnValueOnce({ basic: 0 });
      const fn = (svc as any).calcTickCoverageFromAssets.bind(svc) as (
        totalAssets: number,
      ) => number;
      expect(fn(100)).toBe(0);

      economyService.getLivingCosts.mockReturnValueOnce({ basic: -1 });
      expect(fn(100)).toBe(0);
    });

    it('会把生活成本求和后向下取整计算可覆盖 tick 数', () => {
      economyService.getLivingCosts.mockReturnValueOnce({
        rent: 10,
        food: '5',
        other: 'not-a-number',
      });
      const fn = (svc as any).calcTickCoverageFromAssets.bind(svc) as (
        totalAssets: number,
      ) => number;
      const result = fn(31);

      expect(economyService.getLivingCosts).toHaveBeenCalledWith(
        AgentIdentity.LAYFLAT,
      );
      expect(result).toBe(2);
    });

    it('当总资产不足 1 tick 成本时返回 0', () => {
      economyService.getLivingCosts.mockReturnValueOnce({ basic: 10 });
      const fn = (svc as any).calcTickCoverageFromAssets.bind(svc) as (
        totalAssets: number,
      ) => number;
      expect(fn(9)).toBe(0);
    });
  });
});
