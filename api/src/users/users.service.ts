import { Inject, Injectable } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { throwIfSupabaseError } from '../supabase/supabase.errors';
import { SUPABASE_CLIENT } from '../supabase/supabase.constants';
import { User } from './user.entity';

type UserRow = {
  id: string;
  secondme_id: string;
  email: string;
  name: string;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
};

@Injectable()
export class UsersService {
  constructor(
    @Inject(SUPABASE_CLIENT)
    private readonly supabase: SupabaseClient,
  ) {}

  async findBySecondMeId(secondmeId: string): Promise<User | null> {
    const res = await this.supabase
      .from('users')
      .select('*')
      .eq('secondme_id', secondmeId)
      .maybeSingle();
    throwIfSupabaseError(res.error, 'users.findBySecondMeId');
    const row = res.data as UserRow | null;
    return row
      ? {
          id: row.id,
          secondmeId: row.secondme_id,
          email: row.email,
          name: row.name,
          metadata: row.metadata ?? {},
          createdAt: row.created_at ? new Date(row.created_at) : null,
          updatedAt: row.updated_at ? new Date(row.updated_at) : null,
          agents: [],
        }
      : null;
  }

  async findOne(id: string): Promise<User | null> {
    const res = await this.supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    throwIfSupabaseError(res.error, 'users.findOne');
    const row = res.data as UserRow | null;
    return row
      ? {
          id: row.id,
          secondmeId: row.secondme_id,
          email: row.email,
          name: row.name,
          metadata: row.metadata ?? {},
          createdAt: row.created_at ? new Date(row.created_at) : null,
          updatedAt: row.updated_at ? new Date(row.updated_at) : null,
          agents: [],
        }
      : null;
  }

  async create(userData: Partial<User>): Promise<User> {
    const payload: Record<string, unknown> = {};
    if (userData.id) payload.id = userData.id;
    if (userData.secondmeId) payload.secondme_id = userData.secondmeId;
    if (userData.email) payload.email = userData.email;
    if (userData.name) payload.name = userData.name;
    if (userData.metadata) payload.metadata = userData.metadata;

    const res = await this.supabase
      .from('users')
      .insert(payload)
      .select('*')
      .single();
    throwIfSupabaseError(res.error, 'users.create');
    const row = res.data as UserRow;
    return {
      id: row.id,
      secondmeId: row.secondme_id,
      email: row.email,
      name: row.name,
      metadata: row.metadata ?? {},
      createdAt: row.created_at ? new Date(row.created_at) : null,
      updatedAt: row.updated_at ? new Date(row.updated_at) : null,
      agents: [],
    };
  }

  async update(id: string, userData: Partial<User>): Promise<User | null> {
    const payload: Record<string, unknown> = {};
    if (userData.secondmeId) payload.secondme_id = userData.secondmeId;
    if (userData.email) payload.email = userData.email;
    if (userData.name) payload.name = userData.name;
    if (userData.metadata) payload.metadata = userData.metadata;

    const res = await this.supabase
      .from('users')
      .update(payload)
      .eq('id', id)
      .select('*')
      .maybeSingle();
    throwIfSupabaseError(res.error, 'users.update');
    const row = res.data as UserRow | null;
    return row
      ? {
          id: row.id,
          secondmeId: row.secondme_id,
          email: row.email,
          name: row.name,
          metadata: row.metadata ?? {},
          createdAt: row.created_at ? new Date(row.created_at) : null,
          updatedAt: row.updated_at ? new Date(row.updated_at) : null,
          agents: [],
        }
      : null;
  }
}
