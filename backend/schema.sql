create extension if not exists "pgcrypto";
-- creating table leads
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  owner_id uuid not null,
  email text,
  phone text,
  full_name text,
  stage text not null default 'new',
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- creating index for the leads table
create index if not exists idx_leads_tenant on public.leads(tenant_id);
create index if not exists idx_leads_owner on public.leads(owner_id);
create index if not exists idx_leads_stage on public.leads(stage);
create index if not exists idx_leads_created on public.leads(created_at);

-- creating application table
create table if not exists public.applications(
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  lead_id uuid not null references public.leads(id) on delete cascade,
  program_id uuid,
  intake_id uuid,
  stage text not null default 'inquiry',
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- creating indexes for application table
create index if not exists idx_applications_tenant on public.applications(tenant_id);
create index if not exists idx_applications_lead on public.applications(lead_id);
create index if not exists idx_applications_stage on public.applications(stage);

-- TASKS
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  related_id uuid not null references public.applications(id) on delete cascade,
  title text,
  type text not null,
  status text not null default 'open',
  due_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Constraints according to the docs provided
  constraint check_task_type check (type in ('call', 'email', 'review')),
  constraint check_due_date check (due_at >= created_at)
);

--Creating indexes for tasks table
create index if not exists idx_tasks_tenant on public.tasks(tenant_id);
create index if not exists idx_tasks_due_status on public.tasks(due_at, status);