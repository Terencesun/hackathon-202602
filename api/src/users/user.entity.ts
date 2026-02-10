import { Agent } from '../agents/agent.entity';

export type UserMetadata = {
  accessToken?: string;
  refreshToken?: string;
  avatar?: string;
  [key: string]: unknown;
};

export class User {
  id: string;
  secondmeId: string;
  email: string;
  name: string;
  metadata: UserMetadata;
  createdAt: Date | null;
  updatedAt: Date | null;
  agents?: Agent[];
}
