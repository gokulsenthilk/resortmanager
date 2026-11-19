#!/bin/bash
# Local-only RLS test for the roles migration. Never point this at a hosted Supabase project:
# it creates and drops databases. Needs a throwaway Postgres 15+ and psql.
#   PGHOST=/tmp PGPORT=54329 PGUSER=postgres ./supabase/tests/rbac/run.sh
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../../.." && pwd)"
MIGRATION="$ROOT/supabase/migrations/20261118180000_roles_property_access.sql"
PSQL="psql -v ON_ERROR_STOP=1 -q"
BASE_SCHEMA="$(mktemp)"
trap 'rm -f "$BASE_SCHEMA"' EXIT

# Schema as it was before the roles migration (upgrade path), taken from git.
git -C "$ROOT" show "${BASE_REF:-origin/main}:supabase/schema.sql" > "$BASE_SCHEMA"

$PSQL -d postgres -c "drop database if exists rbac_test" -c "create database rbac_test" >/dev/null 2>&1
$PSQL -d rbac_test -f "$HERE/00_supabase_stub.sql"
$PSQL -d rbac_test -f "$BASE_SCHEMA" 2>/dev/null
$PSQL -d rbac_test -f "$HERE/10_seed.sql"
$PSQL -d rbac_test -f "$MIGRATION" 2>/dev/null
$PSQL -d rbac_test -f "$MIGRATION" 2>/dev/null   # must be re-runnable
$PSQL -d rbac_test -f "$HERE/20_setup_team.sql" >/dev/null
$PSQL -d rbac_test -f "$HERE/30_matrix.sql" >/dev/null
$PSQL -d rbac_test -f "$HERE/40_specific.sql" >/dev/null
$PSQL -d rbac_test -P pager=off -c "select count(*) as checks, count(*) filter (where actual is distinct from expected) as failures from t_results"
$PSQL -d rbac_test -P pager=off -c "select test, actual, expected from t_results where actual is distinct from expected order by n"

# Fresh install from schema.sql must apply too.
$PSQL -d postgres -c "drop database if exists rbac_fresh" -c "create database rbac_fresh" >/dev/null 2>&1
$PSQL -d rbac_fresh -f "$HERE/00_supabase_stub.sql"
$PSQL -d rbac_fresh -f "$ROOT/supabase/schema.sql" 2>/dev/null
echo "fresh install from supabase/schema.sql: OK"

FAILURES=$($PSQL -d rbac_test -tA -c "select count(*) from t_results where actual is distinct from expected")
[ "$FAILURES" = "0" ]
