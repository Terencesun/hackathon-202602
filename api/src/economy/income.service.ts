import { Injectable } from '@nestjs/common';

export type LaborMarketState = 'scarce' | 'balanced' | 'surplus';

export type FactoryPayrollInput = {
  totalAgents: number;
  currentWorkers: number;
  workHours: number;
};

export type FactoryPayrollResult = {
  baseHourlyWage: number;
  hourlyWage: number;
  wageMultiplier: number;
  optimalWorkers: number;
  workHours: number;
  totalPay: number;
};

export type BrokerIncomeInput = {
  totalAgents: number;
  currentWorkers: number;
  currentTick: number;
  invitesInCurrentDay: number;
  successfulDirectInviteeFirstMonthWages: number[];
};

export type BrokerIncomeResult = {
  marketState: LaborMarketState;
  workerSupplyDemandRatio: number;
  commissionRate: number;
  directCommission: number;
  teamBonus: number;
  operatingCost: number;
  netIncome: number;
};

export type AgentIncomeIdentity = 'worker' | 'broker' | 'layflat';

export type ApplyIncomeInput = {
  identity: AgentIncomeIdentity;
  totalAgents: number;
  currentWorkers: number;
  workHours: number;
  currentTick: number;
  invitesInCurrentDay: number;
  successfulDirectInviteeFirstMonthWages: number[];
};

export type IncomeItem = {
  type: string;
  amount: number;
  reason: string;
};

@Injectable()
export class IncomeService {
  private readonly BASE_HOURLY_WAGE = 20;
  private readonly OPTIMAL_WORKER_RATIO = 0.6;

  private readonly STANDARD_COMMISSION_RATE = 0.1;
  private readonly SCARCE_COMMISSION_RATE = 0.15;
  private readonly SURPLUS_COMMISSION_RATE = 0.08;
  private readonly BROKER_OPERATING_COST_PER_TICK = 5;
  private readonly TEAM_BONUS_INVITE_THRESHOLD = 10;
  private readonly TEAM_BONUS_AMOUNT = 500;
  private readonly TICKS_PER_DAY = 24;

  applyIncom(input: ApplyIncomeInput): IncomeItem[] {
    if (input.identity === 'worker') {
      const factory = this.applyFactorySalaryPolicy({
        totalAgents: input.totalAgents,
        currentWorkers: input.currentWorkers,
        workHours: input.workHours,
      });
      return [
        {
          type: 'worker_income',
          amount: factory.totalPay,
          reason: '工资收入',
        },
      ];
    }

    if (input.identity === 'broker') {
      const broker = this.applyBrokerCommissionPolicy({
        totalAgents: input.totalAgents,
        currentWorkers: input.currentWorkers,
        currentTick: input.currentTick,
        invitesInCurrentDay: input.invitesInCurrentDay,
        successfulDirectInviteeFirstMonthWages:
          input.successfulDirectInviteeFirstMonthWages,
      });
      return [
        {
          type: 'broker_income_direct_commission',
          amount: broker.directCommission,
          reason: '直邀佣金收入',
        },
        {
          type: 'broker_income_team_bonus',
          amount: broker.teamBonus,
          reason: '团队奖金收入',
        },
        {
          type: 'broker_income_operating_cost',
          amount: broker.operatingCost,
          reason: '运营成本',
        },
      ];
    }

    return [];
  }

  applyFactorySalaryPolicy(input: FactoryPayrollInput): FactoryPayrollResult {
    // PRD 5.1 动态工资公式：
    // 工资倍率 = 1 + (最佳工人数 - 当前工人数) / 最佳工人数
    const optimalWorkers = this.calcOptimalWorkers(input.totalAgents);
    const wageMultiplier = this.calcWageMultiplier({
      optimalWorkers,
      currentWorkers: input.currentWorkers,
    });
    const hourlyWage = this.clampNonNegative(
      this.BASE_HOURLY_WAGE * wageMultiplier,
    );

    const workHours = this.clampNonNegative(input.workHours);
    const totalPay = workHours * hourlyWage;

    return {
      baseHourlyWage: this.BASE_HOURLY_WAGE,
      hourlyWage,
      wageMultiplier,
      optimalWorkers,
      workHours,
      totalPay,
    };
  }

  applyBrokerCommissionPolicy(input: BrokerIncomeInput): BrokerIncomeResult {
    const { marketState, workerSupplyDemandRatio } = this.classifyLaborMarket({
      totalAgents: input.totalAgents,
      currentWorkers: input.currentWorkers,
    });
    const commissionRate = this.resolveCommissionRate(marketState);

    const directCommission = this.calcDirectInviteCommission(
      input.successfulDirectInviteeFirstMonthWages,
      commissionRate,
    );

    const teamBonus = this.calcTeamBonus({
      currentTick: input.currentTick,
      invitesInCurrentDay: input.invitesInCurrentDay,
    });

    const operatingCost = -this.BROKER_OPERATING_COST_PER_TICK;
    const netIncome = directCommission + teamBonus + operatingCost;

    return {
      marketState,
      workerSupplyDemandRatio,
      commissionRate,
      directCommission,
      teamBonus,
      operatingCost,
      netIncome,
    };
  }

  private calcOptimalWorkers(totalAgents: number): number {
    return this.clampNonNegative(totalAgents) * this.OPTIMAL_WORKER_RATIO;
  }

  private calcWageMultiplier(params: {
    optimalWorkers: number;
    currentWorkers: number;
  }): number {
    const optimal = params.optimalWorkers;
    if (optimal <= 0) return 1;

    const current = this.clampNonNegative(params.currentWorkers);
    return 1 + (optimal - current) / optimal;
  }

  private classifyLaborMarket(params: {
    totalAgents: number;
    currentWorkers: number;
  }): { marketState: LaborMarketState; workerSupplyDemandRatio: number } {
    const optimalWorkers = this.calcOptimalWorkers(params.totalAgents);
    if (optimalWorkers <= 0) {
      return { marketState: 'balanced', workerSupplyDemandRatio: 1 };
    }

    // PRD 只给出“稀缺/平衡/过剩”的定性描述，这里用供需比的容忍区间来划分：
    // ratio < 0.9 => 稀缺；0.9~1.1 => 平衡；> 1.1 => 过剩
    const ratio =
      this.clampNonNegative(params.currentWorkers) /
      this.clampNonNegative(optimalWorkers);

    if (ratio < 0.9)
      return { marketState: 'scarce', workerSupplyDemandRatio: ratio };
    if (ratio > 1.1)
      return { marketState: 'surplus', workerSupplyDemandRatio: ratio };
    return { marketState: 'balanced', workerSupplyDemandRatio: ratio };
  }

  private resolveCommissionRate(state: LaborMarketState): number {
    switch (state) {
      case 'scarce':
        return this.SCARCE_COMMISSION_RATE;
      case 'surplus':
        return this.SURPLUS_COMMISSION_RATE;
      case 'balanced':
      default:
        return this.STANDARD_COMMISSION_RATE;
    }
  }

  private calcDirectInviteCommission(
    inviteeFirstMonthWages: number[],
    commissionRate: number,
  ): number {
    const safeRate = this.clampNonNegative(commissionRate);
    const totalWages = (inviteeFirstMonthWages ?? [])
      .map((w) => (Number.isFinite(w) ? w : 0))
      .reduce((sum, w) => sum + Math.max(0, w), 0);
    return totalWages * safeRate;
  }

  private calcTeamBonus(params: {
    currentTick: number;
    invitesInCurrentDay: number;
  }): number {
    const isEndOfDay =
      Number.isFinite(params.currentTick) &&
      params.currentTick > 0 &&
      params.currentTick % this.TICKS_PER_DAY === 0;
    if (!isEndOfDay) return 0;

    return params.invitesInCurrentDay >= this.TEAM_BONUS_INVITE_THRESHOLD
      ? this.TEAM_BONUS_AMOUNT
      : 0;
  }

  private clampNonNegative(v: number): number {
    if (!Number.isFinite(v)) return 0;
    return Math.max(0, v);
  }
}
