import { Inject, Injectable } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.constants';
import { throwIfSupabaseError } from '../supabase/supabase.errors';
import { BrokerWorkerBinding } from './broker-worker-binding.entity';

type BrokerWorkerBindingRow = {
  id: string;
  broker_agent_id: string;
  worker_agent_id: string;
  decision_reason: string | null;
  created_at: string | null;
};

@Injectable()
export class BrokerBindingsService {
  constructor(
    @Inject(SUPABASE_CLIENT)
    private readonly supabase: SupabaseClient,
  ) {}

  async removeRelFromWorker(workerAgentId: string): Promise<void> {
    const res = await this.supabase
      .from('broker_worker_bindings')
      .delete()
      .eq('worker_agent_id', workerAgentId);
    throwIfSupabaseError(res.error, 'brokerBindings.removeRelFromWorker');
  }

  async removeRelFromBroker(brokerAgentId: string): Promise<void> {
    const res = await this.supabase
      .from('broker_worker_bindings')
      .delete()
      .eq('broker_agent_id', brokerAgentId);
    throwIfSupabaseError(res.error, 'brokerBindings.removeRelFromBroker');
  }

  async findLatestByWorkerAgentId(
    workerAgentId: string,
  ): Promise<BrokerWorkerBinding | null> {
    const res = await this.supabase
      .from('broker_worker_bindings')
      .select('*')
      .eq('worker_agent_id', workerAgentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    throwIfSupabaseError(res.error, 'brokerBindings.findLatestByWorkerAgentId');
    const row = res.data as BrokerWorkerBindingRow | null;
    return row
      ? {
          id: row.id,
          brokerAgentId: row.broker_agent_id,
          brokerAgent: null,
          workerAgentId: row.worker_agent_id,
          workerAgent: null,
          decisionReason: row.decision_reason ?? null,
          createdAt: row.created_at ? new Date(row.created_at) : null,
        }
      : null;
  }

  async createBinding(params: {
    brokerAgentId: string;
    workerAgentId: string;
    decisionReason?: string | null;
  }): Promise<BrokerWorkerBinding | null> {
    const res = await this.supabase
      .from('broker_worker_bindings')
      .insert({
        broker_agent_id: params.brokerAgentId,
        worker_agent_id: params.workerAgentId,
        decision_reason: params.decisionReason ?? null,
      })
      .select('*')
      .single();

    if (res.error) {
      const anyErr = res.error as { code?: string };
      if (anyErr?.code === '23505') return null;
      throwIfSupabaseError(res.error, 'brokerBindings.createBinding');
    }

    const row = res.data as BrokerWorkerBindingRow | null;
    return row
      ? {
          id: row.id,
          brokerAgentId: row.broker_agent_id,
          brokerAgent: null,
          workerAgentId: row.worker_agent_id,
          workerAgent: null,
          decisionReason: row.decision_reason ?? null,
          createdAt: row.created_at ? new Date(row.created_at) : null,
        }
      : null;
  }
}
