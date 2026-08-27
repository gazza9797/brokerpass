# BrokerPass

Upload the deal. Get the pass.

Pre-submission compliance checks (RECO, TRESA, OREA) for Ontario brokerages.

## Stack

Next.js (App Router, TypeScript, Tailwind) on Netlify. Supabase (Toronto) for auth, database and document storage, with Row Level Security enforcing the four-role model. Anthropic API for the rule engine. Resend for transactional email.

## Local setup

1. `npm install`
2. Create a Supabase project (region: Canada Central / Toronto).
3. In the Supabase SQL editor, run `supabase/migrations/0001_foundation.sql`, then `supabase/seed.sql`.
4. Supabase -> Authentication -> URL Configuration: set Site URL to `http://localhost:3000` and add `http://localhost:3000/auth/callback` to Redirect URLs.
5. Copy `.env.example` to `.env.local` and fill in the Supabase URL and anon key.
6. `npm run dev`, open http://localhost:3000, sign in with any `@pilot.test` address (Supabase's built-in mailer works for dev; check Auth -> Logs if the email doesn't arrive).
7. Promote yourself to Broker of Record in the SQL editor:
   `update public.profiles set role = 'broker_of_record', status = 'active' where email = 'you@pilot.test';`

## Roles

| Role | Sees | Can |
| --- | --- | --- |
| Broker of Record | whole brokerage | everything, incl. billing and users |
| Alternate BOR | whole brokerage | review, clear, attest, invite users |
| Compliance Officer | whole brokerage | review, clear, send back (no attestation, no users) |
| Agent | own deals only | submit own deals, fix flags |

Admin roles can submit on behalf of an agent. The deal lives in the agent's file; `submitted_by` records who uploaded it.

Departed agents are set to `status = 'deactivated'`, never deleted, so their deals stay in the compliance record.

## Layout

```
src/app/            routes (/, /login, /auth/callback, /app)
src/lib/supabase/   browser, server and middleware clients
src/lib/types.ts    TS mirror of the DB enums and rows
supabase/           migrations and seed
```

## Next steps

- Deal upload + storage bucket (60-minute auto-delete)
- Rule engine (ruleset v1, 8 categories)
- Broker of Record dashboard
- Team & Roles screen
- Google / Microsoft OAuth and bulk invite
