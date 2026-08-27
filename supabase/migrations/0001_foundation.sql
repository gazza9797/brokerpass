-- BrokerPass foundation: tenants, profiles, roles, deals, RLS
-- Run in Supabase SQL editor or via `supabase db push`.

-- ---------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------
create type public.user_role as enum (
  'broker_of_record',
  'alternate_bor',
  'compliance_officer',
  'agent'
);

create type public.user_status as enum ('pending', 'active', 'deactivated');

create type public.brokerage_plan as enum ('pilot', 'starter', 'pro', 'enterprise');

create type public.deal_status as enum (
  'draft',
  'scanning',
  'needs_attention',
  'cleared',
  'submitted'
);

create type public.rule_severity as enum ('critical', 'warning', 'confirm');

create type public.rule_outcome as enum ('passed', 'warning', 'critical', 'confirm');

-- ---------------------------------------------------------------
-- Tenants
-- ---------------------------------------------------------------
create table public.brokerages (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text not null unique,          -- {slug}.brokerpass.ca
  email_domain  text unique,                   -- for domain-based join
  plan          public.brokerage_plan not null default 'starter',
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  brokerage_id  uuid references public.brokerages(id),
  role          public.user_role not null default 'agent',
  status        public.user_status not null default 'pending',
  full_name     text not null default '',
  email         text not null,
  created_at    timestamptz not null default now()
);

create index profiles_brokerage_idx on public.profiles (brokerage_id);

-- Auto-create a profile on signup. Domain-based join: if the email domain
-- matches a brokerage, attach in 'pending' state for BOR approval.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_domain text := split_part(new.email, '@', 2);
  v_brokerage uuid;
begin
  select id into v_brokerage from public.brokerages where email_domain = v_domain;

  insert into public.profiles (id, email, full_name, brokerage_id, status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    v_brokerage,
    'pending'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------
-- Deals and scans
-- ---------------------------------------------------------------
create table public.deals (
  id                uuid primary key default gen_random_uuid(),
  brokerage_id      uuid not null references public.brokerages(id),
  agent_id          uuid not null references public.profiles(id),  -- whose file
  submitted_by      uuid not null references public.profiles(id),  -- who uploaded
  deal_type         text not null,
  property_address  text,
  status            public.deal_status not null default 'draft',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index deals_brokerage_idx on public.deals (brokerage_id);
create index deals_agent_idx on public.deals (agent_id);

create table public.scans (
  id            uuid primary key default gen_random_uuid(),
  deal_id       uuid not null references public.deals(id) on delete cascade,
  brokerage_id  uuid not null references public.brokerages(id),
  ruleset_version text not null,
  rules_run     int not null default 0,
  passed        int not null default 0,
  warnings      int not null default 0,
  critical      int not null default 0,
  confirms      int not null default 0,
  created_at    timestamptz not null default now()
);

create index scans_deal_idx on public.scans (deal_id);

-- One row per rule per scan: the audit trail.
create table public.findings (
  id              uuid primary key default gen_random_uuid(),
  scan_id         uuid not null references public.scans(id) on delete cascade,
  brokerage_id    uuid not null references public.brokerages(id),
  rule_id         text not null,
  rule_version    text not null,
  severity        public.rule_severity not null,
  outcome         public.rule_outcome not null,
  finding_text    text,
  fix_guidance    text,
  confirm_text    text,
  confirmed_by    uuid references public.profiles(id),
  confirmed_at    timestamptz,
  dismiss_reason  text,
  created_at      timestamptz not null default now()
);

create index findings_scan_idx on public.findings (scan_id);

-- updated_at helper
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger deals_touch before update on public.deals
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------
-- Auth helpers (stable, read the caller's profile once)
-- ---------------------------------------------------------------
create or replace function public.current_brokerage_id()
returns uuid language sql stable security definer set search_path = public as $$
  select brokerage_id from public.profiles where id = auth.uid();
$$;

create or replace function public.current_role()
returns public.user_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_active_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and status = 'active'
      and role in ('broker_of_record', 'alternate_bor', 'compliance_officer')
  );
$$;

create or replace function public.is_active_member()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and status = 'active'
  );
$$;

-- ---------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------
alter table public.brokerages enable row level security;
alter table public.profiles   enable row level security;
alter table public.deals      enable row level security;
alter table public.scans      enable row level security;
alter table public.findings   enable row level security;

-- Brokerages: members see their own tenant. Only the BOR edits it.
create policy "members read own brokerage" on public.brokerages
  for select using (id = public.current_brokerage_id());

create policy "bor updates own brokerage" on public.brokerages
  for update using (
    id = public.current_brokerage_id()
    and public.current_role() = 'broker_of_record'
    and public.is_active_member()
  );

-- Profiles: everyone sees themselves; admins see the whole brokerage.
create policy "read own profile" on public.profiles
  for select using (id = auth.uid());

create policy "admins read brokerage profiles" on public.profiles
  for select using (
    public.is_active_admin()
    and brokerage_id = public.current_brokerage_id()
  );

create policy "update own name" on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid());

-- Role/status changes: BOR and Alternate BOR only (user management).
-- Compliance Officer has no user management.
create policy "bor manages brokerage users" on public.profiles
  for update using (
    brokerage_id = public.current_brokerage_id()
    and public.is_active_member()
    and public.current_role() in ('broker_of_record', 'alternate_bor')
  );

-- Deals: agents see only their own file; admins see the whole brokerage.
create policy "agent reads own deals" on public.deals
  for select using (agent_id = auth.uid() and public.is_active_member());

create policy "admins read brokerage deals" on public.deals
  for select using (
    public.is_active_admin()
    and brokerage_id = public.current_brokerage_id()
  );

-- Insert: agent for self only; admins may submit on behalf of any agent
-- in their brokerage. submitted_by is always the caller.
create policy "agent submits own deal" on public.deals
  for insert with check (
    public.is_active_member()
    and submitted_by = auth.uid()
    and agent_id = auth.uid()
    and brokerage_id = public.current_brokerage_id()
  );

create policy "admin submits on behalf" on public.deals
  for insert with check (
    public.is_active_admin()
    and submitted_by = auth.uid()
    and brokerage_id = public.current_brokerage_id()
    and exists (
      select 1 from public.profiles p
      where p.id = agent_id and p.brokerage_id = public.current_brokerage_id()
    )
  );

create policy "agent updates own deal" on public.deals
  for update using (agent_id = auth.uid() and public.is_active_member());

create policy "admin updates brokerage deal" on public.deals
  for update using (
    public.is_active_admin()
    and brokerage_id = public.current_brokerage_id()
  );

-- Scans / findings follow the deal's visibility.
create policy "read scans via deal" on public.scans
  for select using (
    exists (select 1 from public.deals d where d.id = deal_id)
  );

create policy "read findings via scan" on public.findings
  for select using (
    exists (select 1 from public.scans s where s.id = scan_id)
  );

-- Agents and admins may resolve a Confirm item on a deal they can see.
create policy "confirm findings" on public.findings
  for update using (
    exists (select 1 from public.scans s where s.id = scan_id)
  );

-- Scans and findings are written by the server (service role) only.
-- No insert policies for authenticated users on purpose.
