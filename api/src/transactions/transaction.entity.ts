import { Agent } from '../agents/agent.entity';

export enum TransactionType {
  SALARY = 'salary',
  COMMISSION = 'commission',
  RENT = 'rent',
  FOOD = 'food',
  BROKER_COST = 'broker_cost',
  LAYFLAT_COST = 'layflat_cost',
}

export class Transaction {
  id: string;
  agentId: string;
  agent: Agent | null;
  type: string;
  amount: number;
  reason: string | null;
  tickNumber: number;
  createdAt: Date | null;
}
