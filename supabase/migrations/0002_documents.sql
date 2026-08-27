-- BrokerPass step 2: deal documents, private storage bucket, 60-minute auto-delete

-- ---------------------------------------------------------------
-- Documents (one row per uploaded file)
-- ---------------------------------------------------------------
create table public.documents (
  id            uuid primary key default gen_random_uuid(),
  deal_id       uuid not null references public.deals(id) on delete cascade,
  brokerage_id  uuid not null references public.brokerages(id),
  uploaded_by   uuid not null references public.profiles(id),
  storage_path  text not null unique,           -- {brokerage_id}/{deal_id}/{file}
  file_name     text not null,
  file_size     bigint not null,
  mime_type     text not null,
  uploaded_at   timestamptz not null default now(),
  expires_at    timestamptz not null default now() + interval '60 minutes',
  purged_at     timestamptz                     -- set when the file is removed from storage
);

create index documents_deal_idx on public.documents (deal_id);
create index documents_expiry_idx on public.documents (expires_at) where purged_at is null;

alter table public.documents enable row level security;

-- Read follows the deal's visibility (deals RLS already handles agent vs admin).
create policy "read documents via deal" on public.documents
  for select using (
    exists (select 1 from public.deals d where d.id = deal_id)
  );

-- Insert: caller must be able to see the deal and must be the uploader.
create policy "upload document to visible deal" on public.documents
  for insert with check (
    uploaded_by = auth.uid()
    and brokerage_id = public.current_brokerage_id()
    and exists (select 1 from public.deals d where d.id = deal_id)
  );

-- Let the uploader roll back a deal if the file upload fails right after
-- the deal row was created (no scan has run yet).
create policy "submitter deletes unscanned deal" on public.deals
  for delete using (
    submitted_by = auth.uid()
    and status in ('draft', 'scanning')
    and not exists (select 1 from public.scans s where s.deal_id = id)
  );

-- ---------------------------------------------------------------
-- Storage bucket (private)
-- ---------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('deal-documents', 'deal-documents', false, 26214400, array['application/pdf'])
on conflict (id) do nothing;

-- Path convention: {brokerage_id}/{deal_id}/{filename}
-- Members may only touch objects inside their own brokerage folder.
create policy "members upload to own brokerage folder" on storage.objects
  for insert with check (
    bucket_id = 'deal-documents'
    and public.is_active_member()
    and (storage.foldername(name))[1] = public.current_brokerage_id()::text
  );

create policy "members read own brokerage folder" on storage.objects
  for select using (
    bucket_id = 'deal-documents'
    and public.is_active_member()
    and (storage.foldername(name))[1] = public.current_brokerage_id()::text
    -- and the deal itself must be visible to the caller (agent own-only)
    and exists (
      select 1 from public.deals d
      where d.id::text = (storage.foldername(name))[2]
    )
  );

-- Deletes are done by the server (service role) via the purge job only.

-- ---------------------------------------------------------------
-- Deal helper: latest scan summary per deal (for the deal desk table)
-- ---------------------------------------------------------------
create or replace view public.deal_overview
with (security_invoker = true) as
select
  d.id,
  d.brokerage_id,
  d.agent_id,
  d.submitted_by,
  d.deal_type,
  d.property_address,
  d.status,
  d.created_at,
  d.updated_at,
  a.full_name  as agent_name,
  a.email      as agent_email,
  s.full_name  as submitted_by_name,
  (select count(*) from public.documents doc where doc.deal_id = d.id and doc.purged_at is null) as live_documents,
  (select min(doc.expires_at) from public.documents doc where doc.deal_id = d.id and doc.purged_at is null) as next_expiry
from public.deals d
left join public.profiles a on a.id = d.agent_id
left join public.profiles s on s.id = d.submitted_by;
-- left joins: an agent cannot read an admin's profile row, so a deal
-- submitted on their behalf must still appear (with submitted_by_name null).
