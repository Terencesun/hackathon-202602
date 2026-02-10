import { Module } from '@nestjs/common';
import { TickService } from './tick.service';
import { AgentsModule } from '../agents/agents.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { DecisionModule } from '../decision/decision.module';
import { EconomyModule } from '../economy/economy.module';

@Module({
  imports: [AgentsModule, TransactionsModule, DecisionModule, EconomyModule],
  providers: [TickService],
})
export class TickModule {}
