-- After rollback + re-running the roles migration, the previous model works again.
\set QUIET on
set client_min_messages = warning;
-- t_results / t_check come from 20_setup_team.sql.

select t_check('rollback: no organisation triggers left', (select count(*)::text from pg_trigger where tgname = 'aa_set_org'), '0');
select t_check('rollback: data kept', (select count(*)::text from homestays) || '/' || (select count(*)::text from bookings), '4/4');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated","app_metadata":{"role":"admin"}}', false);
set role authenticated;
select t_check('rollback admin: homestays', (select count(*)::text from homestays), '3');
select t_check('rollback admin: bookings', (select count(*)::text from bookings), '3');
select t_check('rollback admin: role', get_my_access() ->> 'role', 'admin');
select t_check('rollback admin: can still add a homestay', (select count(*)::text from (select 1) x where public.has_capability('properties.manage')), '1');
select t_check('rollback admin: old team RPC signature', (select count(*)::text from pg_proc where proname = 'set_team_member_access' and pronargs = 8), '1');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d2","role":"authenticated","app_metadata":{}}', false);
set role authenticated;
select t_check('rollback pm: assigned homestay only', (select count(*)::text from homestays), '1');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b0","role":"authenticated","app_metadata":{"role":"admin"}}', false);
set role authenticated;
select t_check('rollback other owner: own homestay only', (select count(*)::text from homestays), '1');
reset role;
