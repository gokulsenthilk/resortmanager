set client_min_messages = warning;
-- Legacy backfill
select t_check('backfill: legacy manager -> property_manager', (select role::text from team_members where user_id='00000000-0000-0000-0000-0000000000c1'), 'property_manager');
select t_check('backfill: legacy manager owner', (select owner_id::text from team_members where user_id='00000000-0000-0000-0000-0000000000c1'), '00000000-0000-0000-0000-00000000000a');
select t_check('backfill: legacy manager assigned all owner properties', (select count(*)::text from team_member_homestays where user_id='00000000-0000-0000-0000-0000000000c1'), '3');
select t_check('backfill: legacy manager pricing default off', (select can_view_pricing::text from team_members where user_id='00000000-0000-0000-0000-0000000000c1'), 'false');
select t_check('backfill: invalid owner_id falls back to self', (select owner_id::text from team_members where user_id='00000000-0000-0000-0000-0000000000c2'), '00000000-0000-0000-0000-0000000000c2');
select t_check('backfill: second legacy manager assigned', (select count(*)::text from team_member_homestays where user_id='00000000-0000-0000-0000-0000000000d7'), '3');
-- The roles migration left JWT admins alone; the organisations migration then gives each owner an
-- Admin membership (is_owner) in their own organisation.
select t_check('backfill: owners are admin members after the organisations migration', (select count(*)::text from team_members where user_id in ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-0000000000b0') and role = 'admin' and is_owner), '2');

-- PM without pricing: insert keeps no amounts, update cannot change amounts
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d2","role":"authenticated","app_metadata":{}}', false);
set role authenticated;
insert into bookings (id, homestay_id, room_id, customer_id, check_in, check_out, total_amount, amount_paid)
values ('40000000-0000-0000-0000-0000000000a1','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','2027-02-01','2027-02-03',9000,9000);
update bookings set total_amount = 1, amount_paid = 1, guest_count = 4 where id = '40000000-0000-0000-0000-000000000001'; -- matches 0 rows (not visible)
select save_booking_details('40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','2026-12-01','2026-12-04',4,'confirmed','Phone');
select save_booking_details('40000000-0000-0000-0000-0000000000a2','10000000-0000-0000-0000-000000000001',null,'30000000-0000-0000-0000-000000000001','2027-04-01','2027-04-02',2,'pending','Direct');
insert into customers (id, owner_id, full_name, phone) values ('30000000-0000-0000-0000-0000000000a1', current_data_owner_id(), 'Walk-in', '2');
select t_check('pm: sees guest they created (no booking yet)', (select count(*)::text from customers where id='30000000-0000-0000-0000-0000000000a1'), '1');
select t_check('pm: booking insert with RETURNING blocked (needs pricing to read)', t_try($q$insert into bookings (homestay_id, customer_id, check_in, check_out) values ('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','2027-03-01','2027-03-02') returning id$q$), 'err:42501');
select t_check('pm: schedule rpc hides amounts (no amount column)', (select count(*)::text from pg_proc p, unnest(p.proargnames) a where p.proname='get_booking_schedule' and a in ('total_amount','amount_paid')), '0');
select t_check('pm: get_my_access role', (get_my_access() ->> 'role'), 'property_manager');
select t_check('pm: get_my_access homestays', (get_my_access() -> 'homestay_ids')::text, '["10000000-0000-0000-0000-000000000001"]');
select t_check('pm: get_my_access pricing', (get_my_access() ->> 'can_view_pricing'), 'false');
select t_check('pm: can_access_homestay H2', can_access_homestay('10000000-0000-0000-0000-000000000002')::text, 'false');
select t_check('pm: rpc cannot move booking to unassigned property', t_try($q$select save_booking_details('40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002',null,'30000000-0000-0000-0000-000000000001','2026-12-01','2026-12-04',4,'confirmed','Phone')$q$), 'err:42501');
select t_check('pm: rpc cannot edit booking at unassigned property', t_try($q$select save_booking_details('40000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001',null,'30000000-0000-0000-0000-000000000001','2026-12-05','2026-12-06',1,'cancelled','Direct')$q$), 'err:42501');
select t_check('pm: rpc rejects room from another property', t_try($q$select save_booking_details(null,'10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000001','2027-05-01','2027-05-02',1,'pending','Direct')$q$), 'err:23514');
select t_check('pm: directory has no salary column', (select count(*)::text from pg_proc p, unnest(p.proargnames) a where p.proname='get_team_directory' and a in ('monthly_salary','aadhar_number')), '0');
reset role;
select t_check('pm: inserted booking amounts zeroed', (select total_amount::text || '/' || amount_paid::text from bookings where id='40000000-0000-0000-0000-0000000000a1'), '0.00/0.00');
select t_check('pm: update kept amounts, applied other fields', (select total_amount::text || '/' || amount_paid::text || '/' || guest_count from bookings where id='40000000-0000-0000-0000-000000000001'), '5000.00/2000.00/4');
select t_check('pm: rpc insert has zero amounts', (select total_amount::text || '/' || status from bookings where id='40000000-0000-0000-0000-0000000000a2'), '0.00/pending');
select t_check('pm: rpc update applied dates', (select check_out::text from bookings where id='40000000-0000-0000-0000-000000000001'), '2026-12-04');
select t_check('pm: new customer stamped created_by', (select created_by::text from customers where id='30000000-0000-0000-0000-0000000000a1'), '00000000-0000-0000-0000-0000000000d2');

-- PM with pricing can change amounts
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d3","role":"authenticated","app_metadata":{}}', false);
set role authenticated;
update bookings set total_amount = 3500 where id = '40000000-0000-0000-0000-000000000002';
select t_check('pm_pricing: get_my_access pricing', (get_my_access() ->> 'can_view_pricing'), 'true');
reset role;
select t_check('pm_pricing: amount change stored', (select total_amount::text from bookings where id='40000000-0000-0000-0000-000000000002'), '3500.00');

-- Caretaker: limited guest info via schedule
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d4","role":"authenticated","app_metadata":{}}', false);
set role authenticated;
select t_check('caretaker: schedule shows guest name+phone', (select guest_name || ' ' || guest_phone from get_booking_schedule() where id='40000000-0000-0000-0000-000000000001'), 'Guest One +91 90000 00001');
select t_check('caretaker: get_my_access', (get_my_access() ->> 'role') || '/' || (get_my_access() ->> 'can_enter_expenses'), 'caretaker/false');
select t_check('caretaker: has_capability bookings.manage', has_capability('bookings.manage')::text, 'false');
select t_check('caretaker: rpc save booking denied', t_try($q$select save_booking_details('40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',null,'30000000-0000-0000-0000-000000000001','2026-12-01','2026-12-04',1,'cancelled','Direct')$q$), 'err:42501');
reset role;

-- Admin RPC guard rails
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated","app_metadata":{"role":"admin"}}', false);
set role authenticated;
select t_check('admin: cannot assign another owner property', t_try($q$select set_team_member_access('00000000-0000-0000-0000-0000000000d4','caretaker',null,array['10000000-0000-0000-0000-0000000000ff']::uuid[])$q$), 'err:42501');
select t_check('admin: cannot change own access', t_try($q$select set_team_member_access('00000000-0000-0000-0000-00000000000a','caretaker')$q$), 'err:42501');
select t_check('admin: unknown email', t_try($q$select add_team_member_by_email('nobody@example.test','caretaker')$q$), 'err:P0002');
select t_check('admin: cannot take over other owner member', t_try($q$select set_team_member_access('00000000-0000-0000-0000-0000000000c2','caretaker')$q$), 'err:42501');
select t_check('admin: reassign narrows properties', t_try($q$select set_team_member_access('00000000-0000-0000-0000-0000000000c1','property_manager',null,array['10000000-0000-0000-0000-000000000002']::uuid[])$q$), 'ok:1');
select t_check('admin: get_my_access', (get_my_access() ->> 'role') || '/' || (get_my_access() ->> 'all_properties') || '/' || jsonb_array_length(get_my_access() -> 'homestay_ids'), 'admin/true/3');
reset role;

-- Anonymous callers get nothing
select set_config('request.jwt.claims', '', false);
set role anon;
select t_check('anon: homestays', (select count(*)::text from homestays), '0');
select t_check('anon: get_my_access', t_try('select get_my_access()'), 'err:42501');
select t_check('anon: schedule rpc', t_try('select * from get_booking_schedule()'), 'err:42501');
reset role;

-- INSERT ... RETURNING (what supabase-js .insert().select() does) must see the new row.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated","app_metadata":{"role":"admin"}}', false);
set role authenticated;
select t_check('admin: insert homestay returning', t_try($q$insert into homestays (owner_id,name,location) values (current_data_owner_id(),'Ret','X') returning id$q$), 'ok:1');
select t_check('admin: insert customer returning', t_try($q$insert into customers (owner_id,full_name,phone) values (current_data_owner_id(),'Ret','1') returning id$q$), 'ok:1');
select t_check('admin: insert booking returning', t_try($q$insert into bookings (homestay_id, customer_id, check_in, check_out, total_amount) values ('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','2027-06-01','2027-06-02',100) returning id, total_amount$q$), 'ok:1');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated","app_metadata":{}}', false);
set role authenticated;
select t_check('office_exec: insert homestay returning', t_try($q$insert into homestays (owner_id,name,location) values (current_data_owner_id(),'Ret','X') returning id$q$), 'ok:1');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d2","role":"authenticated","app_metadata":{}}', false);
set role authenticated;
select t_check('pm: insert customer returning', t_try($q$insert into customers (owner_id,full_name,phone) values (current_data_owner_id(),'Ret','1') returning id$q$), 'ok:1');
select t_check('pm: update own-scope customer returning', t_try($q$update customers set city='Kodai' where id='30000000-0000-0000-0000-000000000001' returning id$q$), 'ok:1');
select t_check('pm: update out-of-scope customer', t_try($q$update customers set city='Kodai' where id='30000000-0000-0000-0000-000000000002'$q$), 'ok:0');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d3","role":"authenticated","app_metadata":{}}', false);
set role authenticated;
select t_check('pm_pricing: insert booking returning', t_try($q$insert into bookings (homestay_id, customer_id, check_in, check_out, total_amount) values ('10000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000002','2027-06-01','2027-06-02',100) returning id$q$), 'ok:1');
select t_check('pm_pricing: update booking returning', t_try($q$update bookings set total_amount=3600 where id='40000000-0000-0000-0000-000000000002' returning id$q$), 'ok:1');
reset role;

-- PM guest search across properties (all guests of the owner, contact details only)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d2","role":"authenticated","app_metadata":{}}', false);
set role authenticated;
select t_check('pm guest search: finds guest of another property by phone', (select full_name || ' ' || coalesce(email,'') || ' ' || coalesce(city,'') from customers where phone = '+91 90000 00002'), 'Guest Two two@guest.test ');
select t_check('pm guest search: other owner guests stay hidden', (select count(*)::text from customers where owner_id <> current_data_owner_id()), '0');
select t_check('pm guest search: bookings of other properties stay hidden (schedule)', (select count(*)::text from get_booking_schedule() where customer_id = '30000000-0000-0000-0000-000000000002'), '0');
select t_check('pm guest search: bookings table still unreadable without pricing', (select count(*)::text from bookings), '0');
select t_check('pm guest search: customers table has no money columns', (select count(*)::text from information_schema.columns where table_schema='public' and table_name='customers' and column_name ~ '(amount|value|paid|revenue|price)'), '0');
select t_check('pm guest search: out-of-scope guest is read-only', t_try($q$update customers set phone='0' where id='30000000-0000-0000-0000-000000000003'$q$), 'ok:0');
select t_check('pm guest search: can book a guest from another property at own property', t_try($q$select save_booking_details(null,'10000000-0000-0000-0000-000000000001',null,'30000000-0000-0000-0000-000000000003','2027-07-01','2027-07-02',1,'pending','Direct')$q$), 'ok:1');
select save_booking_details('40000000-0000-0000-0000-0000000000b3','10000000-0000-0000-0000-000000000001',null,'30000000-0000-0000-0000-000000000003','2027-07-01','2027-07-02',1,'pending','Direct');
select t_check('pm guest search: guest becomes editable once booked at own property', t_try($q$update customers set city='Kodai' where id='30000000-0000-0000-0000-000000000003'$q$), 'ok:1');
select t_check('pm guest search: get_my_access returns user_id', get_my_access() ->> 'user_id', '00000000-0000-0000-0000-0000000000d2');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d3","role":"authenticated","app_metadata":{}}', false);
set role authenticated;
select t_check('pm_pricing guest search: sees all owner guests', (select count(*)::text from customers where owner_id = current_data_owner_id() and id::text like '30000000-0000-0000-0000-00000000000%'), '3');
select t_check('pm_pricing guest search: can book guest from another property', t_try($q$insert into bookings (homestay_id, customer_id, check_in, check_out, total_amount) values ('10000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000001','2027-08-01','2027-08-02',100)$q$), 'ok:1');
select t_check('pm_pricing guest search: amounts of other properties stay hidden', (select count(*)::text from bookings where homestay_id <> '10000000-0000-0000-0000-000000000002'), '0');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d8","role":"authenticated","app_metadata":{"role":"manager","owner_id":"00000000-0000-0000-0000-00000000000a"}}', false);
set role authenticated;
select t_check('unassigned manager: no guests', (select count(*)::text from customers), '0');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d4","role":"authenticated","app_metadata":{}}', false);
set role authenticated;
select t_check('caretaker: still no customers table access', (select count(*)::text from customers), '0');
select t_check('caretaker: schedule still limited to own property', (select count(*)::text from get_booking_schedule() where homestay_id <> '10000000-0000-0000-0000-000000000001'), '0');
reset role;
