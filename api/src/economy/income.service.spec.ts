import { Test, TestingModule } from '@nestjs/testing';
import { IncomeService } from './income.service';

describe('IncomeService', () => {
  let svc: IncomeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [IncomeService],
    }).compile();

    svc = module.get(IncomeService);
  });

  describe('applyFactorySalaryPolicy', () => {
    it('工人稀缺时小时工资上涨', () => {
      const result = svc.applyFactorySalaryPolicy({
        totalAgents: 10,
        currentWorkers: 3,
        workHours: 8,
      });

      expect(result.optimalWorkers).toBe(6);
      expect(result.wageMultiplier).toBeCloseTo(1.5, 8);
      expect(result.hourlyWage).toBeCloseTo(30, 8);
      expect(result.totalPay).toBeCloseTo(240, 8);
    });

    it('工人过剩时小时工资下降', () => {
      const result = svc.applyFactorySalaryPolicy({
        totalAgents: 10,
        currentWorkers: 9,
        workHours: 8,
      });

      expect(result.optimalWorkers).toBe(6);
      expect(result.wageMultiplier).toBeCloseTo(0.5, 8);
      expect(result.hourlyWage).toBeCloseTo(10, 8);
      expect(result.totalPay).toBeCloseTo(80, 8);
    });

    it('工资总额等于小时工资乘以工时', () => {
      const result = svc.applyFactorySalaryPolicy({
        totalAgents: 10,
        currentWorkers: 6,
        workHours: 10,
      });

      expect(result.hourlyWage).toBeCloseTo(20, 8);
      expect(result.workHours).toBe(10);
      expect(result.totalPay).toBeCloseTo(200, 8);
    });

    it('当工资倍率为负时，小时工资按 0 处理', () => {
      const result = svc.applyFactorySalaryPolicy({
        totalAgents: 10,
        currentWorkers: 100,
        workHours: 8,
      });

      expect(result.wageMultiplier).toBeLessThan(0);
      expect(result.hourlyWage).toBe(0);
      expect(result.totalPay).toBe(0);
    });
  });

  describe('applyBrokerCommissionPolicy', () => {
    it('工人稀缺时返佣比例为 15%', () => {
      const result = svc.applyBrokerCommissionPolicy({
        totalAgents: 10,
        currentWorkers: 3,
        currentTick: 1,
        invitesInCurrentDay: 0,
        successfulDirectInviteeFirstMonthWages: [],
      });

      expect(result.marketState).toBe('scarce');
      expect(result.commissionRate).toBeCloseTo(0.15, 8);
    });

    it('工人平衡时返佣比例为 10%', () => {
      const result = svc.applyBrokerCommissionPolicy({
        totalAgents: 10,
        currentWorkers: 6,
        currentTick: 1,
        invitesInCurrentDay: 0,
        successfulDirectInviteeFirstMonthWages: [],
      });

      expect(result.marketState).toBe('balanced');
      expect(result.commissionRate).toBeCloseTo(0.1, 8);
    });

    it('工人过剩时返佣比例为 8%', () => {
      const result = svc.applyBrokerCommissionPolicy({
        totalAgents: 10,
        currentWorkers: 9,
        currentTick: 1,
        invitesInCurrentDay: 0,
        successfulDirectInviteeFirstMonthWages: [],
      });

      expect(result.marketState).toBe('surplus');
      expect(result.commissionRate).toBeCloseTo(0.08, 8);
    });

    it('每 tick 扣除 5 元运营成本，并在日末满足邀请数时发放团队奖金', () => {
      const result = svc.applyBrokerCommissionPolicy({
        totalAgents: 10,
        currentWorkers: 3,
        currentTick: 24,
        invitesInCurrentDay: 10,
        successfulDirectInviteeFirstMonthWages: [1000],
      });

      expect(result.operatingCost).toBe(-5);
      expect(result.directCommission).toBeCloseTo(150, 8);
      expect(result.teamBonus).toBe(500);
      expect(result.netIncome).toBeCloseTo(645, 8);
    });

    it('非日末 tick 不发放团队奖金（即使当天邀请数已达标）', () => {
      const result = svc.applyBrokerCommissionPolicy({
        totalAgents: 10,
        currentWorkers: 3,
        currentTick: 23,
        invitesInCurrentDay: 10,
        successfulDirectInviteeFirstMonthWages: [],
      });

      expect(result.teamBonus).toBe(0);
      expect(result.operatingCost).toBe(-5);
      expect(result.netIncome).toBe(-5);
    });
  });

  describe('applyIncom', () => {
    it('身份为工人时只计算工资收入', () => {
      const result = svc.applyIncom({
        identity: 'worker',
        totalAgents: 10,
        currentWorkers: 3,
        workHours: 8,
        currentTick: 24,
        invitesInCurrentDay: 10,
        successfulDirectInviteeFirstMonthWages: [1000],
      });

      expect(result).toEqual([
        {
          type: 'worker_income',
          amount: 240,
          reason: '工资收入',
        },
      ]);
    });

    it('身份为中介时返回多条收入项，并且汇总等于净收入', () => {
      const result = svc.applyIncom({
        identity: 'broker',
        totalAgents: 10,
        currentWorkers: 3,
        workHours: 8,
        currentTick: 24,
        invitesInCurrentDay: 10,
        successfulDirectInviteeFirstMonthWages: [1000],
      });

      expect(result).toEqual([
        {
          type: 'broker_income_direct_commission',
          amount: 150,
          reason: '直邀佣金收入',
        },
        {
          type: 'broker_income_team_bonus',
          amount: 500,
          reason: '团队奖金收入',
        },
        {
          type: 'broker_income_operating_cost',
          amount: -5,
          reason: '运营成本',
        },
      ]);

      const total = result.reduce((sum, item) => sum + item.amount, 0);
      expect(total).toBeCloseTo(645, 8);
    });

    it('身份为躺平时没有收入项', () => {
      const result = svc.applyIncom({
        identity: 'layflat',
        totalAgents: 10,
        currentWorkers: 3,
        workHours: 8,
        currentTick: 24,
        invitesInCurrentDay: 10,
        successfulDirectInviteeFirstMonthWages: [1000],
      });

      expect(result).toEqual([]);
    });
  });
});
