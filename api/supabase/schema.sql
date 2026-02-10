create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  secondme_id text unique not null,
  email text not null,
  name text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  identity text not null default 'worker',
  interest_tags jsonb not null default '[]'::jsonb,
  current_income numeric(10,2) not null default 0,
  working_hours int not null default 0,
  current_tick int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agents_identity_check check (identity in ('worker','broker','layflat'))
);

create index if not exists idx_agents_user_id on public.agents(user_id);

create table if not exists public.identity_history (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  old_identity text null,
  new_identity text not null,
  decision_reason jsonb null,
  tick_number int not null,
  created_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  type text not null,
  amount numeric(10,2) not null,
  reason text null,
  tick_number int not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_transactions_agent_id on public.transactions(agent_id);

create table if not exists public.income_records (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  income_type text not null,
  amount numeric(10,2) not null,
  metadata jsonb not null default '{}'::jsonb,
  tick_number int not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_income_records_agent_id on public.income_records(agent_id);
