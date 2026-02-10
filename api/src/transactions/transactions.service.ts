import { Inject, Injectable } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { throwIfSupabaseError } from '../supabase/supabase.errors';
import { SUPABASE_CLIENT } from '../supabase/supabase.constants';
import { Transaction } from './transaction.entity';
import { IncomeRecord } from './income-record.entity';
import { AgentsService } from '../agents/agents.service';

type TransactionRow = {
  id: string;
  agent_id: string;
  type: string;
  amount: number | string;
  reason: string;
  tick_number: number | string;
  created_at: string | null;
};

type IncomeRecordRow = {
  id: string;
  agent_id: string;
  income_type: string;
  amount: number | string;
  metadata: Record<string, unknown> | null;
  tick_number: number | string;
  created_at: string | null;
};

@Injectable()
export class TransactionsService {
  constructor(
    @Inject(SUPABASE_CLIENT)
    private readonly supabase: SupabaseClient,
    private agentsService: AgentsService,
  ) {}

  async createTransaction(
    agentId: string,
    type: string,
    amount: number,
    reason: string,
    tickNumber: number,
  ): Promise<Transaction> {
    const res = await this.supabase
      .from('transactions')
      .insert({
        agent_id: agentId,
        type,
        amount,
        reason,
        tick_number: tickNumber,
      })
      .select('*')
      .single();
    throwIfSupabaseError(res.error, 'transactions.createTransaction');

    // 更新 Agent 余额。
    const agent = await this.agentsService.findOne(agentId);
    if (agent) {
      const newBalance = Number(agent.currentIncome) + Number(amount);
      await this.agentsService.update(agentId, { currentIncome: newBalance });
    }

    const row = res.data as TransactionRow;
    return {
      id: row.id,
      agentId: row.agent_id,
      agent: null,
      type: row.type,
      amount: Number(row.amount),
      reason: row.reason,
      tickNumber: Number(row.tick_number),
      createdAt: row.created_at ? new Date(row.created_at) : null,
    };
  }

  async recordIncome(
    agentId: string,
    incomeType: string,
    amount: number,
    tickNumber: number,
    metadata: Record<string, unknown> = {},
  ): Promise<IncomeRecord> {
    const res2 = await this.supabase
      .from('income_records')
      .insert({
        agent_id: agentId,
        income_type: incomeType,
        amount,
        tick_number: tickNumber,
        metadata,
      })
      .select('*')
      .single();
    throwIfSupabaseError(res2.error, 'transactions.recordIncome');
    const row2 = res2.data as IncomeRecordRow;
    return {
      id: row2.id,
      agentId: row2.agent_id,
      agent: null,
      incomeType: row2.income_type,
      amount: Number(row2.amount),
      metadata: row2.metadata ?? {},
      tickNumber: Number(row2.tick_number),
      createdAt: row2.created_at ? new Date(row2.created_at) : null,
    };
  }
}
