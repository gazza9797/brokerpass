-- BrokerPass step 3: rule engine plumbing

alter table public.deals
  add column scan_error      text,
  add column last_scanned_at timestamptz;

alter table public.scans
  add column model        text,
  add column duration_ms  int,
  add column summary      text;          -- one-line plain-English read of the package

alter table public.findings
  add column rule_name    text not null default '',
  add column evidence     text,          -- what the engine saw (quote / description)
  add column page         int,           -- 1-based page in the uploaded PDF
  add column confidence   text,          -- high / medium / low
  add column dismissed_by uuid references public.profiles(id),
  add column dismissed_at timestamptz;

-- A Confirm item is resolved when checked or dismissed-with-reason.
create or replace function public.finding_is_open(f public.findings)
returns boolean language sql immutable as $$
  select f.outcome in ('critical','warning')
      or (f.outcome = 'confirm' and f.confirmed_at is null and f.dismissed_at is null);
$$;

-- Recompute a deal's status from its latest scan.
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
  return v_status;
end $$;

grant execute on function public.recompute_deal_status(uuid) to authenticated;

-- Tighten "confirm findings": only the agent on the deal or an active admin,
-- and only the confirm/dismiss columns change (enforced in the app layer;
-- RLS here limits who).
drop policy if exists "confirm findings" on public.findings;
create policy "resolve confirm findings" on public.findings
  for update using (
    outcome = 'confirm'
    and exists (
      select 1 from public.scans s join public.deals d on d.id = s.deal_id
      where s.id = scan_id
        and (d.agent_id = auth.uid() or public.is_active_admin())
        and d.brokerage_id = public.current_brokerage_id()
    )
  );
