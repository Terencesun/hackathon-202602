import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AgentsModule } from './agents/agents.module';
import { TransactionsModule } from './transactions/transactions.module';
import { ChatModule } from './chat/chat.module';
import { DecisionModule } from './decision/decision.module';
import { EconomyModule } from './economy/economy.module';
import { TickModule } from './tick/tick.module';
import { SupabaseModule } from './supabase/supabase.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../.env', '.env'], // 同时在仓库根目录与 api 根目录中查找。
    }),
    ScheduleModule.forRoot(),
    SupabaseModule,
    AuthModule,
    UsersModule,
    TransactionsModule,
    AgentsModule,
    ChatModule,
    DecisionModule,
    EconomyModule,
    TickModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
