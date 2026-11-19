-- Organisations migration: backfill, cross-organisation isolation, no-membership users, kitchen
-- flag, owner protection, Welcomely entitlement columns. Fake data only. Local test DB only.
\set QUIET on
set client_min_messages = warning;
reset role;

-- Test-only helper: organisation id by owner (reads past RLS so personas can name other orgs).
create function public.t_org(owner uuid) returns uuid language sql security definer set search_path = '' as $$
  select id from public.organisations where owner_user_id = owner
$$;
grant execute on function public.t_org(uuid) to authenticated, anon;

-- Extra fake accounts, created after the migration. None of them has a membership yet.
insert into auth.users (id, email, raw_app_meta_data) values
 ('00000000-0000-0000-0000-0000000000e1', 'org2.pm@example.test', '{}'),
 ('00000000-0000-0000-0000-0000000000f1', null, '{"provider":"phone"}'),
 ('00000000-0000-0000-0000-0000000000f2', 'stranger@example.test', '{}'),
 ('00000000-0000-0000-0000-0000000000f3', 'jwt.admin@example.test', '{"role":"admin","owner_id":"00000000-0000-0000-0000-00000000000a"}'),
 ('00000000-0000-0000-0000-0000000000f4', 'coadmin@example.test', '{}'),
 ('00000000-0000-0000-0000-0000000000f5', 'neworg.owner@example.test', '{}');

-- ---------------------------------------------------------------------------------------
-- Backfill (as the migration left it)
-- ---------------------------------------------------------------------------------------
select t_check('backfill: one organisation per existing owner', (select count(*)::text from organisations), '3');
select t_check('backfill: org #1 is Homely Holidays, owned by the existing admin', (select name || '/' || slug from organisations where owner_user_id = '00000000-0000-0000-0000-00000000000a'), 'Homely Holidays/homely-holidays');
select t_check('backfill: no tenant row without org_id', (select (
  (select count(*) from homestays where org_id is null) + (select count(*) from customers where org_id is null)
  + (select count(*) from staff_members where org_id is null) + (select count(*) from team_members where org_id is null)
  + (select count(*) from rooms where org_id is null) + (select count(*) from bookings where org_id is null)
  + (select count(*) from account_entries where org_id is null) + (select count(*) from staff_salary_payments where org_id is null)
  + (select count(*) from team_member_homestays where org_id is null) + (select count(*) from staff_member_homestays where org_id is null))::text), '0');
select t_check('backfill: owner''s homestays in org #1', (select count(*)::text from homestays where org_id = t_org('00000000-0000-0000-0000-00000000000a')), '3');
select t_check('backfill: other owner''s homestay in its own org', (select count(*)::text from homestays where org_id = t_org('00000000-0000-0000-0000-0000000000b0')), '1');
select t_check('backfill: children match their homestay org', (select (
  (select count(*) from rooms r join homestays h on h.id = r.homestay_id where r.org_id <> h.org_id)
  + (select count(*) from bookings r join homestays h on h.id = r.homestay_id where r.org_id <> h.org_id)
  + (select count(*) from account_entries r join homestays h on h.id = r.homestay_id where r.org_id <> h.org_id))::text), '0');
select t_check('backfill: bookings use guests of the same org', (select count(*)::text from bookings b join customers c on c.id = b.customer_id where b.org_id <> c.org_id), '0');
select t_check('backfill: payroll follows staff org', (select count(*)::text from staff_salary_payments p join staff_members s on s.id = p.staff_id where p.org_id <> s.org_id), '0');
select t_check('backfill: team members of the old workspace are in org #1', (select count(*)::text from team_members where org_id = t_org('00000000-0000-0000-0000-00000000000a')), '9');
select t_check('backfill: legacy owner_id columns still point at the owner', (select count(*)::text from homestays h join organisations o on o.id = h.org_id where h.owner_id <> o.owner_user_id), '0');
select t_check('backfill: Welcomely add-on off for every org', (select count(*)::text from organisations where welcomely_enabled), '0');
select t_check('backfill: Welcomely toggle off for every homestay', (select count(*)::text from homestays where welcomely_enabled), '0');
select t_check('backfill: kitchen flag off for caretakers', (select count(*)::text from team_members where role = 'caretaker' and can_manage_kitchen), '0');

-- Set-up through the app RPCs: other owner adds a PM; owner adds a co-admin.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b0","role":"authenticated"}', false);
set role authenticated;
select add_team_member_by_email('org2.pm@example.test', 'property_manager', 'Org2 PM', array['10000000-0000-0000-0000-0000000000ff']::uuid[]);
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', false);
set role authenticated;
select add_team_member_by_email('coadmin@example.test', 'admin', 'Co Admin');
reset role;

-- ---------------------------------------------------------------------------------------
-- Org #1 admin (owner) vs org #2 data
-- ---------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', false);
set role authenticated;
select t_check('org1 admin: get_my_access org name', get_my_access() -> 'org' ->> 'name', 'Homely Holidays');
select t_check('org1 admin: get_my_access org id', get_my_access() -> 'org' ->> 'id', t_org('00000000-0000-0000-0000-00000000000a')::text);
select t_check('org1 admin: is owner', get_my_access() ->> 'is_owner', 'true');
select t_check('org1 admin: sees one organisation', (select count(*)::text from organisations), '1');
select t_check('org1 admin: homestays only org1', (select count(*)::text from homestays), '3');
select t_check('org1 admin: no org2 homestay', (select count(*)::text from homestays where id = '10000000-0000-0000-0000-0000000000ff'), '0');
select t_check('org1 admin: no org2 rooms', (select count(*)::text from rooms where homestay_id = '10000000-0000-0000-0000-0000000000ff'), '0');
select t_check('org1 admin: no org2 guests', (select count(*)::text from customers where id = '30000000-0000-0000-0000-0000000000ff'), '0');
select t_check('org1 admin: no org2 bookings', (select count(*)::text from bookings where id = '40000000-0000-0000-0000-0000000000ff'), '0');
select t_check('org1 admin: schedule only org1', (select count(*)::text from get_booking_schedule() where homestay_id = '10000000-0000-0000-0000-0000000000ff'), '0');
select t_check('org1 admin: no org2 team rows', (select count(*)::text from team_members where user_id in ('00000000-0000-0000-0000-0000000000b0','00000000-0000-0000-0000-0000000000e1')), '0');
select t_check('org1 admin: cannot book at org2 homestay', t_try($q$insert into bookings (homestay_id, customer_id, check_in, check_out) values ('10000000-0000-0000-0000-0000000000ff','30000000-0000-0000-0000-000000000001','2027-03-01','2027-03-02')$q$), 'err:42501');
select t_check('org1 admin: cannot book an org2 guest', t_try($q$insert into bookings (homestay_id, customer_id, check_in, check_out) values ('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-0000000000ff','2027-03-01','2027-03-02')$q$), 'err:42501');
select t_check('org1 admin: cannot move a booking to an org2 guest', t_try($q$update bookings set customer_id = '30000000-0000-0000-0000-0000000000ff' where id = '40000000-0000-0000-0000-000000000003'$q$), 'err:42501');
select t_check('org1 admin: cannot create a homestay in org2', t_try(format($q$insert into homestays (org_id, owner_id, name, location) values (%L, '00000000-0000-0000-0000-00000000000a', 'Sneaky', 'X')$q$, t_org('00000000-0000-0000-0000-0000000000b0'))), 'err:42501');
with x as (
  insert into homestays (owner_id, name, location) values ('00000000-0000-0000-0000-0000000000b0', 'Owner spoof', 'X')
  returning org_id, owner_id
)
select t_check('org1 admin: owner_id spoof lands in own org with own owner', (select (org_id = t_org('00000000-0000-0000-0000-00000000000a') and owner_id = '00000000-0000-0000-0000-00000000000a')::text from x), 'true');
delete from homestays where name = 'Owner spoof';
update homestays set org_id = t_org('00000000-0000-0000-0000-0000000000b0') where id = '10000000-0000-0000-0000-000000000003';
select t_check('org1 admin: homestay still in org1', (select (org_id = t_org('00000000-0000-0000-0000-00000000000a'))::text from homestays where id = '10000000-0000-0000-0000-000000000003'), 'true');
select t_check('org1 admin: cannot manage an org2 member', t_try($q$select set_team_member_access('00000000-0000-0000-0000-0000000000e1', 'caretaker')$q$), 'err:42501');
select t_check('org1 admin: cannot add an org2 member by email', t_try($q$select add_team_member_by_email('org2.pm@example.test', 'caretaker')$q$), 'err:42501');
select t_check('org1 admin: cannot assign an org2 homestay', t_try($q$select set_team_member_access('00000000-0000-0000-0000-0000000000d2', 'property_manager', null, array['10000000-0000-0000-0000-0000000000ff']::uuid[])$q$), 'err:42501');
select t_check('org1 admin: cannot allocate staff to an org2 homestay', t_try($q$select set_staff_homestays('60000000-0000-0000-0000-000000000001', array['10000000-0000-0000-0000-0000000000ff']::uuid[])$q$), 'err:42501');
select t_check('org1 admin: cannot insert an org2 assignment directly', t_try($q$insert into team_member_homestays (user_id, homestay_id) values ('00000000-0000-0000-0000-0000000000d2','10000000-0000-0000-0000-0000000000ff')$q$), 'err:42501');
select t_check('org1 admin: cannot change organisations', t_try($q$update organisations set name = 'Renamed', welcomely_enabled = true$q$), 'ok:0');
reset role;

-- ---------------------------------------------------------------------------------------
-- Org #2 admin and Property Manager
-- ---------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b0","role":"authenticated"}', false);
set role authenticated;
select t_check('org2 admin: role admin', get_my_access() ->> 'role', 'admin');
select t_check('org2 admin: own org, not Homely Holidays', get_my_access() -> 'org' ->> 'id', t_org('00000000-0000-0000-0000-0000000000b0')::text);
select t_check('org2 admin: homestays', (select count(*)::text from homestays), '1');
select t_check('org2 admin: rooms', (select count(*)::text from rooms), '1');
select t_check('org2 admin: guests', (select count(*)::text from customers), '1');
select t_check('org2 admin: bookings', (select count(*)::text from bookings), '1');
select t_check('org2 admin: account entries', (select count(*)::text from account_entries), '0');
select t_check('org2 admin: staff records', (select count(*)::text from staff_members), '0');
select t_check('org2 admin: salary payments', (select count(*)::text from staff_salary_payments), '0');
select t_check('org2 admin: team rows', (select count(*)::text from team_members), '2');
select t_check('org2 admin: schedule', (select count(*)::text from get_booking_schedule()), '1');
select t_check('org2 admin: cannot update an org1 homestay', t_try($q$update homestays set name = 'x' where id = '10000000-0000-0000-0000-000000000001'$q$), 'ok:0');
select t_check('org2 admin: cannot delete an org1 guest', t_try($q$delete from customers where id = '30000000-0000-0000-0000-000000000001'$q$), 'ok:0');
select t_check('org2 admin: cannot read org1 payroll', (select count(*)::text from staff_salary_payments where staff_id = '60000000-0000-0000-0000-000000000001'), '0');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}', false);
set role authenticated;
select t_check('org2 pm: role', get_my_access() ->> 'role', 'property_manager');
select t_check('org2 pm: assigned homestays', get_my_access() ->> 'homestay_ids', '["10000000-0000-0000-0000-0000000000ff"]');
select t_check('org2 pm: guests of own org only', (select count(*)::text from customers), '1');
select t_check('org2 pm: schedule', (select count(*)::text from get_booking_schedule()), '1');
select t_check('org2 pm: no bookings table without pricing', (select count(*)::text from bookings), '0');
select t_check('org2 pm: cannot book an org1 guest via RPC', t_try($q$select save_booking_details(null, '10000000-0000-0000-0000-0000000000ff', null, '30000000-0000-0000-0000-000000000001', '2027-04-01', '2027-04-02', 1, 'pending', 'Direct')$q$), 'err:42501');
select t_check('org2 pm: cannot book at an org1 homestay via RPC', t_try($q$select save_booking_details(null, '10000000-0000-0000-0000-000000000001', null, '30000000-0000-0000-0000-0000000000ff', '2027-04-01', '2027-04-02', 1, 'pending', 'Direct')$q$), 'err:42501');
select t_check('org2 pm: can book own guest at own homestay', (t_try($q$select save_booking_details(null, '10000000-0000-0000-0000-0000000000ff', null, '30000000-0000-0000-0000-0000000000ff', '2027-04-01', '2027-04-02', 1, 'pending', 'Direct')$q$) like 'ok:%')::text, 'true');
select t_check('org2 pm: team directory has no org1 staff', (select count(*)::text from get_team_directory()), '0');
reset role;

-- ---------------------------------------------------------------------------------------
-- Signed-in users with no membership: guest (phone OTP), stranger, JWT-only admin, JWT-only
-- manager. None may get a staff role or any row.
-- ---------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated","app_metadata":{"provider":"phone"}}', false);
set role authenticated;
select t_check('guest_phone: no role', coalesce(get_my_access() ->> 'role', 'none'), 'none');
select t_check('guest_phone: no organisation', coalesce(get_my_access() ->> 'org', 'none'), 'none');
select t_check('guest_phone: not a member', get_my_access() ->> 'is_member', 'false');
select t_check('guest_phone: current_app_role null', coalesce(current_app_role()::text, 'none'), 'none');
select t_check('guest_phone: no bookings.view capability', has_capability('bookings.view')::text, 'false');
select t_check('guest_phone: organisations', (select count(*)::text from organisations), '0');
select t_check('guest_phone: homestays', (select count(*)::text from homestays), '0');
select t_check('guest_phone: rooms', (select count(*)::text from rooms), '0');
select t_check('guest_phone: customers', (select count(*)::text from customers), '0');
select t_check('guest_phone: bookings', (select count(*)::text from bookings), '0');
select t_check('guest_phone: schedule', (select count(*)::text from get_booking_schedule()), '0');
select t_check('guest_phone: account entries', (select count(*)::text from account_entries), '0');
select t_check('guest_phone: staff', (select count(*)::text from staff_members), '0');
select t_check('guest_phone: salary payments', (select count(*)::text from staff_salary_payments), '0');
select t_check('guest_phone: team directory', (select count(*)::text from get_team_directory()), '0');
select t_check('guest_phone: team members', (select count(*)::text from team_members), '0');
select t_check('guest_phone: cannot add a guest', t_try($q$insert into customers (owner_id, full_name, phone) values ('00000000-0000-0000-0000-0000000000f1', 'Planted', '+91 1')$q$), 'err:42501');
select t_check('guest_phone: cannot plant a guest in org1', t_try($q$insert into customers (owner_id, full_name, phone) values ('00000000-0000-0000-0000-00000000000a', 'Planted', '+91 1')$q$), 'err:42501');
select t_check('guest_phone: cannot add a homestay', t_try($q$insert into homestays (owner_id, name, location) values ('00000000-0000-0000-0000-00000000000a', 'Planted', 'X')$q$), 'err:42501');
select t_check('guest_phone: cannot add an expense', t_try($q$insert into account_entries (homestay_id, entry_type, category, label, amount) values ('10000000-0000-0000-0000-000000000001', 'expense', 'Misc', 'x', 1)$q$), 'err:42501');
select t_check('guest_phone: cannot add a booking', t_try($q$insert into bookings (homestay_id, customer_id, check_in, check_out) values ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '2027-05-01', '2027-05-02')$q$), 'err:42501');
select t_check('guest_phone: cannot save a booking via RPC', t_try($q$select save_booking_details(null, '10000000-0000-0000-0000-000000000001', null, '30000000-0000-0000-0000-000000000001', '2027-05-01', '2027-05-02', 1, 'pending', 'Direct')$q$), 'err:42501');
select t_check('guest_phone: cannot add team members', t_try($q$select add_team_member_by_email('stranger@example.test', 'admin')$q$), 'err:42501');
select t_check('guest_phone: cannot join org1 directly', t_try($q$insert into team_members (user_id, owner_id, role) values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000000a', 'admin')$q$), 'err:42501');
select t_check('guest_phone: cannot update org1 rows', t_try($q$update homestays set name = 'x'$q$), 'ok:0');
select t_check('guest_phone: cannot create an organisation', t_try($q$select create_organisation('Mine', 'mine-org', 'stranger@example.test')$q$), 'err:42501');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f2","role":"authenticated","app_metadata":{}}', false);
set role authenticated;
select t_check('stranger: no role', coalesce(get_my_access() ->> 'role', 'none'), 'none');
select t_check('stranger: no organisation', coalesce(get_my_access() ->> 'org', 'none'), 'none');
select t_check('stranger: not a member', get_my_access() ->> 'is_member', 'false');
select t_check('stranger: current_app_role null', coalesce(current_app_role()::text, 'none'), 'none');
select t_check('stranger: no bookings.view capability', has_capability('bookings.view')::text, 'false');
select t_check('stranger: organisations', (select count(*)::text from organisations), '0');
select t_check('stranger: homestays', (select count(*)::text from homestays), '0');
select t_check('stranger: rooms', (select count(*)::text from rooms), '0');
select t_check('stranger: customers', (select count(*)::text from customers), '0');
select t_check('stranger: bookings', (select count(*)::text from bookings), '0');
select t_check('stranger: schedule', (select count(*)::text from get_booking_schedule()), '0');
select t_check('stranger: account entries', (select count(*)::text from account_entries), '0');
select t_check('stranger: staff', (select count(*)::text from staff_members), '0');
select t_check('stranger: salary payments', (select count(*)::text from staff_salary_payments), '0');
select t_check('stranger: team directory', (select count(*)::text from get_team_directory()), '0');
select t_check('stranger: team members', (select count(*)::text from team_members), '0');
select t_check('stranger: cannot add a guest', t_try($q$insert into customers (owner_id, full_name, phone) values ('00000000-0000-0000-0000-0000000000f2', 'Planted', '+91 1')$q$), 'err:42501');
select t_check('stranger: cannot plant a guest in org1', t_try($q$insert into customers (owner_id, full_name, phone) values ('00000000-0000-0000-0000-00000000000a', 'Planted', '+91 1')$q$), 'err:42501');
select t_check('stranger: cannot add a homestay', t_try($q$insert into homestays (owner_id, name, location) values ('00000000-0000-0000-0000-00000000000a', 'Planted', 'X')$q$), 'err:42501');
select t_check('stranger: cannot add an expense', t_try($q$insert into account_entries (homestay_id, entry_type, category, label, amount) values ('10000000-0000-0000-0000-000000000001', 'expense', 'Misc', 'x', 1)$q$), 'err:42501');
select t_check('stranger: cannot add a booking', t_try($q$insert into bookings (homestay_id, customer_id, check_in, check_out) values ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '2027-05-01', '2027-05-02')$q$), 'err:42501');
select t_check('stranger: cannot save a booking via RPC', t_try($q$select save_booking_details(null, '10000000-0000-0000-0000-000000000001', null, '30000000-0000-0000-0000-000000000001', '2027-05-01', '2027-05-02', 1, 'pending', 'Direct')$q$), 'err:42501');
select t_check('stranger: cannot add team members', t_try($q$select add_team_member_by_email('stranger@example.test', 'admin')$q$), 'err:42501');
select t_check('stranger: cannot join org1 directly', t_try($q$insert into team_members (user_id, owner_id, role) values ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-00000000000a', 'admin')$q$), 'err:42501');
select t_check('stranger: cannot update org1 rows', t_try($q$update homestays set name = 'x'$q$), 'ok:0');
select t_check('stranger: cannot create an organisation', t_try($q$select create_organisation('Mine', 'mine-org', 'stranger@example.test')$q$), 'err:42501');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f3","role":"authenticated","app_metadata":{"role":"admin","owner_id":"00000000-0000-0000-0000-00000000000a"}}', false);
set role authenticated;
select t_check('jwt_admin: no role', coalesce(get_my_access() ->> 'role', 'none'), 'none');
select t_check('jwt_admin: no organisation', coalesce(get_my_access() ->> 'org', 'none'), 'none');
select t_check('jwt_admin: not a member', get_my_access() ->> 'is_member', 'false');
select t_check('jwt_admin: current_app_role null', coalesce(current_app_role()::text, 'none'), 'none');
select t_check('jwt_admin: no bookings.view capability', has_capability('bookings.view')::text, 'false');
select t_check('jwt_admin: organisations', (select count(*)::text from organisations), '0');
select t_check('jwt_admin: homestays', (select count(*)::text from homestays), '0');
select t_check('jwt_admin: rooms', (select count(*)::text from rooms), '0');
select t_check('jwt_admin: customers', (select count(*)::text from customers), '0');
select t_check('jwt_admin: bookings', (select count(*)::text from bookings), '0');
select t_check('jwt_admin: schedule', (select count(*)::text from get_booking_schedule()), '0');
select t_check('jwt_admin: account entries', (select count(*)::text from account_entries), '0');
select t_check('jwt_admin: staff', (select count(*)::text from staff_members), '0');
select t_check('jwt_admin: salary payments', (select count(*)::text from staff_salary_payments), '0');
select t_check('jwt_admin: team directory', (select count(*)::text from get_team_directory()), '0');
select t_check('jwt_admin: team members', (select count(*)::text from team_members), '0');
select t_check('jwt_admin: cannot add a guest', t_try($q$insert into customers (owner_id, full_name, phone) values ('00000000-0000-0000-0000-0000000000f3', 'Planted', '+91 1')$q$), 'err:42501');
select t_check('jwt_admin: cannot plant a guest in org1', t_try($q$insert into customers (owner_id, full_name, phone) values ('00000000-0000-0000-0000-00000000000a', 'Planted', '+91 1')$q$), 'err:42501');
select t_check('jwt_admin: cannot add a homestay', t_try($q$insert into homestays (owner_id, name, location) values ('00000000-0000-0000-0000-00000000000a', 'Planted', 'X')$q$), 'err:42501');
select t_check('jwt_admin: cannot add an expense', t_try($q$insert into account_entries (homestay_id, entry_type, category, label, amount) values ('10000000-0000-0000-0000-000000000001', 'expense', 'Misc', 'x', 1)$q$), 'err:42501');
select t_check('jwt_admin: cannot add a booking', t_try($q$insert into bookings (homestay_id, customer_id, check_in, check_out) values ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '2027-05-01', '2027-05-02')$q$), 'err:42501');
select t_check('jwt_admin: cannot save a booking via RPC', t_try($q$select save_booking_details(null, '10000000-0000-0000-0000-000000000001', null, '30000000-0000-0000-0000-000000000001', '2027-05-01', '2027-05-02', 1, 'pending', 'Direct')$q$), 'err:42501');
select t_check('jwt_admin: cannot add team members', t_try($q$select add_team_member_by_email('stranger@example.test', 'admin')$q$), 'err:42501');
select t_check('jwt_admin: cannot join org1 directly', t_try($q$insert into team_members (user_id, owner_id, role) values ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-00000000000a', 'admin')$q$), 'err:42501');
select t_check('jwt_admin: cannot update org1 rows', t_try($q$update homestays set name = 'x'$q$), 'ok:0');
select t_check('jwt_admin: cannot create an organisation', t_try($q$select create_organisation('Mine', 'mine-org', 'stranger@example.test')$q$), 'err:42501');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d8","role":"authenticated","app_metadata":{"role":"manager","owner_id":"00000000-0000-0000-0000-00000000000a"}}', false);
set role authenticated;
select t_check('jwt_manager: no role', coalesce(get_my_access() ->> 'role', 'none'), 'none');
select t_check('jwt_manager: no organisation', coalesce(get_my_access() ->> 'org', 'none'), 'none');
select t_check('jwt_manager: not a member', get_my_access() ->> 'is_member', 'false');
select t_check('jwt_manager: current_app_role null', coalesce(current_app_role()::text, 'none'), 'none');
select t_check('jwt_manager: no bookings.view capability', has_capability('bookings.view')::text, 'false');
select t_check('jwt_manager: organisations', (select count(*)::text from organisations), '0');
select t_check('jwt_manager: homestays', (select count(*)::text from homestays), '0');
select t_check('jwt_manager: rooms', (select count(*)::text from rooms), '0');
select t_check('jwt_manager: customers', (select count(*)::text from customers), '0');
select t_check('jwt_manager: bookings', (select count(*)::text from bookings), '0');
select t_check('jwt_manager: schedule', (select count(*)::text from get_booking_schedule()), '0');
select t_check('jwt_manager: account entries', (select count(*)::text from account_entries), '0');
select t_check('jwt_manager: staff', (select count(*)::text from staff_members), '0');
select t_check('jwt_manager: salary payments', (select count(*)::text from staff_salary_payments), '0');
select t_check('jwt_manager: team directory', (select count(*)::text from get_team_directory()), '0');
select t_check('jwt_manager: team members', (select count(*)::text from team_members), '0');
select t_check('jwt_manager: cannot add a guest', t_try($q$insert into customers (owner_id, full_name, phone) values ('00000000-0000-0000-0000-0000000000d8', 'Planted', '+91 1')$q$), 'err:42501');
select t_check('jwt_manager: cannot plant a guest in org1', t_try($q$insert into customers (owner_id, full_name, phone) values ('00000000-0000-0000-0000-00000000000a', 'Planted', '+91 1')$q$), 'err:42501');
select t_check('jwt_manager: cannot add a homestay', t_try($q$insert into homestays (owner_id, name, location) values ('00000000-0000-0000-0000-00000000000a', 'Planted', 'X')$q$), 'err:42501');
select t_check('jwt_manager: cannot add an expense', t_try($q$insert into account_entries (homestay_id, entry_type, category, label, amount) values ('10000000-0000-0000-0000-000000000001', 'expense', 'Misc', 'x', 1)$q$), 'err:42501');
select t_check('jwt_manager: cannot add a booking', t_try($q$insert into bookings (homestay_id, customer_id, check_in, check_out) values ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '2027-05-01', '2027-05-02')$q$), 'err:42501');
select t_check('jwt_manager: cannot save a booking via RPC', t_try($q$select save_booking_details(null, '10000000-0000-0000-0000-000000000001', null, '30000000-0000-0000-0000-000000000001', '2027-05-01', '2027-05-02', 1, 'pending', 'Direct')$q$), 'err:42501');
select t_check('jwt_manager: cannot add team members', t_try($q$select add_team_member_by_email('stranger@example.test', 'admin')$q$), 'err:42501');
select t_check('jwt_manager: cannot join org1 directly', t_try($q$insert into team_members (user_id, owner_id, role) values ('00000000-0000-0000-0000-0000000000d8', '00000000-0000-0000-0000-00000000000a', 'admin')$q$), 'err:42501');
select t_check('jwt_manager: cannot update org1 rows', t_try($q$update homestays set name = 'x'$q$), 'ok:0');
select t_check('jwt_manager: cannot create an organisation', t_try($q$select create_organisation('Mine', 'mine-org', 'stranger@example.test')$q$), 'err:42501');
reset role;

-- ---------------------------------------------------------------------------------------
-- Suspended organisation and paused member
-- ---------------------------------------------------------------------------------------
update organisations set status = 'suspended' where owner_user_id = '00000000-0000-0000-0000-0000000000b0';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b0","role":"authenticated"}', false);
set role authenticated;
select t_check('suspended org admin: no role', coalesce(get_my_access() ->> 'role', 'none'), 'none');
select t_check('suspended org admin: org_status reported', get_my_access() ->> 'org_status', 'suspended');
select t_check('suspended org admin: homestays', (select count(*)::text from homestays), '0');
select t_check('suspended org admin: guests', (select count(*)::text from customers), '0');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}', false);
set role authenticated;
select t_check('suspended org pm: schedule', (select count(*)::text from get_booking_schedule()), '0');
reset role;
update organisations set status = 'active' where owner_user_id = '00000000-0000-0000-0000-0000000000b0';

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d6","role":"authenticated"}', false);
set role authenticated;
select t_check('paused member: no role', coalesce(get_my_access() ->> 'role', 'none'), 'none');
select t_check('paused member: is member', get_my_access() ->> 'is_member', 'true');
select t_check('paused member: not active', get_my_access() ->> 'is_active', 'false');
select t_check('paused member: homestays', (select count(*)::text from homestays), '0');
reset role;

-- ---------------------------------------------------------------------------------------
-- Caretaker kitchen flag
-- ---------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d4","role":"authenticated"}', false);
set role authenticated;
select t_check('caretaker: no kitchen by default', has_capability('kitchen.manage')::text, 'false');
select t_check('caretaker: get_my_access kitchen false', get_my_access() ->> 'can_manage_kitchen', 'false');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', false);
set role authenticated;
select t_check('admin: turn kitchen on for caretaker', t_try($q$select set_team_member_access('00000000-0000-0000-0000-0000000000d4', 'caretaker', null, array['10000000-0000-0000-0000-000000000001']::uuid[], false, false, true, null, true)$q$), 'ok:1');
select set_team_member_access('00000000-0000-0000-0000-0000000000d4', 'caretaker', null, array['10000000-0000-0000-0000-000000000001']::uuid[], false, false, true, null, true);
select t_check('admin: previous-version call without kitchen arg still works', t_try($q$select set_team_member_access(target_user_id => '00000000-0000-0000-0000-0000000000d5', new_role => 'caretaker', new_homestay_ids => array['10000000-0000-0000-0000-000000000001']::uuid[], new_can_enter_expenses => true)$q$), 'ok:1');
select t_check('admin: kitchen flag ignored for PM (implied by role)', t_try($q$select set_team_member_access('00000000-0000-0000-0000-0000000000d2', 'property_manager', null, array['10000000-0000-0000-0000-000000000001']::uuid[], false, false, true, null, false)$q$), 'ok:1');
select t_check('admin: sees kitchen flag column', (select can_manage_kitchen::text from team_members where user_id = '00000000-0000-0000-0000-0000000000d4'), 'true');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d4","role":"authenticated"}', false);
set role authenticated;
select t_check('caretaker with kitchen flag: capability', has_capability('kitchen.manage')::text, 'true');
select t_check('caretaker with kitchen flag: get_my_access', get_my_access() ->> 'can_manage_kitchen', 'true');
select t_check('caretaker with kitchen flag: still no guests table', (select count(*)::text from customers), '0');
select t_check('caretaker with kitchen flag: still no pricing', has_capability('bookings.pricing')::text, 'false');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d5","role":"authenticated"}', false);
set role authenticated;
select t_check('caretaker without kitchen flag: capability', has_capability('kitchen.manage')::text, 'false');
select t_check('caretaker without kitchen flag: expenses flag kept', has_capability('expenses.enter')::text, 'true');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d2","role":"authenticated"}', false);
set role authenticated;
select t_check('pm: kitchen implied', has_capability('kitchen.manage')::text, 'true');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', false);
set role authenticated;
select t_check('office exec: kitchen implied', has_capability('kitchen.manage')::text, 'true');
reset role;

-- ---------------------------------------------------------------------------------------
-- Owner protection (co-admin cannot demote or replace the owner)
-- ---------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f4","role":"authenticated"}', false);
set role authenticated;
select t_check('co-admin: role admin in org1', get_my_access() ->> 'role' || '/' || (get_my_access() -> 'org' ->> 'name'), 'admin/Homely Holidays');
select t_check('co-admin: not owner', get_my_access() ->> 'is_owner', 'false');
select t_check('co-admin: cannot change owner via RPC', t_try($q$select set_team_member_access('00000000-0000-0000-0000-00000000000a', 'caretaker')$q$), 'err:42501');
select t_check('co-admin: cannot change owner row directly', t_try($q$update team_members set role = 'caretaker' where user_id = '00000000-0000-0000-0000-00000000000a'$q$), 'ok:0');
select t_check('co-admin: cannot delete owner row', t_try($q$delete from team_members where user_id = '00000000-0000-0000-0000-00000000000a'$q$), 'ok:0');
select t_check('co-admin: cannot make someone owner', t_try($q$update team_members set is_owner = true where user_id = '00000000-0000-0000-0000-0000000000d2'$q$), 'err:42501');
with x as (
  insert into customers (owner_id, full_name, phone) values ('00000000-0000-0000-0000-0000000000f4', 'Co-admin guest', '+91 2')
  returning org_id, owner_id
)
select t_check('co-admin: new guest lands in org1 under the owner', (select (org_id = t_org('00000000-0000-0000-0000-00000000000a') and owner_id = '00000000-0000-0000-0000-00000000000a')::text from x), 'true');
delete from customers where full_name = 'Co-admin guest';
reset role;

-- ---------------------------------------------------------------------------------------
-- Welcomely add-on entitlement (schema only)
-- ---------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', false);
set role authenticated;
select t_check('welcomely: org flag reported off', get_my_access() -> 'org' ->> 'welcomely_enabled', 'false');
select t_check('welcomely: admin can toggle a homestay', t_try($q$update homestays set welcomely_enabled = true where id = '10000000-0000-0000-0000-000000000001'$q$), 'ok:1');
update homestays set welcomely_enabled = true where id = '10000000-0000-0000-0000-000000000001';
select t_check('welcomely: homestay toggle alone is not enough', get_my_access() ->> 'welcomely_homestay_ids', '[]');
reset role;
update organisations set welcomely_enabled = true where owner_user_id = '00000000-0000-0000-0000-00000000000a';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', false);
set role authenticated;
select t_check('welcomely: org + homestay on', get_my_access() ->> 'welcomely_homestay_ids', '["10000000-0000-0000-0000-000000000001"]');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d2","role":"authenticated"}', false);
set role authenticated;
select t_check('welcomely: PM of that homestay sees it', get_my_access() ->> 'welcomely_homestay_ids', '["10000000-0000-0000-0000-000000000001"]');
select t_check('welcomely: PM cannot toggle homestays', t_try($q$update homestays set welcomely_enabled = false$q$), 'ok:0');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d3","role":"authenticated"}', false);
set role authenticated;
select t_check('welcomely: PM of another homestay sees none', get_my_access() ->> 'welcomely_homestay_ids', '[]');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b0","role":"authenticated"}', false);
set role authenticated;
select t_check('welcomely: other org unaffected', get_my_access() -> 'org' ->> 'welcomely_enabled', 'false');
reset role;

-- ---------------------------------------------------------------------------------------
-- Onboarding a new client (platform only)
-- ---------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', false);
set role authenticated;
select t_check('create_organisation: denied to signed-in users', t_try($q$select create_organisation('Sea Breeze', 'sea-breeze', 'neworg.owner@example.test')$q$), 'err:42501');
reset role;
select set_config('request.jwt.claims', '{"role":"service_role"}', false);
set role service_role;
select t_check('create_organisation: service role creates org', (select (create_organisation('Sea Breeze', 'sea-breeze', 'neworg.owner@example.test') is not null)::text), 'true');
select t_check('create_organisation: owner already in an org is refused', t_try($q$select create_organisation('Dup', 'dup-org', 'admin@example.test')$q$), 'err:23505');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f5","role":"authenticated"}', false);
set role authenticated;
select t_check('new org owner: admin of Sea Breeze', get_my_access() ->> 'role' || '/' || (get_my_access() -> 'org' ->> 'name') || '/' || (get_my_access() ->> 'is_owner'), 'admin/Sea Breeze/true');
select t_check('new org owner: empty workspace', (select count(*)::text from homestays) || '/' || (select count(*)::text from customers) || '/' || (select count(*)::text from bookings), '0/0/0');
select t_check('new org owner: can add a homestay', t_try($q$insert into homestays (owner_id, name, location) values ('00000000-0000-0000-0000-0000000000f5', 'Sea View', 'Goa')$q$), 'ok:1');
insert into homestays (owner_id, name, location) values ('00000000-0000-0000-0000-0000000000f5', 'Sea View', 'Goa');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', false);
set role authenticated;
select t_check('org1 admin: new org''s homestay is invisible', (select count(*)::text from homestays where name = 'Sea View'), '0');
reset role;
