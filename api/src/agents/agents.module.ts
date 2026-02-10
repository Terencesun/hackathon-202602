import { Module } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { AgentController } from './agents.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  providers: [AgentsService],
  controllers: [AgentController],
  exports: [AgentsService],
})
export class AgentsModule {}
