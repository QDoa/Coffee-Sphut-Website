#!/usr/bin/env bash
set -euo pipefail
# Every resource below is a synthetic, loopback-only fixture. Never use a hosted URL.
mkdir -p .partner-portal
if ! docker inspect coffee-partner-test >/dev/null 2>&1; then
  docker run --name coffee-partner-test -e POSTGRES_PASSWORD=coffee-local-test-only -p 127.0.0.1:55432:5432 -d supabase/postgres:17.11.0.004
else
  fixture_image=$(docker inspect --format '{{.Config.Image}}' coffee-partner-test)
  fixture_address=$(docker inspect --format '{{(index (index .HostConfig.PortBindings "5432/tcp") 0).HostIp}}' coffee-partner-test)
  fixture_binding=$(docker inspect --format '{{(index (index .HostConfig.PortBindings "5432/tcp") 0).HostPort}}' coffee-partner-test)
  if [[ "$fixture_image" != 'supabase/postgres:17.11.0.004' || "$fixture_binding" != '55432' || "$fixture_address" != '127.0.0.1' ]]; then
    echo 'Unexpected fixture container configuration; refusing to alter it.' >&2
    exit 1
  fi
  docker start coffee-partner-test >/dev/null
fi
for attempt in {1..30}; do
  if docker exec coffee-partner-test pg_isready -U postgres >/dev/null 2>&1; then break; fi
  sleep 1
done
docker exec coffee-partner-test psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -c 'ALTER ROLE postgres SUPERUSER' >/dev/null
fixture_ready=$(docker exec coffee-partner-test psql -U postgres -d postgres -Atc "select to_regclass('public.partner_accounts') is not null")
if [[ "$fixture_ready" != 't' ]]; then
  pnpm exec tsx scripts/partner-portal/setup-local.ts
else
  echo 'Existing synthetic fixture data retained.'
fi
if [[ ! -f .partner-portal/preview.env ]]; then
  echo 'Preview environment file is missing. Initialize a fresh fixture container; do not copy hosted credentials.' >&2
  exit 1
fi
if ! docker inspect coffee-partner-rest >/dev/null 2>&1; then
  docker run --name coffee-partner-rest --add-host host.docker.internal:host-gateway -p 127.0.0.1:55431:3000 -e PGRST_DB_URI=postgresql://postgres:coffee-local-test-only@host.docker.internal:55432/postgres -e PGRST_DB_SCHEMAS=public -e PGRST_DB_ANON_ROLE=anon -e PGRST_JWT_SECRET=coffee-partner-local-jwt-secret-at-least-32-characters -d public.ecr.aws/supabase/postgrest:v14.5
else
  node - <<'JS'
const {execFileSync}=require('node:child_process');
const c=JSON.parse(execFileSync('docker',['inspect','coffee-partner-rest'],{encoding:'utf8'}))[0];
const binding=c.HostConfig.PortBindings['3000/tcp']?.[0];
const expected='PGRST_DB_URI=postgresql://postgres:coffee-local-test-only@host.docker.internal:55432/postgres';
if(c.Config.Image!=='public.ecr.aws/supabase/postgrest:v14.5'||!c.Config.Env.includes(expected)||binding?.HostIp!=='127.0.0.1'||binding?.HostPort!=='55431')throw new Error('Unexpected API fixture configuration; refusing to use it.');
JS
  docker start coffee-partner-rest >/dev/null
fi
node scripts/partner-portal/storage-local.mjs
fixture_insights=$(docker exec coffee-partner-test psql -U postgres -d postgres -Atc "select to_regprocedure('public.partner_insights()') is not null")
if [[ "$fixture_insights" != 't' ]]; then
  docker exec -i coffee-partner-test psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/migrations/20261105160940_partner_dashboard_insights.sql
fi
fixture_cafe_fields=$(docker exec coffee-partner-test psql -U postgres -d postgres -Atc "select to_regprocedure('public.partner_validate_cafe_selections()') is not null")
if [[ "$fixture_cafe_fields" != 't' ]]; then
  docker exec -i coffee-partner-test psql -U postgres -d postgres -v ON_ERROR_STOP=1 --single-transaction -f - < supabase/migrations/20261107225828_partner_cafe_field_options.sql
fi
fixture_recipe_stock=$(docker exec coffee-partner-test psql -U postgres -d postgres -Atc "select to_regprocedure('public.partner_recipe_stock(uuid,bigint)') is not null")
if [[ "$fixture_recipe_stock" != 't' ]]; then
  docker exec -i coffee-partner-test psql -U postgres -d postgres -v ON_ERROR_STOP=1 --single-transaction -f - < supabase/migrations/20261107235247_partner_recipe_stock_preview.sql
fi
fixture_discard_change=$(docker exec coffee-partner-test psql -U postgres -d postgres -Atc "select to_regprocedure('public.partner_discard_cafe_change(uuid,text)') is not null")
if [[ "$fixture_discard_change" != 't' ]]; then
  docker exec -i coffee-partner-test psql -U postgres -d postgres -v ON_ERROR_STOP=1 --single-transaction -f - < supabase/migrations/20261108001428_partner_discard_change.sql
  docker exec coffee-partner-test psql -U postgres -d postgres -c "NOTIFY pgrst, 'reload schema'" >/dev/null
fi
fixture_edit_manager=$(docker exec coffee-partner-test psql -U postgres -d postgres -Atc "select to_regprocedure('public.partner_team_assignments(uuid)') is not null")
if [[ "$fixture_edit_manager" != 't' ]]; then
  docker exec -i coffee-partner-test psql -U postgres -d postgres -v ON_ERROR_STOP=1 --single-transaction -f - < supabase/migrations/20261108010810_partner_edit_manager_access.sql
  docker exec coffee-partner-test psql -U postgres -d postgres -c "NOTIFY pgrst, 'reload schema'" >/dev/null
fi
echo 'Local fixtures ready. Run pnpm partner:preview and open http://127.0.0.1:3100/partner/overview'
