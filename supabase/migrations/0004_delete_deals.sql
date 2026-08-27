-- Deal deletion: admins anywhere in their brokerage, agents on their own deals.
drop policy if exists "submitter deletes unscanned deal" on public.deals;

create policy "agent deletes own deal" on public.deals
  for delete using (agent_id = auth.uid() and public.is_active_member());

create policy "admin deletes brokerage deal" on public.deals
  for delete using (
    public.is_active_admin()
    and brokerage_id = public.current_brokerage_id()
  );
