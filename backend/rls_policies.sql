alter table public.leads enable row level security;

create table if not exists public.user_teams (
  user_id uuid,
  team_id uuid
);

create table if not exists public.teams (
  id uuid,
  tenant_id uuid
);

-- POLICY 1: SELECT
-- Admins: can read all leads in their tenant
-- Counselors: can read leads assigned to them OR assigned to their team
create policy "leads_select_policy"
on public.leads
for select
using (
  -- Admins can read all leads.

  (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    and tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  )
  OR
  -- Counselor read leads they own
  (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'counselor'
    and owner_id = auth.uid()
    and tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  )
  -- Or
  -- Counselor read leads assigned to counselors in their team
  OR
  (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'counselor'
    and exists (
      select 1
      from public.user_teams ut_self
      join public.user_teams ut_owner
        on ut_self.team_id = ut_owner.team_id
      where ut_self.user_id = auth.uid()          -- current user
        and ut_owner.user_id = public.leads.owner_id -- lead owner
    )
    and tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  )
);

-- POLICY 2: INSERT
create policy "leads_insert_policy"
on public.leads
for insert
with check (
  (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'counselor')
  and tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
);
