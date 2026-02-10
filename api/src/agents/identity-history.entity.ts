import { Agent } from './agent.entity';

export class IdentityHistory {
  id: string;
  agentId: string;
  agent: Agent | null;
  oldIdentity: string | null;
  newIdentity: string;
  decisionReason: any;
  tickNumber: number;
  createdAt: Date | null;
}
