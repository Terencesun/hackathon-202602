import { Module } from '@nestjs/common';
import { AgentDecisionService } from './decision.service';
import { ChatModule } from '../chat/chat.module';
import { AgentsModule } from '../agents/agents.module';
import { EconomyModule } from '../economy/economy.module';
import { BrokerBindingsModule } from '../broker-bindings/broker-bindings.module';

@Module({
  imports: [ChatModule, AgentsModule, EconomyModule, BrokerBindingsModule],
  providers: [AgentDecisionService],
  exports: [AgentDecisionService],
})
export class DecisionModule {}
