-- Stamped pass: issued automatically when a deal clears.

create sequence if not exists public.pass_seq;

create table public.passes (
  id            uuid primary key default gen_random_uuid(),
  deal_id       uuid not null references public.deals(id) on delete cascade,
  scan_id       uuid not null unique references public.scans(id) on delete cascade,
  brokerage_id  uuid not null references public.brokerages(id),
  ref           text not null unique,            -- BP-2026-08-0001
  issued_at     timestamptz not null default now(),
  issued_by     uuid references public.profiles(id),  -- who resolved the last item
  ruleset_version text not null,
  rules_run     int not null
);

create index passes_deal_idx on public.passes (deal_id);

alter table public.passes enable row level security;

create policy "read passes via deal" on public.passes
  for select using (
    exists (select 1 from public.deals d where d.id = deal_id)
  );

-- Issue (or return) the pass for a deal's latest scan. Only when cleared.
create or replace function public.issue_pass(p_deal_id uuid)
returns public.passes
language plpgsql security definer set search_path = public as $$
declare
  v_scan public.scans;
  v_pass public.passes;
  v_open int;
begin
  select * into v_scan from public.scans
    where deal_id = p_deal_id order by created_at desc limit 1;
  if v_scan.id is null then return null; end if;

  select count(*) into v_open from public.findings f
    where f.scan_id = v_scan.id and public.finding_is_open(f);
  if v_open > 0 then return null; end if;

  select * into v_pass from public.passes where scan_id = v_scan.id;
  if v_pass.id is not null then return v_pass; end if;

  insert into public.passes (deal_id, scan_id, brokerage_id, ref, issued_by, ruleset_version, rules_run)
  values (
    p_deal_id,
    v_scan.id,
    v_scan.brokerage_id,
    'BP-' || to_char(now() at time zone 'America/Toronto', 'YYYY-MM') || '-' || lpad(nextval('public.pass_seq')::text, 4, '0'),
    auth.uid(),
    v_scan.ruleset_version,
    v_scan.rules_run
  )
  returning * into v_pass;
  return v_pass;
end $$;

grant execute on function public.issue_pass(uuid) to authenticated, service_role;

-- Hook into status recompute: cleared → issue pass.
create or replace function public.recompute_deal_status(p_deal_id uuid)
returns public.deal_status
language plpgsql security definer set search_path = public as $$
declare
  v_scan uuid;
  v_open int;
  v_status public.deal_status;
begin
  select id into v_scan from public.scans
    where deal_id = p_deal_id order by created_at desc limit 1;
  if v_scan is null then
    return (select status from public.deals where id = p_deal_id);
  end if;

  select count(*) into v_open from public.findings f
    where f.scan_id = v_scan and public.finding_is_open(f);

  v_status := case when v_open = 0 then 'cleared' else 'needs_attention' end;
  update public.deals set status = v_status where id = p_deal_id
    and status in ('scanning','needs_attention','cleared');

  if v_status = 'cleared' then
    perform public.issue_pass(p_deal_id);
  end if;
  return v_status;
end $$;
