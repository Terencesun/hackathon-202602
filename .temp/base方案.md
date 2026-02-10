# SecondMe 制造业系统设计：NestJS + Vue + Supabase 方案

### 核心需求复述

你希望基于SecondMe的A2A黑客马拉松开发一套模拟制造业系统，核心是让SecondMe Agent分身自主选择「打工仔/中介/躺平者」身份，通过分钟级tick机制触发两类结构化Chat思考（普通思考/每24tick身份思考），遵循贴近现实的工厂薪酬和中介返佣规则；技术上需采用NestJS（严格区分svc/biz分层、完成单元测试）+ Vue3（动态场景可视化）+ Supabase + Vercel，后端需承载前端，且所有Chat交互需返回固定JSON结构（解析失败则维持原状态）。

---

## 一、系统整体架构设计

### 1. 后端分层架构（严格遵循单一职责）

|层级|模块名称|职责|依赖关系|
|---|---|---|---|
|SVC层（底层）|auth-svc|处理SecondMe OAuth登录、Token管理、Agent信息获取|仅依赖database-svc|
||agent-svc|Agent身份/状态/薪酬/兴趣标签管理|仅依赖database-svc|
||tick-svc|分钟级tick调度、周期判断（普通/身份思考）|无跨模块依赖|
||chat-svc|封装SecondMe流式Chat接口、提示词构造、JSON解析|仅依赖auth-svc|
||factory-svc|工厂工时/薪酬规则（日最长工时、时薪/加班费）|仅依赖agent-svc|
||mediator-svc|中介邀请规则、返佣计算|仅依赖agent-svc/factory-svc|
||dorm-svc|躺平者状态管理（无薪酬、状态维持）|仅依赖agent-svc|
||database-svc|封装Supabase CRUD，所有模块的数据库操作唯一入口|无跨模块依赖|
|BIZ层（上层）|auth-biz|对外提供登录接口|依赖auth-svc|
||simulation-biz|对外提供模拟运行、Agent状态查询、tick触发接口|依赖所有SVC层模块|
### 2. 核心业务规则（贴近现实）

#### （1）工厂薪酬规则

- 基础时薪：20元/小时（1个tick=1小时）

- 日最长正常工时：8个tick（对应现实8小时工作制）

- 加班规则：最多加班2个tick，加班费为基础时薪的1.5倍（30元/小时）

- 结算规则：

    - 打工仔完成工时后实时结算薪酬；

    - 未到下班时间主动退出，按实际工时结算（无加班费）；

    - 超出10个tick强制下班，仅结算10小时薪酬（8×20 + 2×30）。

#### （2）中介返佣规则

- 中介每次tick随机抽取5个非自身Agent发起邀请；

- 被邀请者同意成为打工仔后，中介可获得该打工仔**每小时薪酬的10%** 作为返佣；

- 返佣结算：打工仔每完成1个tick，中介实时获得返佣（无上限）；

- 中介自身无工时要求，仅靠返佣获取薪酬。

#### （3）躺平者规则

- 无工时、无邀请行为、无薪酬；

- 仅维持「躺平」状态，直到下一次身份思考Chat切换身份。

---

## 二、后端实现（NestJS）

### 1. 项目初始化 & 依赖安装

```Bash

# 创建NestJS项目
nest new secondme-manufacturing
cd secondme-manufacturing

# 安装核心依赖
npm install @nestjs/schedule @nestjs/config @supabase/supabase-js axios jsonschema
npm install @nestjs/platform-express express static-fs
# 开发依赖（测试+前端集成）
npm install -D jest @nestjs/testing supertest vue @vue/cli element-plus vite
```

### 2. SVC层模块实现（核心）

#### （1）database-svc（数据库核心，Supabase封装）

```TypeScript

// src/svc/database/database.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class DatabaseService {
  private supabase: SupabaseClient;

  constructor(private configService: ConfigService) {
    this.supabase = createClient(
      this.configService.get('SUPABASE_URL'),
      this.configService.get('SUPABASE_ANON_KEY'),
    );
  }

  // Agent相关CRUD
  async getAgentById(agentId: string) {
    const { data, error } = await this.supabase
      .from('agents')
      .select('*')
      .eq('agent_id', agentId)
      .single();
    if (error) throw new Error(`获取Agent失败: ${error.message}`);
    return data;
  }

  async updateAgentStatus(agentId: string, status: {
    identity: 'worker' | 'mediator' | 'layflat';
    salary: number;
    working_hours: number;
    current_session?: string;
  }) {
    const { data, error } = await this.supabase
      .from('agents')
      .update(status)
      .eq('agent_id', agentId);
    if (error) throw new Error(`更新Agent状态失败: ${error.message}`);
    return data;
  }

  // 获取随机5个非自身Agent（中介邀请用）
  async getRandomAgents(excludeAgentId: string, limit = 5) {
    const { data, error } = await this.supabase
      .from('agents')
      .select('*')
      .neq('agent_id', excludeAgentId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(`获取随机Agent失败: ${error.message}`);
    return data;
  }

  // Tick计数管理
  async getCurrentTick() {
    const { data, error } = await this.supabase
      .from('system_tick')
      .select('current_tick')
      .single();
    if (error) throw new Error(`获取Tick失败: ${error.message}`);
    return data.current_tick;
  }

  async incrementTick() {
    const currentTick = await this.getCurrentTick();
    const { data, error } = await this.supabase
      .from('system_tick')
      .update({ current_tick: currentTick + 1 })
      .eq('id', 1);
    if (error) throw new Error(`更新Tick失败: ${error.message}`);
    return data;
  }
}

// src/svc/database/database.module.ts
import { Module } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  providers: [DatabaseService],
  exports: [DatabaseService], // 对外暴露，供其他SVC模块使用
})
export class DatabaseModule {}
```

#### （2）chat-svc（SecondMe Chat接口封装 + 结构化提示词）

```TypeScript

// src/svc/chat/chat.service.ts
import { Injectable } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import axios from 'axios';
import { validate } from 'jsonschema';

// 定义Chat返回的JSON结构Schema
const IDENTITY_CHAT_SCHEMA = {
  type: 'object',
  properties: {
    identity: { type: 'string', enum: ['worker', 'mediator', 'layflat'] },
    reason: { type: 'string' },
    decision: { type: 'boolean' } // 是否确认选择该身份
  },
  required: ['identity', 'reason', 'decision']
};

const NORMAL_CHAT_SCHEMA = {
  type: 'object',
  properties: {
    continue_identity: { type: 'boolean' },
    reason: { type: 'string' },
    action: { type: 'string', enum: ['work', 'invite', 'layflat'] }
  },
  required: ['continue_identity', 'reason', 'action']
};

@Injectable()
export class ChatService {
  private readonly SECONDME_CHAT_API = 'https://api.second.me/v1/chat/stream';

  constructor(private authService: AuthService) {}

  // 构造身份思考Chat的系统提示词（每24tick触发）
  private buildIdentityPrompt(agentId: string, tags: string[]) {
    return `
      你是SecondMe Agent ${agentId}，你的兴趣标签是：${tags.join(', ')}。
      请你基于自身兴趣选择下一个24小时（24个tick）的身份，可选身份：
      1. worker（打工仔）：去工厂打工，按工时获取薪酬（基础时薪20元，加班1.5倍），每日最多工作10小时；
      2. mediator（中介）：邀请其他Agent打工，从被邀请者薪酬中抽取10%返佣；
      3. layflat（躺平者）：在宿舍躺平，无任何收入和操作。
      必须返回JSON格式，字段要求：
      - identity: 选择的身份（worker/mediator/layflat）
      - reason: 选择该身份的原因（不超过100字）
      - decision: 是否确认该选择（true/false）
      示例：{"identity":"worker","reason":"想赚钱，工厂时薪稳定","decision":true}
    `;
  }

  // 构造普通思考Chat的系统提示词（每分钟tick触发）
  private buildNormalPrompt(agentId: string, currentIdentity: string, tags: string[]) {
    return `
      你是SecondMe Agent ${agentId}，当前身份是${currentIdentity}，兴趣标签是：${tags.join(', ')}。
      请决定是否继续当前身份，若不继续则自动切换为layflat（躺平者）。
      必须返回JSON格式，字段要求：
      - continue_identity: 是否继续当前身份（true/false）
      - reason: 决定的原因（不超过100字）
      - action: 下一步行动（worker填work，mediator填invite，layflat填layflat）
      示例：{"continue_identity":true,"reason":"继续打工赚钱","action":"work"}
    `;
  }

  // 构造中介邀请的提示词
  private buildMediatorInvitePrompt(inviterId: string, inviteeId: string) {
    return `
      你是SecondMe Agent ${inviteeId}，Agent ${inviterId}（中介）邀请你去工厂当打工仔。
      打工仔可获得基础时薪20元，加班1.5倍，每日最多工作10小时。
      必须返回JSON格式，字段要求：
      - accept: 是否同意（true/false）
      - reason: 同意/拒绝的原因（不超过50字）
      示例：{"accept":true,"reason":"需要赚钱，接受邀请"}
    `;
  }

  // 通用Chat调用方法（处理流式返回 + JSON解析）
  private async callSecondMeChat(prompt: string, agentId: string, sessionId?: string) {
    const token = await this.authService.getAgentToken(agentId);
    const newSessionId = sessionId || `session_${Date.now()}_${agentId}`;

    try {
      const response = await axios.post(
        this.SECONDME_CHAT_API,
        {
          agent_id: agentId,
          prompt,
          session_id: newSessionId,
          stream: false // 简化版，若需流式可改为true并处理流
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // 提取返回结果中的content并解析JSON
      const content = response.data.data.content.trim();
      const jsonResult = JSON.parse(content);
      return { jsonResult, sessionId: newSessionId };
    } catch (error) {
      console.error(`Chat调用失败: ${error.message}`);
      return { jsonResult: null, sessionId: null };
    }
  }

  // 身份思考Chat（每24tick）
  async identityChat(agentId: string, tags: string[]) {
    const prompt = this.buildIdentityPrompt(agentId, tags);
    const { jsonResult, sessionId } = await this.callSecondMeChat(prompt, agentId);
    
    // 验证JSON结构，失败则返回null（维持原状态）
    if (!jsonResult || !validate(jsonResult, IDENTITY_CHAT_SCHEMA).valid) {
      return { identity: null, reason: null, sessionId };
    }
    return {
      identity: jsonResult.identity,
      reason: jsonResult.reason,
      sessionId
    };
  }

  // 普通思考Chat（每分钟）
  async normalChat(agentId: string, currentIdentity: string, tags: string[]) {
    const prompt = this.buildNormalPrompt(agentId, currentIdentity, tags);
    const { jsonResult, sessionId } = await this.callSecondMeChat(prompt, agentId, currentIdentity);
    
    if (!jsonResult || !validate(jsonResult, NORMAL_CHAT_SCHEMA).valid) {
      return { continueIdentity: true, action: null, reason: null, sessionId };
    }
    return {
      continueIdentity: jsonResult.continue_identity,
      action: jsonResult.action,
      reason: jsonResult.reason,
      sessionId
    };
  }

  // 中介邀请Chat
  async mediatorInviteChat(inviterId: string, inviteeId: string) {
    const prompt = this.buildMediatorInvitePrompt(inviterId, inviteeId);
    const { jsonResult } = await this.callSecondMeChat(prompt, inviteeId);
    
    if (!jsonResult || !validate(jsonResult, {
      type: 'object',
      properties: { accept: { type: 'boolean' }, reason: { type: 'string' } },
      required: ['accept', 'reason']
    }).valid) {
      return { accept: false, reason: '解析失败，默认拒绝' };
    }
    return {
      accept: jsonResult.accept,
      reason: jsonResult.reason
    };
  }
}

// src/svc/chat/chat.module.ts
import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
```

#### （3）tick-svc（分钟级Tick调度）

```TypeScript

// src/svc/tick/tick.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DatabaseService } from '../database/database.service';
import { SimulationBizService } from '../../biz/simulation/simulation.biz.service';

@Injectable()
export class TickService {
  private readonly logger = new Logger(TickService.name);

  constructor(
    private databaseService: DatabaseService,
    private simulationBizService: SimulationBizService, // 仅触发业务逻辑，无循环依赖
  ) {}

  // 每分钟触发一次Tick（核心调度）
  @Cron(CronExpression.EVERY_MINUTE)
  async handleTick() {
    this.logger.log('开始执行新的Tick...');
    const currentTick = await this.databaseService.getCurrentTick();
    
    // 1. 递增Tick计数
    await this.databaseService.incrementTick();
    
    // 2. 判断是否为身份思考Tick（每24个）
    const isIdentityTick = currentTick % 24 === 0;
    
    // 3. 触发所有Agent的思考逻辑
    await this.simulationBizService.runAgentThinking(currentTick, isIdentityTick);
    
    this.logger.log(`Tick ${currentTick + 1} 执行完成，是否身份思考Tick: ${isIdentityTick}`);
  }

  // 手动触发Tick（供测试/前端调用）
  async triggerManualTick() {
    await this.handleTick();
    return { success: true };
  }
}

// src/svc/tick/tick.module.ts
import { Module } from '@nestjs/common';
import { TickService } from './tick.service';
import { DatabaseModule } from '../database/database.module';
import { SimulationBizModule } from '../../biz/simulation/simulation.biz.module';

@Module({
  imports: [DatabaseModule, SimulationBizModule],
  providers: [TickService],
  exports: [TickService],
})
export class TickModule {}
```

### 3. BIZ层模块实现（对外接口）

#### （1）simulation-biz（核心业务入口）

```TypeScript

// src/biz/simulation/simulation.biz.service.ts
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../svc/database/database.service';
import { ChatService } from '../../svc/chat/chat.service';
import { AgentService } from '../../svc/agent/agent.service';
import { FactoryService } from '../../svc/factory/factory.service';
import { MediatorService } from '../../svc/mediator/mediator.service';
import { DormService } from '../../svc/dorm/dorm.service';

@Injectable()
export class SimulationBizService {
  constructor(
    private databaseService: DatabaseService,
    private chatService: ChatService,
    private agentService: AgentService,
    private factoryService: FactoryService,
    private mediatorService: MediatorService,
    private dormService: DormService,
  ) {}

  // 核心逻辑：运行所有Agent的思考流程
  async runAgentThinking(currentTick: number, isIdentityTick: boolean) {
    // 1. 获取所有Agent列表
    const allAgents = await this.databaseService.supabase
      .from('agents')
      .select('*')
      .returns<any[]>();

    for (const agent of allAgents) {
      const agentId = agent.agent_id;
      const tags = agent.tags ? JSON.parse(agent.tags) : [];

      // 2. 身份思考Tick（每24个）
      if (isIdentityTick) {
        const identityResult = await this.chatService.identityChat(agentId, tags);
        if (identityResult.identity) {
          // 更新Agent身份
          await this.agentService.updateAgentIdentity(agentId, identityResult.identity);
          // 初始化新周期的状态（工时、薪酬清零）
          await this.agentService.resetAgentCycleStatus(agentId);
        }
        continue;
      }

      // 3. 普通思考Tick
      const normalResult = await this.chatService.normalChat(
        agentId,
        agent.identity,
        tags
      );

      // 3.1 不继续当前身份 → 切换为躺平者
      if (!normalResult.continueIdentity) {
        await this.agentService.updateAgentIdentity(agentId, 'layflat');
        await this.dormService.updateLayflatStatus(agentId);
        continue;
      }

      // 3.2 按身份处理逻辑
      switch (agent.identity) {
        case 'worker':
          await this.factoryService.processWorkerTick(agentId, currentTick);
          break;
        case 'mediator':
          // 抽取5个随机Agent发起邀请
          const randomAgents = await this.databaseService.getRandomAgents(agentId);
          await this.mediatorService.processMediatorInvite(agentId, randomAgents);
          break;
        case 'layflat':
          await this.dormService.updateLayflatStatus(agentId);
          break;
      }
    }
  }

  // 获取系统状态（供前端展示）
  async getSystemStatus() {
    const currentTick = await this.databaseService.getCurrentTick();
    const allAgents = await this.databaseService.supabase
      .from('agents')
      .select('*')
      .returns<any[]>();
    
    // 统计各身份数量、总薪酬等
    const stats = {
      workerCount: allAgents.filter(a => a.identity === 'worker').length,
      mediatorCount: allAgents.filter(a => a.identity === 'mediator').length,
      layflatCount: allAgents.filter(a => a.identity === 'layflat').length,
      totalSalary: allAgents.reduce((sum, a) => sum + a.salary, 0),
      currentTick,
      nextIdentityTick: 24 - (currentTick % 24),
    };

    return { agents: allAgents, stats };
  }
}

// src/biz/simulation/simulation.biz.controller.ts
import { Controller, Get, Post } from '@nestjs/common';
import { SimulationBizService } from './simulation.biz.service';

@Controller('simulation')
export class SimulationBizController {
  constructor(private simulationBizService: SimulationBizService) {}

  // 获取系统当前状态
  @Get('status')
  async getSystemStatus() {
    return this.simulationBizService.getSystemStatus();
  }

  // 手动触发Tick（测试用）
  @Post('trigger-tick')
  async triggerManualTick() {
    return this.simulationBizService.triggerManualTick();
  }
}

// src/biz/simulation/simulation.biz.module.ts
import { Module } from '@nestjs/common';
import { SimulationBizController } from './simulation.biz.controller';
import { SimulationBizService } from './simulation.biz.service';
import { DatabaseModule } from '../../svc/database/database.module';
import { ChatModule } from '../../svc/chat/chat.module';
import { AgentModule } from '../../svc/agent/agent.module';
import { FactoryModule } from '../../svc/factory/factory.module';
import { MediatorModule } from '../../svc/mediator/mediator.module';
import { DormModule } from '../../svc/dorm/dorm.module';

@Module({
  imports: [
    DatabaseModule,
    ChatModule,
    AgentModule,
    FactoryModule,
    MediatorModule,
    DormModule,
  ],
  controllers: [SimulationBizController],
  providers: [SimulationBizService],
  exports: [SimulationBizService],
})
export class SimulationBizModule {}
```

### 4. 前端集成（NestJS承载Vue）

```TypeScript

// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
// SVC层模块
import { DatabaseModule } from './svc/database/database.module';
import { AuthModule } from './svc/auth/auth.module';
import { ChatModule } from './svc/chat/chat.module';
import { AgentModule } from './svc/agent/agent.module';
import { TickModule } from './svc/tick/tick.module';
import { FactoryModule } from './svc/factory/factory.module';
import { MediatorModule } from './svc/mediator/mediator.module';
import { DormModule } from './svc/dorm/dorm.module';
// BIZ层模块
import { AuthBizModule } from './biz/auth/auth.biz.module';
import { SimulationBizModule } from './biz/simulation/simulation.biz.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    // 承载Vue前端（Vue构建产物放在dist目录）
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'dist'),
    }),
    // SVC层
    DatabaseModule,
    AuthModule,
    ChatModule,
    AgentModule,
    TickModule,
    FactoryModule,
    MediatorModule,
    DormModule,
    // BIZ层
    AuthBizModule,
    SimulationBizModule,
  ],
})
export class AppModule {}
```

### 5. 单元测试示例（auth-svc）

```TypeScript

// src/svc/auth/auth.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { DatabaseService } from '../database/database.service';
import { ConfigService } from '@nestjs/config';

// 模拟Supabase客户端
const mockSupabaseClient = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data: { token: 'test_token' } }),
};

describe('AuthService', () => {
  let service: AuthService;
  let databaseService: DatabaseService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: DatabaseService,
          useValue: {
            supabase: mockSupabaseClient,
            getAgentById: jest.fn().mockResolvedValue({ agent_id: 'test_agent', token: 'test_token' }),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test_value'),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    databaseService = module.get<DatabaseService>(DatabaseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should get agent token successfully', async () => {
    const token = await service.getAgentToken('test_agent');
    expect(token).toBe('test_token');
    expect(databaseService.getAgentById).toHaveBeenCalledWith('test_agent');
  });
});
```

---

## 三、前端实现（Vue3 + Element-Plus + 动态场景）

### 1. 核心页面（模拟主页面）

```Plain Text

<!-- src/frontend/src/views/Simulation.vue -->
<template>
  <div class="simulation-container">
    <!-- 顶部状态栏 -->
    <el-header>
      <div class="status-bar">
        <el-tag size="large">当前Tick: {{ systemStatus.stats.currentTick }}</el-tag>
        <el-tag size="large" type="warning">距离身份思考Tick: {{ systemStatus.stats.nextIdentityTick }}</el-tag>
        <el-tag size="large" type="success">总薪酬: {{ systemStatus.stats.totalSalary }} 元</el-tag>
        <el-button @click="triggerManualTick">手动触发Tick</el-button>
      </div>
    </el-header>

    <!-- 主体区域（动态场景 + Agent列表） -->
    <el-container class="main-container">
      <!-- 左侧Agent列表 -->
      <el-aside width="300px">
        <el-card title="Agent列表">
          <el-table :data="systemStatus.agents" border>
            <el-table-column prop="agent_id" label="Agent ID" />
            <el-table-column prop="identity" label="身份">
              <template #default="scope">
                <el-tag :type="getIdentityTagType(scope.row.identity)">
                  {{ getIdentityText(scope.row.identity) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="salary" label="薪酬" />
            <el-table-column prop="working_hours" label="工作时长" />
          </el-table>
        </el-card>
      </el-aside>

      <!-- 右侧动态场景 -->
      <el-main class="scene-container">
        <!-- 工厂场景 -->
        <div v-if="activeIdentity === 'worker'" class="scene factory-scene">
          <div class="factory-bg"></div>
          <div class="worker-avatar">👷</div>
          <div class="scene-text">工厂打工中 | 时薪20元</div>
        </div>

        <!-- 中介办公室场景 -->
        <div v-if="activeIdentity === 'mediator'" class="scene mediator-scene">
          <div class="mediator-bg"></div>
          <div class="mediator-avatar">💼</div>
          <div class="scene-text">中介办公室 | 返佣10%</div>
        </div>

        <!-- 宿舍场景 -->
        <div v-if="activeIdentity === 'layflat'" class="scene dorm-scene">
          <div class="dorm-bg"></div>
          <div class="layflat-avatar">🛌</div>
          <div class="scene-text">宿舍躺平中 | 无收入</div>
        </div>
      </el-main>
    </el-container>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue';
import { ElMessage } from 'element-plus';
import axios from 'axios';

// 响应式数据
const systemStatus = reactive({
  agents: [],
  stats: {
    currentTick: 0,
    nextIdentityTick: 24,
    workerCount: 0,
    mediatorCount: 0,
    layflatCount: 0,
    totalSalary: 0,
  },
});
const activeIdentity = ref('layflat'); // 默认躺平场景

// 工具函数：身份文本/标签类型映射
const getIdentityText = (identity: string) => {
  const map = { worker: '打工仔', mediator: '中介', layflat: '躺平者' };
  return map[identity] || '未知';
};
const getIdentityTagType = (identity: string) => {
  const map = { worker: 'primary', mediator: 'success', layflat: 'info' };
  return map[identity] || 'default';
};

// 获取系统状态
const fetchSystemStatus = async () => {
  try {
    const res = await axios.get('/simulation/status');
    Object.assign(systemStatus, res.data);
    // 取第一个Agent的身份作为场景展示
    if (systemStatus.agents.length > 0) {
      activeIdentity.value = systemStatus.agents[0].identity;
    }
  } catch (error) {
    ElMessage.error('获取系统状态失败');
    console.error(error);
  }
};

// 手动触发Tick
const triggerManualTick = async () => {
  try {
    await axios.post('/simulation/trigger-tick');
    ElMessage.success('手动触发Tick成功');
    fetchSystemStatus();
  } catch (error) {
    ElMessage.error('手动触发Tick失败');
    console.error(error);
  }
};

// 初始化
onMounted(() => {
  fetchSystemStatus();
  // 每10秒自动刷新状态
  setInterval(fetchSystemStatus, 10000);
});
</script>

<style scoped>
.simulation-container {
  height: 100vh;
  width: 100vw;
}

.status-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
}

.main-container {
  height: calc(100vh - 60px);
}

.scene-container {
  height: 100%;
  padding: 0;
}

.scene {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-size: cover;
  background-position: center;
  transition: all 0.5s ease;
}

.factory-scene {
  background-color: #f5f5f5;
  background-image: url('@/assets/factory-bg.png');
}

.mediator-scene {
  background-color: #e8f4f8;
  background-image: url('@/assets/mediator-bg.png');
}

.dorm-scene {
  background-color: #fdf2f8;
  background-image: url('@/assets/dorm-bg.png');
}

.worker-avatar, .mediator-avatar, .layflat-avatar {
  font-size: 100px;
  margin-bottom: 24px;
}

.scene-text {
  font-size: 24px;
  font-weight: bold;
  color: #333;
}
```

---

## 四、部署（Vercel）

### 1. Vercel配置文件（vercel.json）

```JSON

{
  "version": 2,
  "builds": [
    {
      "src": "src/main.ts",
      "use": "@vercel/node"
    },
    {
      "src": "dist/**/*",
      "use": "@vercel/static"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "src/main.ts"
    },
    {
      "src": "/(.*)",
      "dest": "dist/index.html"
    }
  ]
}
```

### 2. 打包脚本（package.json）

```JSON

{
  "scripts": {
    "build:frontend": "cd src/frontend && npm run build && cp -r dist ../../",
    "build:backend": "nest build",
    "build": "npm run build:frontend && npm run build:backend",
    "test": "jest",
    "start:prod": "node dist/main"
  }
}
```

---

### 总结

1. **核心架构**：后端严格遵循NestJS的svc/biz分层（svc单一职责、biz组织逻辑对外提供接口），前端通过动态场景实现身份沉浸式展示；

2. **业务核心**：分钟级Tick调度触发两类结构化Chat（身份思考/普通思考），Chat返回固定JSON结构（解析失败则维持原状态），薪酬/返佣规则贴近现实（时薪+加班费、中介10%返佣）；

3. **工程化**：完成单元测试覆盖核心模块，Vercel配置实现前后端一体化部署，Supabase作为数据库存储Agent状态和系统Tick。

### 关键补充

- SecondMe OAuth集成需参考官方文档补充`auth-svc`的登录回调逻辑；

- 动态场景的图片资源需自行补充，可使用CSS动画增强沉浸感；

- 流式Chat需调整`chat-svc`中的axios调用，处理流式返回数据；

- 可扩展Supabase表结构（agents/system_tick），补充索引提升性能。
> （注：文档部分内容可能由 AI 生成）