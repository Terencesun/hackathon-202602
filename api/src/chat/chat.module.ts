import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { AgentsModule } from '../agents/agents.module';
import { UsersModule } from '../users/users.module';
import { SecondmeModule } from '../secondme/secondme.module';

@Module({
  imports: [SecondmeModule, AgentsModule, UsersModule],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
