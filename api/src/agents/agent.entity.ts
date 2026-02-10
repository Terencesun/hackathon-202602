import { User } from '../users/user.entity';

export enum AgentIdentity {
  WORKER = 'worker',
  BROKER = 'broker',
  LAYFLAT = 'layflat',
}

export class Agent {
  id: string;
  userId: string;
  user: User | null;
  identity: AgentIdentity;
  interestTags: string[];
  currentIncome: number;
  workingHours: number;
  currentTick: number;
  isActive: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
}
