-- Dev seed: one pilot brokerage. Sign up with an @pilot.test email and the
-- signup trigger will attach the profile to it in 'pending' state.
-- Then promote yourself to BOR:
--   update public.profiles set role = 'broker_of_record', status = 'active'
--   where email = 'you@pilot.test';

insert into public.brokerages (name, slug, email_domain, plan)
values ('Pilot Brokerage', 'pilot', 'pilot.test', 'pilot')
on conflict (slug) do nothing;
