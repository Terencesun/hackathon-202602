import { Injectable } from '@nestjs/common';
import { AgentsService } from '../agents/agents.service';
import { AgentIdentity } from '../agents/agent.entity';

export type SystemStats = {
  total_agents: number;
  worker_ratio: number;
  broker_ratio: number;
  layflat_ratio: number;
};

const ACCIDENTS = [
  {
    name: '突发疾病',
    description: '突发身体不适，需要支付医疗费用',
    ratio: 0.3,
  },
  {
    name: '设备故障',
    description: '关键设备损坏，需要支付维修费用',
    ratio: 0.2,
  },
  { name: '违规罚款', description: '因操作不当被处以罚款', ratio: 0.15 },
  { name: '遭遇盗窃', description: '不幸遭遇盗窃，损失部分财物', ratio: 0.25 },
  { name: '投资失利', description: '小额投资失败，造成资金损失', ratio: 0.1 },
  { name: '强制社交', description: '不得不参加的昂贵社交活动', ratio: 0.05 },
];

@Injectable()
export class EconomyService {
  constructor(private agentsService: AgentsService) {}

  async getSystemStats(): Promise<SystemStats> {
    const agents = await this.agentsService.getActiveAgents();
    const total = agents.length;
    if (total === 0)
      return {
        total_agents: 0,
        worker_ratio: 0,
        broker_ratio: 0,
        layflat_ratio: 0,
      };

    const workers = agents.filter(
      (a) => a.identity === AgentIdentity.WORKER,
    ).length;
    const brokers = agents.filter(
      (a) => a.identity === AgentIdentity.BROKER,
    ).length;
    const layflats = agents.filter(
      (a) => a.identity === AgentIdentity.LAYFLAT,
    ).length;

    return {
      total_agents: total,
      worker_ratio: workers / total,
      broker_ratio: brokers / total,
      layflat_ratio: layflats / total,
    };
  }

  // 成本定义。
  getLivingCosts(identity: AgentIdentity) {
    switch (identity) {
      case AgentIdentity.WORKER:
        return { rent: 0.8, food: 1.2 };
      case AgentIdentity.BROKER:
        return { office: 2.0, food: 1.2 }; // Broker 需要支付办公室+餐饮？PRD 说“Broker 办公室成本 2.0”。餐饮 1.2 是通用成本吗？
      // PRD 5.3：
      // Worker：房租 0.8，餐饮 1.2。
      // Layflat：基础 0.6（餐饮/房租合并？不，PRD 写的是“Layflat 基础生活 0.6”）。
      // Broker：办公室 2.0。（还要加餐饮？PRD 写“餐饮成本 1.2…必须花”。Broker 需要吃饭吗？是的，所有 agent 都要吃。）
      // 因此 Broker：办公室 2.0 + 餐饮 1.2。
      // Layflat：总计 0.6？还是 0.6 + 1.2？
      // PRD：“Layflat 基础生活 0.6…没有收入但支出最低”。
      // “餐饮成本…必须花”。
      // 先假设 Layflat 是特殊情况：总计 0.6。
      case AgentIdentity.LAYFLAT:
        return { basic: 0.6 };
      default:
        return { food: 1.2 };
    }
    // PRD 写道：“餐饮成本…1.2…必须花”。
    // “Layflat…0.6…没有收入但支出最低”。
    // “Worker…房租 0.8”。
    // 因此 Worker：0.8 + 1.2 = 2.0。
    // Broker：2.0 + 1.2 = 3.2。
    // Layflat：0.6（特殊情况）。
  }

  // 意外成本。
  /**
   * 计算意外成本
   * 在 tick 进行过程中突发意外，扣除当前 agent 一定比例的 income
   */
  calculateAccidentalCost(currentIncome: number) {
    // 假设有 5% 的概率发生意外
    if (Math.random() > 0.05) {
      return null;
    }

    const accident = ACCIDENTS[Math.floor(Math.random() * ACCIDENTS.length)];
    // 按照收入的绝对值计算扣除额
    const cost = Math.abs(currentIncome) * accident.ratio;

    return {
      name: accident.name,
      description: accident.description,
      cost: cost,
    };
  }
}
