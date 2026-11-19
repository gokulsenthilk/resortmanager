-- =====================================================================================
-- Rollback for supabase/migrations/20261119210000_organisations.sql
--
-- Step 1: run this file. Step 2: re-run supabase/migrations/20261118180000_roles_property_access.sql
-- (it restores the owner-scoped helpers, policies and RPCs). Deploy the previous app version
-- (main before this PR) at the same time.
--
-- Between step 1 and step 2 the tenant tables have RLS on and no policies, so the app sees no
-- rows (fails closed). No business data is deleted: organisations, org_id values, is_owner,
-- can_manage_kitchen and welcomely_enabled stay in place (org_id becomes nullable), so the
-- organisations migration can simply be applied again later.
--
-- Note: owners keep the Admin membership rows the migration created; under the roles model that
-- is equivalent to their old JWT admin access.
-- =====================================================================================

begin;

drop trigger if exists aa_set_org on public.homestays;
drop trigger if exists aa_set_org on public.customers;
drop trigger if exists aa_set_org on public.staff_members;
drop trigger if exists aa_set_org on public.team_members;
drop trigger if exists aa_set_org on public.rooms;
drop trigger if exists aa_set_org on public.bookings;
drop trigger if exists aa_set_org on public.account_entries;
drop trigger if exists aa_set_org on public.staff_salary_payments;
drop trigger if exists aa_set_org on public.staff_member_homestays;
drop trigger if exists aa_set_org on public.team_member_homestays;

alter table public.rooms drop constraint if exists rooms_homestay_org_fkey;
alter table public.bookings drop constraint if exists bookings_homestay_org_fkey;
alter table public.bookings drop constraint if exists bookings_customer_org_fkey;
alter table public.account_entries drop constraint if exists account_entries_homestay_org_fkey;
alter table public.staff_salary_payments drop constraint if exists staff_salary_payments_staff_org_fkey;
alter table public.team_member_homestays drop constraint if exists team_member_homestays_member_org_fkey;
alter table public.team_member_homestays drop constraint if exists team_member_homestays_homestay_org_fkey;
alter table public.staff_member_homestays drop constraint if exists staff_member_homestays_staff_org_fkey;
alter table public.staff_member_homestays drop constraint if exists staff_member_homestays_homestay_org_fkey;
alter table public.homestays drop constraint if exists homestays_id_org_key;
alter table public.customers drop constraint if exists customers_id_org_key;
alter table public.staff_members drop constraint if exists staff_members_id_org_key;
alter table public.team_members drop constraint if exists team_members_user_org_key;

alter table public.homestays alter column org_id drop not null;
alter table public.customers alter column org_id drop not null;
alter table public.staff_members alter column org_id drop not null;
alter table public.team_members alter column org_id drop not null;
alter table public.rooms alter column org_id drop not null;
alter table public.bookings alter column org_id drop not null;
alter table public.account_entries alter column org_id drop not null;
alter table public.staff_salary_payments alter column org_id drop not null;
alter table public.team_member_homestays alter column org_id drop not null;
alter table public.staff_member_homestays alter column org_id drop not null;

-- Drops every policy that uses the organisation helper; the roles migration recreates them.
drop function if exists public.current_org_id() cascade;
drop function if exists private.welcomely_homestay_ids();
drop function if exists private.set_org_on_tenant_row();
drop function if exists private.set_org_from_parent();
drop function if exists private.try_uuid(text);
drop function if exists public.create_organisation(text, text, text);
drop function if exists public.add_team_member_by_email(text, public.app_role, text, uuid[], boolean, boolean, boolean);
drop function if exists public.set_team_member_access(uuid, public.app_role, text, uuid[], boolean, boolean, boolean, uuid, boolean);

commit;
