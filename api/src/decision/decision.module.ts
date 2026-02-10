import { Module } from '@nestjs/common';
import { AgentDecisionService } from './decision.service';
import { ChatModule } from '../chat/chat.module';
import { AgentsModule } from '../agents/agents.module';
import { EconomyModule } from '../economy/economy.module';

@Module({
  imports: [ChatModule, AgentsModule, EconomyModule],
  providers: [AgentDecisionService],
  exports: [AgentDecisionService],
})
export class DecisionModule {}
