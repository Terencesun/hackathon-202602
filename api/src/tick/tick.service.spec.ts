import { Test, TestingModule } from '@nestjs/testing';
import { TickService } from './tick.service';
import { SUPABASE_CLIENT } from '../supabase/supabase.constants';
import { AgentsService } from '../agents/agents.service';
import { TransactionsService } from '../transactions/transactions.service';
import { AgentDecisionService } from '../decision/decision.service';
import { EconomyService } from '../economy/economy.service';
import type { SystemStats } from '../economy/economy.service';
import { Agent, AgentIdentity } from '../agents/agent.entity';
 
describe('TickService', () => {
  let svc: TickService;
 
  const agentsService = {
    getActiveAgents: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  };
  const transactionsService = {
    createTransaction: jest.fn(),
  };
  const decisionService = {
    processInviteBind: jest.fn(),
    processIdentityThinking: jest.fn(),
    processRegularThinking: jest.fn(),
    processRoleChange: jest.fn(),
  };
  const economyService = {
    getSystemStats: jest.fn(),
    getLivingCosts: jest.fn(),
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
 
  const systemStats: SystemStats = {
    total_agents: 10,
    worker_ratio: 0.4,
    broker_ratio: 0.2,
    layflat_ratio: 0.4,
  };
 
  beforeEach(async () => {
    jest.clearAllMocks();
 
    economyService.getSystemStats.mockResolvedValue(systemStats);
    transactionsService.createTransaction.mockResolvedValue({} as any);
    agentsService.update.mockResolvedValue({} as any);
    decisionService.processInviteBind.mockResolvedValue(undefined);
    decisionService.processIdentityThinking.mockResolvedValue(undefined);
    decisionService.processRegularThinking.mockResolvedValue(undefined);
    decisionService.processRoleChange.mockResolvedValue(undefined);
 
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TickService,
        { provide: SUPABASE_CLIENT, useValue: {} },
        { provide: AgentsService, useValue: agentsService },
        { provide: TransactionsService, useValue: transactionsService },
        { provide: AgentDecisionService, useValue: decisionService },
        { provide: EconomyService, useValue: economyService },
      ],
    }).compile();
 
    svc = module.get(TickService);
 
    jest.spyOn((svc as any).logger, 'log').mockImplementation(() => undefined);
    jest.spyOn((svc as any).logger, 'error').mockImplementation(() => undefined);
  });
 
  describe('processTick', () => {
    it('tick 为 24 的倍数时走身份决策，并在最后更新 agent tick', async () => {
      jest.spyOn(svc, 'incTick').mockResolvedValue(24);
      const agent = makeAgent({ id: 'a1', identity: AgentIdentity.WORKER });
      agentsService.getActiveAgents.mockResolvedValue([agent]);
      agentsService.findOne.mockResolvedValue(makeAgent({ id: 'a1', identity: AgentIdentity.WORKER }));
      economyService.getLivingCosts.mockReturnValue({ rent: 0.8, food: 1.2 });
 
      await svc.processTick();
 
      expect((svc as any).currentTick).toBe(24);
      expect(agentsService.getActiveAgents).toHaveBeenCalledTimes(1);
      expect(economyService.getSystemStats).toHaveBeenCalledTimes(1);
      expect(economyService.getLivingCosts).toHaveBeenCalledWith(AgentIdentity.WORKER);
 
      expect(transactionsService.createTransaction).toHaveBeenCalledTimes(2);
      expect(transactionsService.createTransaction).toHaveBeenNthCalledWith(
        1,
        agent.id,
        'rent_cost',
        -0.8,
        'Tick 24 Cost',
        24,
      );
      expect(transactionsService.createTransaction).toHaveBeenNthCalledWith(
        2,
        agent.id,
        'food_cost',
        -1.2,
        'Tick 24 Cost',
        24,
      );
 
      expect(decisionService.processIdentityThinking).toHaveBeenCalledWith(
        agent,
        24,
        systemStats,
      );
      expect(decisionService.processRegularThinking).not.toHaveBeenCalled();
 
      expect(agentsService.findOne).toHaveBeenCalledWith(agent.id);
      expect(decisionService.processRoleChange).toHaveBeenCalledWith(
        agent.id,
        AgentIdentity.WORKER,
        AgentIdentity.WORKER,
      );
      expect(agentsService.update).toHaveBeenCalledWith(agent.id, { currentTick: 24 });
 
      const costOrders = transactionsService.createTransaction.mock.invocationCallOrder;
      const thinkingOrder = decisionService.processIdentityThinking.mock.invocationCallOrder[0];
      const findOneOrder = agentsService.findOne.mock.invocationCallOrder[0];
      const updateOrder = agentsService.update.mock.invocationCallOrder[0];
 
      expect(Math.max(...costOrders)).toBeLessThan(thinkingOrder);
      expect(thinkingOrder).toBeLessThan(findOneOrder);
      expect(findOneOrder).toBeLessThan(updateOrder);
    });
 
    it('tick 不是 24 的倍数时走普通决策', async () => {
      jest.spyOn(svc, 'incTick').mockResolvedValue(7);
      const agent = makeAgent({ id: 'a1', identity: AgentIdentity.LAYFLAT });
      agentsService.getActiveAgents.mockResolvedValue([agent]);
      agentsService.findOne.mockResolvedValue(makeAgent({ id: 'a1', identity: AgentIdentity.LAYFLAT }));
      economyService.getLivingCosts.mockReturnValue({ basic: 0.6 });
 
      await svc.processTick();
 
      expect(decisionService.processRegularThinking).toHaveBeenCalledWith(agent, 7);
      expect(decisionService.processIdentityThinking).not.toHaveBeenCalled();
      expect(agentsService.update).toHaveBeenCalledWith(agent.id, { currentTick: 7 });
    });
 
    it('中介身份会先处理邀约绑定，再进入决策流程', async () => {
      jest.spyOn(svc, 'incTick').mockResolvedValue(1);
      const agent = makeAgent({ id: 'b1', identity: AgentIdentity.BROKER });
      agentsService.getActiveAgents.mockResolvedValue([agent]);
      agentsService.findOne.mockResolvedValue(makeAgent({ id: 'b1', identity: AgentIdentity.BROKER }));
      economyService.getLivingCosts.mockReturnValue({ office: 2.0, food: 1.2 });
 
      await svc.processTick();
 
      expect(decisionService.processInviteBind).toHaveBeenCalledWith(agent, 1);
      expect(decisionService.processRegularThinking).toHaveBeenCalledWith(agent, 1);
 
      const inviteOrder = decisionService.processInviteBind.mock.invocationCallOrder[0];
      const thinkingOrder = decisionService.processRegularThinking.mock.invocationCallOrder[0];
      expect(inviteOrder).toBeLessThan(thinkingOrder);
    });
 
    it('当查询不到最新 agent 时不触发角色变更处理', async () => {
      jest.spyOn(svc, 'incTick').mockResolvedValue(2);
      const agent = makeAgent({ id: 'a1', identity: AgentIdentity.WORKER });
      agentsService.getActiveAgents.mockResolvedValue([agent]);
      agentsService.findOne.mockResolvedValue(null);
      economyService.getLivingCosts.mockReturnValue({ rent: 0.8, food: 1.2 });
 
      await svc.processTick();
 
      expect(decisionService.processRoleChange).not.toHaveBeenCalled();
      expect(agentsService.update).toHaveBeenCalledWith(agent.id, { currentTick: 2 });
    });
 
    it('单个 agent 处理失败不会影响其他 agent 的处理与更新', async () => {
      jest.spyOn(svc, 'incTick').mockResolvedValue(3);
      const a1 = makeAgent({ id: 'a1', identity: AgentIdentity.WORKER });
      const a2 = makeAgent({ id: 'a2', identity: AgentIdentity.WORKER });
      agentsService.getActiveAgents.mockResolvedValue([a1, a2]);
      agentsService.findOne.mockImplementation(async (id: string) =>
        makeAgent({ id, identity: AgentIdentity.WORKER }),
      );
      economyService.getLivingCosts.mockReturnValue({ rent: 0.8 });
 
      decisionService.processRegularThinking
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValueOnce(undefined);
 
      await svc.processTick();
 
      expect((svc as any).logger.error).toHaveBeenCalledTimes(1);
      expect(decisionService.processRegularThinking).toHaveBeenCalledTimes(2);
 
      expect(agentsService.update).toHaveBeenCalledTimes(1);
      expect(agentsService.update).toHaveBeenCalledWith(a2.id, { currentTick: 3 });
    });
 
    it('生活成本交易使用负数金额，并按成本类型追加 _cost 后缀', async () => {
      jest.spyOn(svc, 'incTick').mockResolvedValue(9);
      const agent = makeAgent({ id: 'a1', identity: AgentIdentity.WORKER });
      agentsService.getActiveAgents.mockResolvedValue([agent]);
      agentsService.findOne.mockResolvedValue(makeAgent({ id: 'a1', identity: AgentIdentity.WORKER }));
      economyService.getLivingCosts.mockReturnValue({ rent: '0.8', food: 1.2 });
 
      await svc.processTick();
 
      expect(transactionsService.createTransaction).toHaveBeenCalledWith(
        agent.id,
        'rent_cost',
        -0.8,
        'Tick 9 Cost',
        9,
      );
      expect(transactionsService.createTransaction).toHaveBeenCalledWith(
        agent.id,
        'food_cost',
        -1.2,
        'Tick 9 Cost',
        9,
      );
    });
  });
});

