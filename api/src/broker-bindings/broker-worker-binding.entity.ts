import { Agent } from '../agents/agent.entity';

export class BrokerWorkerBinding {
  id: string;
  brokerAgentId: string;
  brokerAgent: Agent | null;
  workerAgentId: string;
  workerAgent: Agent | null;
  decisionReason: string | null;
  createdAt: Date | null;
}
