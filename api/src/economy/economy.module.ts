import { Module } from '@nestjs/common';
import { EconomyService } from './economy.service';
import { AgentsModule } from '../agents/agents.module';

@Module({
  imports: [AgentsModule],
  providers: [EconomyService],
  exports: [EconomyService],
})
export class EconomyModule {}
