-- Team & Roles: guard privileged profile fields, allow admin inserts for invites.

-- Only an active BOR / Alternate BOR (or the service role) may change
-- role, status or brokerage on a profile. Everyone may edit their own name.
create or replace function public.guard_profile_privileges()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_caller public.profiles;
begin
  if (new.role is distinct from old.role)
     or (new.status is distinct from old.status)
     or (new.brokerage_id is distinct from old.brokerage_id) then

    -- service role / SQL editor: auth.uid() is null → allowed
    if auth.uid() is null then return new; end if;

    select * into v_caller from public.profiles where id = auth.uid();
    if v_caller.status <> 'active'
       or v_caller.role not in ('broker_of_record', 'alternate_bor')
       or v_caller.brokerage_id is distinct from old.brokerage_id then
      raise exception 'Only the Broker of Record or Alternate can change roles and status';
    end if;

    -- Only the Broker of Record may create another Broker of Record,
    -- and nobody may demote or deactivate the last active BOR.
    if new.role = 'broker_of_record' and old.role <> 'broker_of_record'
       and v_caller.role <> 'broker_of_record' then
      raise exception 'Only the Broker of Record can assign the Broker of Record role';
    end if;
    if old.role = 'broker_of_record' and old.status = 'active'
       and (new.role <> 'broker_of_record' or new.status <> 'active') then
      if (select count(*) from public.profiles
            where brokerage_id = old.brokerage_id and role = 'broker_of_record' and status = 'active') <= 1 then
        raise exception 'A brokerage must keep at least one active Broker of Record';
      end if;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile_privileges();

-- Track invitations for the team screen.
alter table public.profiles
  add column if not exists invited_by uuid references public.profiles(id),
  add column if not exists invited_at timestamptz,
  add column if not exists approved_by uuid references public.profiles(id),
  add column if not exists approved_at timestamptz;
