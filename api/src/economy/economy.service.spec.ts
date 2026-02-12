import { Test, TestingModule } from '@nestjs/testing';
import { EconomyService } from './economy.service';
import { AgentsService } from '../agents/agents.service';
import { AgentIdentity } from '../agents/agent.entity';

describe('EconomyService', () => {
  let service: EconomyService;
  let agentsService: AgentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EconomyService,
        {
          provide: AgentsService,
          useValue: {
            getActiveAgents: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<EconomyService>(EconomyService);
    agentsService = module.get<AgentsService>(AgentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getSystemStats', () => {
    it('should return default stats when no agents', async () => {
      jest.spyOn(agentsService, 'getActiveAgents').mockResolvedValue([]);
      const stats = await service.getSystemStats();
      expect(stats).toEqual({
        total_agents: 0,
        worker_ratio: 0,
        broker_ratio: 0,
        layflat_ratio: 0,
      });
    });

    it('should calculate ratios correctly', async () => {
      jest
        .spyOn(agentsService, 'getActiveAgents')
        .mockResolvedValue([
          { identity: AgentIdentity.WORKER } as any,
          { identity: AgentIdentity.WORKER } as any,
          { identity: AgentIdentity.BROKER } as any,
          { identity: AgentIdentity.LAYFLAT } as any,
        ]);

      const stats = await service.getSystemStats();
      expect(stats).toEqual({
        total_agents: 4,
        worker_ratio: 0.5,
        broker_ratio: 0.25,
        layflat_ratio: 0.25,
      });
    });
  });

  describe('getLivingCosts', () => {
    it('should return correct costs for WORKER', () => {
      const costs = service.getLivingCosts(AgentIdentity.WORKER);
      expect(costs).toEqual({ rent: 0.8, food: 1.2 });
    });

    it('should return correct costs for BROKER', () => {
      const costs = service.getLivingCosts(AgentIdentity.BROKER);
      expect(costs).toEqual({ office: 2.0, food: 1.2 });
    });

    it('should return correct costs for LAYFLAT', () => {
      const costs = service.getLivingCosts(AgentIdentity.LAYFLAT);
      expect(costs).toEqual({ basic: 0.6 });
    });
  });

  describe('calculateAccidentalCost', () => {
    it('should return null or an accident object', () => {
      // Run multiple times to cover random behavior roughly
      const results = [];
      for (let i = 0; i < 100; i++) {
        results.push(service.calculateAccidentalCost(100));
      }

      // Check if we get at least some nulls (very likely)
      const hasNull = results.some((r) => r === null);
      expect(hasNull).toBe(true);

      // We might not get an accident in 100 runs if probability is low (5%), but statistically probable.
      // If we want to test accident logic specifically, we can mock Math.random
    });

    it('should return an accident when Math.random < 0.05', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.01); // Force accident
      const income = 1000;
      const result = service.calculateAccidentalCost(income);

      expect(result).toBeDefined();
      expect(result).not.toBeNull();
      if (result) {
        expect(result.cost).toBeGreaterThan(0);
        expect(typeof result.name).toBe('string');
        expect(typeof result.description).toBe('string');
      }

      jest.spyOn(Math, 'random').mockRestore();
    });

    it('should return null when Math.random > 0.05', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.1); // Force no accident
      const result = service.calculateAccidentalCost(1000);
      expect(result).toBeNull();
      jest.spyOn(Math, 'random').mockRestore();
    });
  });
});
