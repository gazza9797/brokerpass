#!/bin/sh
# Deploys the scan-deal Edge Function. Run from the app folder:
#   SUPABASE_ACCESS_TOKEN=sbp_... ./deploy-scanner.sh
cd "$(dirname "$0")"
[ -z "$SUPABASE_ACCESS_TOKEN" ] && [ -f .supabase-token ] && export SUPABASE_ACCESS_TOKEN="$(cat .supabase-token)"
npx supabase@latest functions deploy scan-deal --project-ref gzyciclnctdnwkvaxuse --no-verify-jwt
