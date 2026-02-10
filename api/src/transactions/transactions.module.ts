import { Module } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { AgentsModule } from '../agents/agents.module';

@Module({
  imports: [AgentsModule],
  providers: [TransactionsService],
  exports: [TransactionsService],
})
export class TransactionsModule {}
