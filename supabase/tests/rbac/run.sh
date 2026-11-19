#!/bin/bash
# Local-only RLS tests for the roles and organisations migrations. Never point this at a hosted
# Supabase project: it creates and drops databases. Needs a throwaway Postgres 15+ and psql.
#   PGHOST=/tmp PGPORT=54329 PGUSER=postgres ./supabase/tests/rbac/run.sh
#
# Upgrade path tested: schema before the roles migration (git, PRE_ROLES_REF) -> fake seed ->
# roles migration (x2) -> team set-up -> organisations migration (x2) -> checks.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../../.." && pwd)"
ROLES="$ROOT/supabase/migrations/20261118180000_roles_property_access.sql"
ORGS="$ROOT/supabase/migrations/20261119210000_organisations.sql"
ROLLBACK="$ROOT/supabase/rollback/20261119210000_organisations_down.sql"
PSQL="psql -v ON_ERROR_STOP=1 -q"
BASE_SCHEMA="$(mktemp)"
trap 'rm -f "$BASE_SCHEMA"' EXIT

# Schema as it was before the roles migration (main before PR #8), taken from git.
git -C "$ROOT" show "${PRE_ROLES_REF:-286de3d}:supabase/schema.sql" > "$BASE_SCHEMA"

$PSQL -d postgres -c "drop database if exists rbac_test" -c "create database rbac_test" >/dev/null 2>&1
$PSQL -d rbac_test -f "$HERE/00_supabase_stub.sql"
$PSQL -d rbac_test -f "$BASE_SCHEMA" 2>/dev/null
$PSQL -d rbac_test -f "$HERE/10_seed.sql"
$PSQL -d rbac_test -f "$ROLES" 2>/dev/null
$PSQL -d rbac_test -f "$ROLES" 2>/dev/null   # must be re-runnable
$PSQL -d rbac_test -f "$HERE/20_setup_team.sql" >/dev/null
$PSQL -d rbac_test -f "$ORGS" 2>/dev/null
$PSQL -d rbac_test -f "$ORGS" 2>/dev/null    # must be re-runnable
$PSQL -d rbac_test -f "$HERE/30_matrix.sql" >/dev/null
$PSQL -d rbac_test -f "$HERE/40_specific.sql" >/dev/null
$PSQL -d rbac_test -f "$HERE/50_organisations.sql" >/dev/null
$PSQL -d rbac_test -P pager=off -c "select count(*) as checks, count(*) filter (where actual is distinct from expected) as failures from t_results"
$PSQL -d rbac_test -P pager=off -c "select test, actual, expected from t_results where actual is distinct from expected order by n"

# Fresh install from schema.sql must apply too, and give the same organisation-scoped model.
$PSQL -d postgres -c "drop database if exists rbac_fresh" -c "create database rbac_fresh" >/dev/null 2>&1
$PSQL -d rbac_fresh -f "$HERE/00_supabase_stub.sql"
$PSQL -d rbac_fresh -f "$ROOT/supabase/schema.sql" 2>/dev/null
$PSQL -d rbac_fresh -tA -c "select 'fresh install from supabase/schema.sql: OK (' || count(*) || ' org-scoped tables)' from information_schema.columns where table_schema = 'public' and column_name = 'org_id' and is_nullable = 'NO'"

# Rollback script must apply on an upgraded database and leave the roles model working.
$PSQL -d postgres -c "drop database if exists rbac_rollback" -c "create database rbac_rollback" >/dev/null 2>&1
$PSQL -d rbac_rollback -f "$HERE/00_supabase_stub.sql"
$PSQL -d rbac_rollback -f "$BASE_SCHEMA" 2>/dev/null
$PSQL -d rbac_rollback -f "$HERE/10_seed.sql"
$PSQL -d rbac_rollback -f "$ROLES" 2>/dev/null
$PSQL -d rbac_rollback -f "$HERE/20_setup_team.sql" >/dev/null
$PSQL -d rbac_rollback -f "$ORGS" 2>/dev/null
$PSQL -d rbac_rollback -f "$ROLLBACK" 2>/dev/null
$PSQL -d rbac_rollback -f "$ROLES" 2>/dev/null   # step 2 of the rollback
$PSQL -d rbac_rollback -f "$HERE/60_rollback.sql" >/dev/null
$PSQL -d rbac_rollback -P pager=off -c "select count(*) as rollback_checks, count(*) filter (where actual is distinct from expected) as failures from t_results"
$PSQL -d rbac_rollback -P pager=off -c "select test, actual, expected from t_results where actual is distinct from expected order by n"
# ...and the organisations migration can be applied again afterwards.
$PSQL -d rbac_rollback -f "$ORGS" 2>/dev/null
echo "re-apply after rollback: OK ($($PSQL -d rbac_rollback -tA -c "select count(*) from public.organisations") organisations)"

FAILURES=$($PSQL -d rbac_test -tA -c "select count(*) from t_results where actual is distinct from expected")
RB_FAILURES=$($PSQL -d rbac_rollback -tA -c "select count(*) from t_results where actual is distinct from expected")
[ "$FAILURES" = "0" ] && [ "$RB_FAILURES" = "0" ]
