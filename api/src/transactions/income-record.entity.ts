import { Agent } from '../agents/agent.entity';

export class IncomeRecord {
  id: string;
  agentId: string;
  agent: Agent | null;
  incomeType: string;
  amount: number;
  metadata: Record<string, unknown>;
  tickNumber: number;
  createdAt: Date | null;
}
