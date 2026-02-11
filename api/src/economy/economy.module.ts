import { Module } from '@nestjs/common';
import { EconomyService } from './economy.service';
import { IncomeService } from './income.service';
import { AgentsModule } from '../agents/agents.module';

@Module({
  imports: [AgentsModule],
  providers: [EconomyService, IncomeService],
  exports: [EconomyService, IncomeService],
})
export class EconomyModule {}
