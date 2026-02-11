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

  /**
   * 根据身份应用收入规则，返回本 Tick 的收入/支出明细（可用于前端展示或账本入账）。
   * 过程：
   * 1) identity=worker：按“工厂工资策略”计算工资总额，产出一条工资收入；
   * 2) identity=broker：按“经纪佣金策略”计算直邀佣金、团队奖金与运营成本，产出三条明细；
   * 3) 其他身份：当前不产生收入明细，返回空数组。
   */
  applyIncom(input: ApplyIncomeInput): IncomeItem[] {
    if (input.identity === 'worker') {
      // 1) 先计算工人工资：取最优工人数、工资倍率、时薪与总工资
      const factory = this.applyFactorySalaryPolicy({
        totalAgents: input.totalAgents,
        currentWorkers: input.currentWorkers,
        workHours: input.workHours,
      });
      // 2) 将“工资总额”包装为可入账的 IncomeItem
      return [
        {
          type: 'worker_income',
          amount: factory.totalPay,
          reason: '工资收入',
        },
      ];
    }

    if (input.identity === 'broker') {
      // 1) 先计算经纪人收入：劳动力市场状态->佣金率，直邀佣金，团队奖金，以及固定运营成本
      const broker = this.applyBrokerCommissionPolicy({
        totalAgents: input.totalAgents,
        currentWorkers: input.currentWorkers,
        currentTick: input.currentTick,
        invitesInCurrentDay: input.invitesInCurrentDay,
        successfulDirectInviteeFirstMonthWages:
          input.successfulDirectInviteeFirstMonthWages,
      });
      // 2) 将计算结果拆成三条明细（收入与支出分开展示）
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

    // layflat 或其他身份：当前规则下不产生收入/支出条目
    return [];
  }

  /**
   * 工厂工资策略（PRD 5.1 动态工资）。
   * 过程：
   * 1) 计算“最佳工人数”= totalAgents * OPTIMAL_WORKER_RATIO；
   * 2) 计算“工资倍率”= 1 + (最佳工人数 - 当前工人数) / 最佳工人数；
   * 3) 时薪 = BASE_HOURLY_WAGE * 工资倍率，并做非负钳制；
   * 4) 总工资 = workHours * 时薪，workHours 同样做非负钳制；
   * 5) 返回用于展示/调试的拆解字段（基准时薪、倍率、最优人数等）。
   */
  applyFactorySalaryPolicy(input: FactoryPayrollInput): FactoryPayrollResult {
    // PRD 5.1 动态工资公式：
    // 工资倍率 = 1 + (最佳工人数 - 当前工人数) / 最佳工人数
    // 1) 根据总人数推算“最佳工人数”
    const optimalWorkers = this.calcOptimalWorkers(input.totalAgents);
    // 2) 根据“当前工人数 vs 最佳工人数”推算工资倍率
    const wageMultiplier = this.calcWageMultiplier({
      optimalWorkers,
      currentWorkers: input.currentWorkers,
    });
    // 3) 用倍率调整时薪，并确保不会出现负数/NaN
    const hourlyWage = this.clampNonNegative(
      this.BASE_HOURLY_WAGE * wageMultiplier,
    );

    // 4) 工时也做非负钳制；最终总工资=工时*时薪
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

  /**
   * 经纪佣金策略：根据劳动力市场状态决定佣金率，并叠加团队奖金与固定成本。
   * 过程：
   * 1) 用“当前工人数 / 最佳工人数”得到供需比，并划分市场状态（稀缺/平衡/过剩）；
   * 2) 市场状态 -> 佣金率（稀缺更高，过剩更低）；
   * 3) 直邀佣金 = 直邀成员“首月工资之和” * 佣金率（只计非负工资，异常值按 0 处理）；
   * 4) 团队奖金：仅在“每天最后一个 Tick”发放，且当日邀约数达到阈值才发放；
   * 5) 运营成本：每 Tick 固定支出（用负数表示）；
   * 6) 净收入 = 直邀佣金 + 团队奖金 + 运营成本。
   */
  applyBrokerCommissionPolicy(input: BrokerIncomeInput): BrokerIncomeResult {
    // 1) 判断当前劳动力市场状态与供需比（用于展示与决定佣金率）
    const { marketState, workerSupplyDemandRatio } = this.classifyLaborMarket({
      totalAgents: input.totalAgents,
      currentWorkers: input.currentWorkers,
    });
    // 2) 由市场状态映射出佣金率
    const commissionRate = this.resolveCommissionRate(marketState);

    // 3) 直邀佣金：按被直邀成员首月工资列表汇总计算
    const directCommission = this.calcDirectInviteCommission(
      input.successfulDirectInviteeFirstMonthWages,
      commissionRate,
    );

    // 4) 团队奖金：只有每天结算点且达成阈值才发放
    const teamBonus = this.calcTeamBonus({
      currentTick: input.currentTick,
      invitesInCurrentDay: input.invitesInCurrentDay,
    });

    // 5) 固定运营成本（负数代表支出）
    const operatingCost = -this.BROKER_OPERATING_COST_PER_TICK;
    // 6) 净收入：把所有收入/支出项合并为本 Tick 的净值
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

  /**
   * 计算“最佳工人数”。
   * 规则：最佳工人数 = totalAgents * OPTIMAL_WORKER_RATIO，并对 totalAgents 做非负处理。
   */
  private calcOptimalWorkers(totalAgents: number): number {
    return this.clampNonNegative(totalAgents) * this.OPTIMAL_WORKER_RATIO;
  }

  /**
   * 计算工资倍率。
   * 规则（PRD 5.1）：wageMultiplier = 1 + (optimal - current) / optimal
   * 边界处理：
   * - optimal<=0 时直接返回 1，避免除 0；
   * - current 做非负钳制，避免 NaN/负值导致倍率异常。
   */
  private calcWageMultiplier(params: {
    optimalWorkers: number;
    currentWorkers: number;
  }): number {
    const optimal = params.optimalWorkers;
    if (optimal <= 0) return 1;

    const current = this.clampNonNegative(params.currentWorkers);
    return 1 + (optimal - current) / optimal;
  }

  /**
   * 划分劳动力市场状态，并计算供需比。
   * 过程：
   * 1) 先算最佳工人数 optimalWorkers；
   * 2) 供需比 ratio = currentWorkers / optimalWorkers（均做非负处理）；
   * 3) 用容忍区间划分状态（实现选择）：
   *    - ratio < 0.9  => 稀缺（scarce）
   *    - 0.9~1.1      => 平衡（balanced）
   *    - ratio > 1.1  => 过剩（surplus）
   * 边界处理：
   * - optimalWorkers<=0 时无法定义 ratio，直接返回 balanced 且 ratio=1。
   */
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

  /**
   * 佣金率映射：按劳动力市场状态决定直邀佣金率。
   * - 稀缺：更高佣金（鼓励拉新/招工）
   * - 过剩：更低佣金（控制成本）
   * - 平衡：标准佣金
   */
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

  /**
   * 计算直邀佣金。
   * 输入：直邀成员“首月工资数组”与佣金率。
   * 过程：
   * 1) 佣金率做非负钳制；
   * 2) 工资列表做健壮性处理：非有限值按 0，负数按 0；
   * 3) 直邀佣金 = 工资非负合计 * 佣金率。
   */
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

  /**
   * 计算团队奖金（按天结算）。
   * 规则：
   * 1) 只有在“当天最后一个 Tick”（currentTick % TICKS_PER_DAY === 0 且 >0）才结算；
   * 2) 且当日 invitesInCurrentDay >= TEAM_BONUS_INVITE_THRESHOLD 才发放 TEAM_BONUS_AMOUNT；
   * 3) 否则返回 0。
   */
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

  /**
   * 非负钳制工具函数。
   * - 非有限值（NaN/Infinity）统一按 0 处理；
   * - 其余数值取 max(v, 0)。
   */
  private clampNonNegative(v: number): number {
    if (!Number.isFinite(v)) return 0;
    return Math.max(0, v);
  }
}
