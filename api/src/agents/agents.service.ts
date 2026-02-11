import { Inject, Injectable } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { UsersService } from '../users/users.service';
import { throwIfSupabaseError } from '../supabase/supabase.errors';
import { SUPABASE_CLIENT } from '../supabase/supabase.constants';
import { Agent, AgentIdentity } from './agent.entity';

export interface RankUser {
  name: string;
  avatar: string;
  income: number;
}

export interface MeTransaction {
  type: string;
  tick: number;
  amount: number;
}

type AgentRow = {
  id: string;
  user_id: string;
  identity: AgentIdentity;
  interest_tags: string[] | null;
  current_income: number | string | null;
  working_hours: number | string | null;
  current_tick: number | string | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

@Injectable()
export class AgentsService {
  constructor(
    @Inject(SUPABASE_CLIENT)
    private readonly supabase: SupabaseClient,
    private readonly usersService: UsersService,
  ) {}

  async findOneByUserId(userId: string): Promise<Agent | null> {
    const res = await this.supabase
      .from('agents')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    throwIfSupabaseError(res.error, 'agents.findOneByUserId');
    const row = res.data as AgentRow | null;
    return row
      ? {
          id: row.id,
          userId: row.user_id,
          user: null,
          identity: row.identity,
          interestTags: row.interest_tags ?? [],
          currentIncome: Number(row.current_income ?? 0),
          workingHours: Number(row.working_hours ?? 0),
          currentTick: Number(row.current_tick ?? 0),
          isActive: Boolean(row.is_active),
          createdAt: row.created_at ? new Date(row.created_at) : null,
          updatedAt: row.updated_at ? new Date(row.updated_at) : null,
        }
      : null;
  }

  async findOne(id: string): Promise<Agent | null> {
    const res = await this.supabase
      .from('agents')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    throwIfSupabaseError(res.error, 'agents.findOne');
    const row = res.data as AgentRow | null;
    return row
      ? {
          id: row.id,
          userId: row.user_id,
          user: null,
          identity: row.identity,
          interestTags: row.interest_tags ?? [],
          currentIncome: Number(row.current_income ?? 0),
          workingHours: Number(row.working_hours ?? 0),
          currentTick: Number(row.current_tick ?? 0),
          isActive: Boolean(row.is_active),
          createdAt: row.created_at ? new Date(row.created_at) : null,
          updatedAt: row.updated_at ? new Date(row.updated_at) : null,
        }
      : null;
  }

  async createDefaultAgent(userId: string): Promise<Agent> {
    const res = await this.supabase
      .from('agents')
      .insert({
        user_id: userId,
        identity: AgentIdentity.LAYFLAT, // 默认身份为躺平者，后续可由 Agent 自行决策改变。
        current_income: 0,
        working_hours: 0,
        current_tick: 0,
        interest_tags: [],
        is_active: true,
      })
      .select('*')
      .single();
    throwIfSupabaseError(res.error, 'agents.createDefaultAgent');
    const row = res.data as AgentRow;
    return {
      id: row.id,
      userId: row.user_id,
      user: null,
      identity: row.identity,
      interestTags: row.interest_tags ?? [],
      currentIncome: Number(row.current_income ?? 0),
      workingHours: Number(row.working_hours ?? 0),
      currentTick: Number(row.current_tick ?? 0),
      isActive: Boolean(row.is_active),
      createdAt: row.created_at ? new Date(row.created_at) : null,
      updatedAt: row.updated_at ? new Date(row.updated_at) : null,
    };
  }

  async getRank(
    userId: string,
    limit = 10,
  ): Promise<{ list: RankUser[]; myRank: number }> {
    const safeLimit =
      Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 10;

    const res = await this.supabase
      .from('agents')
      .select('*')
      .eq('is_active', true)
      .order('current_income', { ascending: false })
      .limit(safeLimit);

    throwIfSupabaseError(res.error, 'agents.getRank');
    const rows = (res.data ?? []) as AgentRow[];

    const top = rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      currentIncome: Number(row.current_income ?? 0),
    }));

    let list: RankUser[] = [];
    if (top.length > 0) {
      const userIds = top.map((agent) => agent.userId);
      const users = await this.usersService.findIn(userIds);

      list = top.map((agent) => {
        const user = users.find((u) => u.id === agent.userId);
        return {
          name: user?.name || '',
          avatar: user?.metadata?.avatar || '',
          income: agent.currentIncome,
        };
      });
    }

    let myRank = 0;
    const agent = await this.findOneByUserId(userId);
    if (agent) {
      const rankRes = await this.supabase
        .from('agents')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)
        .gt('current_income', agent.currentIncome);

      if (!rankRes.error) {
        myRank = (rankRes.count ?? 0) + 1;
      }
    }

    return { list, myRank };
  }

  async getActiveAgents(): Promise<Agent[]> {
    const res = await this.supabase
      .from('agents')
      .select('*')
      .eq('is_active', true);
    throwIfSupabaseError(res.error, 'agents.getActiveAgents');
    const rows = (res.data ?? []) as AgentRow[];
    return rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      user: null,
      identity: row.identity,
      interestTags: row.interest_tags ?? [],
      currentIncome: Number(row.current_income ?? 0),
      workingHours: Number(row.working_hours ?? 0),
      currentTick: Number(row.current_tick ?? 0),
      isActive: Boolean(row.is_active),
      createdAt: row.created_at ? new Date(row.created_at) : null,
      updatedAt: row.updated_at ? new Date(row.updated_at) : null,
    }));
  }

  async getLatestActiveLayflatAgents(limit = 5): Promise<Agent[]> {
    const safeLimit =
      Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 5;
    const res = await this.supabase
      .from('agents')
      .select('*')
      .eq('is_active', true)
      .eq('identity', AgentIdentity.LAYFLAT)
      .order('updated_at', { ascending: false })
      .limit(safeLimit);
    throwIfSupabaseError(res.error, 'agents.getLatestActiveLayflatAgents');
    const rows = (res.data ?? []) as AgentRow[];
    return rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      user: null,
      identity: row.identity,
      interestTags: row.interest_tags ?? [],
      currentIncome: Number(row.current_income ?? 0),
      workingHours: Number(row.working_hours ?? 0),
      currentTick: Number(row.current_tick ?? 0),
      isActive: Boolean(row.is_active),
      createdAt: row.created_at ? new Date(row.created_at) : null,
      updatedAt: row.updated_at ? new Date(row.updated_at) : null,
    }));
  }

  async update(id: string, data: Partial<Agent>): Promise<Agent | null> {
    const payload: Record<string, unknown> = {};
    if (data.userId) payload.user_id = data.userId;
    if (data.identity) payload.identity = data.identity;
    if (data.interestTags) payload.interest_tags = data.interestTags;
    if (data.currentIncome !== undefined)
      payload.current_income = data.currentIncome;
    if (data.workingHours !== undefined)
      payload.working_hours = data.workingHours;
    if (data.currentTick !== undefined) payload.current_tick = data.currentTick;
    if (data.isActive !== undefined) payload.is_active = data.isActive;

    const res = await this.supabase
      .from('agents')
      .update(payload)
      .eq('id', id)
      .select('*')
      .maybeSingle();
    throwIfSupabaseError(res.error, 'agents.update');
    const row = res.data as AgentRow | null;
    return row
      ? {
          id: row.id,
          userId: row.user_id,
          user: null,
          identity: row.identity,
          interestTags: row.interest_tags ?? [],
          currentIncome: Number(row.current_income ?? 0),
          workingHours: Number(row.working_hours ?? 0),
          currentTick: Number(row.current_tick ?? 0),
          isActive: Boolean(row.is_active),
          createdAt: row.created_at ? new Date(row.created_at) : null,
          updatedAt: row.updated_at ? new Date(row.updated_at) : null,
        }
      : null;
  }

  async getMeTransactions(agentId: string): Promise<MeTransaction[]> {
    const res = await this.supabase
      .from('transactions')
      .select('reason, tick_number, amount, created_at')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(10);

    throwIfSupabaseError(res.error, 'agents.getMeTransactions');

    const rows = (res.data ?? []) as {
      reason: string | null;
      tick_number: number;
      amount: number;
    }[];

    return rows.map((row) => ({
      type: row.reason || '',
      tick: Number(row.tick_number),
      amount: Number(row.amount),
    }));
  }
}
