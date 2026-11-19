-- Test helpers (local only)
create table public.t_results (n serial primary key, test text, actual text, expected text);
grant all on public.t_results to authenticated, anon;
grant all on sequence public.t_results_n_seq to authenticated, anon;
create function public.t_check(test text, actual text, expected text) returns void language sql as $$
  insert into public.t_results (test, actual, expected) values (test, actual, expected);
$$;
-- Runs a statement as the current role, reports ok:<rows> or err:<sqlstate>, and always rolls it back.
create function public.t_try(q text) returns text language plpgsql as $$
declare n int;
begin
  begin
    execute q;
    get diagnostics n = row_count;
    raise exception using errcode = 'P9999', message = 'ok:' || n;
  exception when others then
    if sqlstate = 'P9999' then return sqlerrm; end if;
    return 'err:' || sqlstate;
  end;
end $$;
grant execute on function public.t_check(text,text,text), public.t_try(text) to authenticated, anon;

-- A manager created after the migration, with no team row yet.
insert into auth.users (id, email, raw_app_meta_data) values
 ('00000000-0000-0000-0000-0000000000d8','late.manager@example.test','{"role":"manager","owner_id":"00000000-0000-0000-0000-00000000000a"}');

-- Admin sets up the team through the RPCs the app uses.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated","app_metadata":{"role":"admin"}}', false);
set role authenticated;
select public.add_team_member_by_email('office@example.test', 'office_executive', 'Office Exec');
select public.add_team_member_by_email('pm@example.test', 'property_manager', 'PM Hill', array['10000000-0000-0000-0000-000000000001']::uuid[]);
select public.add_team_member_by_email('pm.pricing@example.test', 'property_manager', 'PM Lake', array['10000000-0000-0000-0000-000000000002']::uuid[], true);
select public.add_team_member_by_email('caretaker@example.test', 'caretaker', 'CT Hill', array['10000000-0000-0000-0000-000000000001']::uuid[]);
select public.add_team_member_by_email('caretaker.exp@example.test', 'caretaker', 'CT Hill 2', array['10000000-0000-0000-0000-000000000001']::uuid[], false, true);
select public.add_team_member_by_email('inactive@example.test', 'property_manager', 'Gone', array['10000000-0000-0000-0000-000000000001']::uuid[]);
select public.set_team_member_access('00000000-0000-0000-0000-0000000000d6', 'property_manager', null, array['10000000-0000-0000-0000-000000000001']::uuid[], false, false, false);
select public.set_staff_homestays('60000000-0000-0000-0000-000000000001', array['10000000-0000-0000-0000-000000000001']::uuid[]);
select public.set_staff_homestays('60000000-0000-0000-0000-000000000002', array['10000000-0000-0000-0000-000000000002']::uuid[]);
reset role;
