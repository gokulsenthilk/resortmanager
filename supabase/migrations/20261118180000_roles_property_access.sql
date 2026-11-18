-- =====================================================================================
-- Roles & property-wise access (Homely Holidays CRM spec, section 5 "Role-Based Access")
--
-- Roles: admin, office_executive, property_manager, caretaker.
-- * team_members            who belongs to an owner's workspace, their role and per-user flags
-- * team_member_homestays   which properties a Property Manager / Caretaker is assigned to
-- * staff_member_homestays  property-wise allocation of staff records ("assigned team")
--
-- Every helper is STABLE, SECURITY DEFINER and pins search_path = '' so policies can read the
-- membership tables without recursive RLS. Policies wrap helpers in (select ...) so Postgres
-- evaluates them once per statement instead of once per row.
--
-- Safe to re-run: types/tables/columns use IF NOT EXISTS, functions use OR REPLACE and every
-- policy is dropped before it is recreated.
-- =====================================================================================

do $$
begin
  create type public.app_role as enum ('admin', 'office_executive', 'property_manager', 'caretaker');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.team_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  display_name text,
  email text,
  staff_member_id uuid references public.staff_members (id) on delete set null,
  -- Property Manager only: may see booking amounts ("Booking pricing: Optional").
  can_view_pricing boolean not null default false,
  -- Caretaker only: may record property expenses ("Expense entry: Optional").
  can_enter_expenses boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.team_member_homestays (
  user_id uuid not null references public.team_members (user_id) on delete cascade,
  homestay_id uuid not null references public.homestays (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, homestay_id)
);

create table if not exists public.staff_member_homestays (
  staff_id uuid not null references public.staff_members (id) on delete cascade,
  homestay_id uuid not null references public.homestays (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (staff_id, homestay_id)
);

-- Lets a Property Manager keep seeing a guest they just created before the first booking exists.
alter table public.customers
  add column if not exists created_by uuid default auth.uid() references auth.users (id) on delete set null;

create index if not exists team_members_owner_id_idx on public.team_members (owner_id);
create index if not exists team_members_staff_member_id_idx on public.team_members (staff_member_id);
create index if not exists team_member_homestays_homestay_id_idx on public.team_member_homestays (homestay_id);
create index if not exists staff_member_homestays_homestay_id_idx on public.staff_member_homestays (homestay_id);
create index if not exists customers_created_by_idx on public.customers (created_by);

alter table public.team_members enable row level security;
alter table public.team_member_homestays enable row level security;
alter table public.staff_member_homestays enable row level security;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- -------------------------------------------------------------------------------------
-- Identity helpers
-- -------------------------------------------------------------------------------------

-- Role of the signed-in user. A team_members row wins; otherwise the legacy JWT
-- app_metadata.role is honoured ("admin" -> admin, "manager"/missing -> property_manager).
-- An inactive team member gets NULL, i.e. no access at all.
create or replace function public.current_app_role()
returns public.app_role
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  member_role public.app_role;
  member_active boolean;
  jwt_role text;
begin
  if auth.uid() is null then
    return null;
  end if;

  select tm.role, tm.is_active
    into member_role, member_active
  from public.team_members tm
  where tm.user_id = auth.uid();

  if found then
    return case when member_active then member_role else null end;
  end if;

  jwt_role := lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', ''));

  return case jwt_role
    when 'admin' then 'admin'::public.app_role
    when 'office_executive' then 'office_executive'::public.app_role
    when 'caretaker' then 'caretaker'::public.app_role
    else 'property_manager'::public.app_role -- 'manager', 'property_manager' or unset (legacy default)
  end;
end;
$$;

create or replace function public.current_data_owner_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select tm.owner_id from public.team_members tm where tm.user_id = auth.uid()),
    nullif(auth.jwt() -> 'app_metadata' ->> 'owner_id', '')::uuid,
    auth.uid()
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_app_role() = 'admin', false);
$$;

-- Single source of truth for "what may this role do". Mirrors src/lib/authorization.ts.
-- Future modules (housekeeping, maintenance, inventory) add a capability here and scope rows
-- with private.accessible_homestay_ids().
create or replace function public.has_capability(capability text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r public.app_role := public.current_app_role();
  pricing_flag boolean := false;
  expense_flag boolean := false;
begin
  if r is null then
    return false;
  end if;

  select tm.can_view_pricing, tm.can_enter_expenses
    into pricing_flag, expense_flag
  from public.team_members tm
  where tm.user_id = auth.uid();

  pricing_flag := coalesce(pricing_flag, false);
  expense_flag := coalesce(expense_flag, false);

  return case capability
    when 'properties.all' then r in ('admin', 'office_executive')
    when 'properties.manage' then r in ('admin', 'office_executive')
    when 'bookings.view' then true
    when 'bookings.manage' then r in ('admin', 'office_executive', 'property_manager')
    when 'bookings.delete' then r in ('admin', 'office_executive')
    when 'bookings.pricing' then r in ('admin', 'office_executive') or (r = 'property_manager' and pricing_flag)
    when 'guests.view' then r in ('admin', 'office_executive', 'property_manager')
    when 'guests.manage' then r in ('admin', 'office_executive', 'property_manager')
    when 'guests.delete' then r in ('admin', 'office_executive')
    when 'revenue.view' then r in ('admin', 'office_executive')
    when 'expenses.enter' then r in ('admin', 'office_executive', 'property_manager') or (r = 'caretaker' and expense_flag)
    when 'expenses.manage' then r in ('admin', 'office_executive', 'property_manager')
    when 'staff.view_team' then r in ('admin', 'office_executive', 'property_manager')
    when 'staff.manage' then r in ('admin', 'office_executive')
    when 'staff.salary' then r = 'admin'
    when 'financials.full' then r = 'admin'
    when 'financials.limited' then r in ('admin', 'office_executive')
    when 'settings.manage' then r = 'admin'
    when 'housekeeping.view' then true
    when 'maintenance.view' then true
    else false
  end;
end;
$$;

-- Homestays the user may see: all of the owner's for admin / office executive, otherwise only
-- assigned ones. Returned as a set so policies can use "col in (select ...)" (one evaluation).
create or replace function private.accessible_homestay_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select h.id
  from public.homestays h
  where h.owner_id = public.current_data_owner_id()
    and public.current_app_role() is not null
    and (
      public.has_capability('properties.all')
      or exists (
        select 1
        from public.team_member_homestays a
        where a.user_id = auth.uid()
          and a.homestay_id = h.id
      )
    );
$$;

create or replace function public.can_access_homestay(target_homestay_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target_homestay_id in (select private.accessible_homestay_ids());
$$;

-- Properties explicitly assigned to the signed-in user (team_member_homestays).
-- Policies on homestays / customers test the row's own columns plus this set instead of
-- accessible_homestay_ids(), so a row inserted by the same statement (INSERT ... RETURNING)
-- is still visible to its author.
create or replace function private.assigned_homestay_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select a.homestay_id
  from public.team_member_homestays a
  where a.user_id = auth.uid()
    and public.current_app_role() is not null;
$$;

-- Guests with a booking at a property the user can access (Property Manager guest scope).
create or replace function private.booked_customer_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select distinct b.customer_id
  from public.bookings b
  where b.homestay_id in (select private.accessible_homestay_ids());
$$;

revoke all on function public.current_app_role() from public, anon;
revoke all on function public.current_data_owner_id() from public, anon;
revoke all on function public.is_admin() from public, anon;
revoke all on function public.has_capability(text) from public, anon;
revoke all on function public.can_access_homestay(uuid) from public, anon;
revoke all on function private.accessible_homestay_ids() from public, anon;
revoke all on function private.assigned_homestay_ids() from public, anon;
revoke all on function private.booked_customer_ids() from public, anon;
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.current_data_owner_id() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.has_capability(text) to authenticated;
grant execute on function public.can_access_homestay(uuid) to authenticated;
grant execute on function private.accessible_homestay_ids() to authenticated;
grant execute on function private.assigned_homestay_ids() to authenticated;
grant execute on function private.booked_customer_ids() to authenticated;

-- -------------------------------------------------------------------------------------
-- Booking pricing protection: users without "bookings.pricing" cannot set or change
-- amounts. New bookings they create start at 0; edits keep the existing amounts.
-- Service-role / SQL-editor writes (no auth.uid()) are untouched.
-- -------------------------------------------------------------------------------------
create or replace function private.protect_booking_pricing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or public.has_capability('bookings.pricing') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.total_amount := 0;
    new.amount_paid := 0;
  else
    new.total_amount := old.total_amount;
    new.amount_paid := old.amount_paid;
  end if;

  return new;
end;
$$;

drop trigger if exists bookings_protect_pricing on public.bookings;
create trigger bookings_protect_pricing
before insert or update on public.bookings
for each row execute function private.protect_booking_pricing();

-- -------------------------------------------------------------------------------------
-- Row level security
-- -------------------------------------------------------------------------------------

-- Old owner-scoped policies (schema.sql) and any previous run of this migration.
drop policy if exists "owners can manage homestays" on public.homestays;
drop policy if exists "owners can view homestays" on public.homestays;
drop policy if exists "admins can insert homestays" on public.homestays;
drop policy if exists "admins can update homestays" on public.homestays;
drop policy if exists "admins can delete homestays" on public.homestays;
drop policy if exists "owners can manage customers" on public.customers;
drop policy if exists "owners can manage rooms" on public.rooms;
drop policy if exists "owners can view rooms" on public.rooms;
drop policy if exists "admins can insert rooms" on public.rooms;
drop policy if exists "admins can update rooms" on public.rooms;
drop policy if exists "admins can delete rooms" on public.rooms;
drop policy if exists "owners can manage bookings" on public.bookings;
drop policy if exists "owners can manage account entries" on public.account_entries;
drop policy if exists "owners can view permitted account entries" on public.account_entries;
drop policy if exists "owners can insert permitted account entries" on public.account_entries;
drop policy if exists "owners can update permitted account entries" on public.account_entries;
drop policy if exists "owners can delete permitted account entries" on public.account_entries;
drop policy if exists "owners can manage staff" on public.staff_members;
drop policy if exists "owners can manage staff salary payments" on public.staff_salary_payments;
drop policy if exists "rbac homestays select" on public.homestays;
drop policy if exists "rbac homestays insert" on public.homestays;
drop policy if exists "rbac homestays update" on public.homestays;
drop policy if exists "rbac homestays delete" on public.homestays;
drop policy if exists "rbac rooms select" on public.rooms;
drop policy if exists "rbac rooms insert" on public.rooms;
drop policy if exists "rbac rooms update" on public.rooms;
drop policy if exists "rbac rooms delete" on public.rooms;
drop policy if exists "rbac customers select" on public.customers;
drop policy if exists "rbac customers insert" on public.customers;
drop policy if exists "rbac customers update" on public.customers;
drop policy if exists "rbac customers delete" on public.customers;
drop policy if exists "rbac bookings select" on public.bookings;
drop policy if exists "rbac bookings insert" on public.bookings;
drop policy if exists "rbac bookings update" on public.bookings;
drop policy if exists "rbac bookings delete" on public.bookings;
drop policy if exists "rbac account entries select" on public.account_entries;
drop policy if exists "rbac account entries insert" on public.account_entries;
drop policy if exists "rbac account entries update" on public.account_entries;
drop policy if exists "rbac account entries delete" on public.account_entries;
drop policy if exists "rbac staff select" on public.staff_members;
drop policy if exists "rbac staff insert" on public.staff_members;
drop policy if exists "rbac staff update" on public.staff_members;
drop policy if exists "rbac staff delete" on public.staff_members;
drop policy if exists "rbac salary payments all" on public.staff_salary_payments;
drop policy if exists "rbac team members select" on public.team_members;
drop policy if exists "rbac team members write" on public.team_members;
drop policy if exists "rbac team assignments select" on public.team_member_homestays;
drop policy if exists "rbac team assignments write" on public.team_member_homestays;
drop policy if exists "rbac staff allocation select" on public.staff_member_homestays;
drop policy if exists "rbac staff allocation write" on public.staff_member_homestays;

-- Homestays ("Property details": all / all / assigned / assigned; edits: admin + office exec)
create policy "rbac homestays select" on public.homestays
for select to authenticated
using (
  owner_id = (select public.current_data_owner_id())
  and (
    (select public.has_capability('properties.all'))
    or id in (select private.assigned_homestay_ids())
  )
);

create policy "rbac homestays insert" on public.homestays
for insert to authenticated
with check (
  owner_id = (select public.current_data_owner_id())
  and (select public.has_capability('properties.manage'))
);

create policy "rbac homestays update" on public.homestays
for update to authenticated
using (
  owner_id = (select public.current_data_owner_id())
  and (select public.has_capability('properties.manage'))
)
with check (
  owner_id = (select public.current_data_owner_id())
  and (select public.has_capability('properties.manage'))
);

create policy "rbac homestays delete" on public.homestays
for delete to authenticated
using (owner_id = (select public.current_data_owner_id()) and (select public.is_admin()));

-- Rooms follow their homestay. Room rates are property details, not booking pricing.
create policy "rbac rooms select" on public.rooms
for select to authenticated
using (homestay_id in (select private.accessible_homestay_ids()));

create policy "rbac rooms insert" on public.rooms
for insert to authenticated
with check (
  homestay_id in (select private.accessible_homestay_ids())
  and (select public.has_capability('properties.manage'))
);

create policy "rbac rooms update" on public.rooms
for update to authenticated
using (homestay_id in (select private.accessible_homestay_ids()) and (select public.has_capability('properties.manage')))
with check (homestay_id in (select private.accessible_homestay_ids()) and (select public.has_capability('properties.manage')));

create policy "rbac rooms delete" on public.rooms
for delete to authenticated
using (homestay_id in (select private.accessible_homestay_ids()) and (select public.has_capability('properties.manage')));

-- Customers ("Guest information": all / all / assigned / limited). Caretakers never read this
-- table; they get name + phone through public.get_booking_schedule().
create policy "rbac customers select" on public.customers
for select to authenticated
using (
  owner_id = (select public.current_data_owner_id())
  and (select public.has_capability('guests.view'))
  and (
    (select public.has_capability('properties.all'))
    or created_by = (select auth.uid())
    or id in (select private.booked_customer_ids())
  )
);

create policy "rbac customers insert" on public.customers
for insert to authenticated
with check (
  owner_id = (select public.current_data_owner_id())
  and (select public.has_capability('guests.manage'))
);

create policy "rbac customers update" on public.customers
for update to authenticated
using (
  owner_id = (select public.current_data_owner_id())
  and (select public.has_capability('guests.view'))
  and (
    (select public.has_capability('properties.all'))
    or created_by = (select auth.uid())
    or id in (select private.booked_customer_ids())
  )
  and (select public.has_capability('guests.manage'))
)
with check (
  owner_id = (select public.current_data_owner_id())
  and (select public.has_capability('guests.manage'))
);

create policy "rbac customers delete" on public.customers
for delete to authenticated
using (owner_id = (select public.current_data_owner_id()) and (select public.has_capability('guests.delete')));

-- Bookings ("Booking details": all / all / assigned / view only). The base table carries
-- total_amount / amount_paid, so reading it requires "bookings.pricing". Everyone else reads
-- public.get_booking_schedule(), which leaves the amounts out.
create policy "rbac bookings select" on public.bookings
for select to authenticated
using (
  homestay_id in (select private.accessible_homestay_ids())
  and (select public.has_capability('bookings.pricing'))
);

create policy "rbac bookings insert" on public.bookings
for insert to authenticated
with check (
  homestay_id in (select private.accessible_homestay_ids())
  and (select public.has_capability('bookings.manage'))
  and exists (
    select 1 from public.customers c
    where c.id = bookings.customer_id
      and c.owner_id = (select public.current_data_owner_id())
  )
  and (
    room_id is null
    or exists (select 1 from public.rooms r where r.id = bookings.room_id and r.homestay_id = bookings.homestay_id)
  )
);

create policy "rbac bookings update" on public.bookings
for update to authenticated
using (
  homestay_id in (select private.accessible_homestay_ids())
  and (select public.has_capability('bookings.manage'))
)
with check (
  homestay_id in (select private.accessible_homestay_ids())
  and (select public.has_capability('bookings.manage'))
  and exists (
    select 1 from public.customers c
    where c.id = bookings.customer_id
      and c.owner_id = (select public.current_data_owner_id())
  )
  and (
    room_id is null
    or exists (select 1 from public.rooms r where r.id = bookings.room_id and r.homestay_id = bookings.homestay_id)
  )
);

create policy "rbac bookings delete" on public.bookings
for delete to authenticated
using (
  homestay_id in (select private.accessible_homestay_ids())
  and (select public.has_capability('bookings.delete'))
);

-- Account entries
--   common expenses (booking_id is null, expense): anyone with "expenses.enter" at the property
--   booking line items (booking_id set): booking pricing, so "bookings.pricing"
--   everything else (income, reports): "revenue.view"
create policy "rbac account entries select" on public.account_entries
for select to authenticated
using (
  homestay_id in (select private.accessible_homestay_ids())
  and (
    (select public.has_capability('revenue.view'))
    or (booking_id is null and entry_type = 'expense' and (select public.has_capability('expenses.enter')))
    or (booking_id is not null and (select public.has_capability('bookings.pricing')))
  )
);

create policy "rbac account entries insert" on public.account_entries
for insert to authenticated
with check (
  homestay_id in (select private.accessible_homestay_ids())
  and (
    (select public.has_capability('revenue.view'))
    or (booking_id is null and entry_type = 'expense' and (select public.has_capability('expenses.enter')))
    or (
      booking_id is not null
      and (select public.has_capability('bookings.pricing'))
      and (select public.has_capability('bookings.manage'))
    )
  )
  and (
    booking_id is null
    or exists (select 1 from public.bookings b where b.id = account_entries.booking_id and b.homestay_id = account_entries.homestay_id)
  )
);

create policy "rbac account entries update" on public.account_entries
for update to authenticated
using (
  homestay_id in (select private.accessible_homestay_ids())
  and (
    (select public.has_capability('revenue.view'))
    or (booking_id is null and entry_type = 'expense' and (select public.has_capability('expenses.manage')))
    or (
      booking_id is not null
      and (select public.has_capability('bookings.pricing'))
      and (select public.has_capability('bookings.manage'))
    )
  )
)
with check (
  homestay_id in (select private.accessible_homestay_ids())
  and (
    (select public.has_capability('revenue.view'))
    or (booking_id is null and entry_type = 'expense' and (select public.has_capability('expenses.manage')))
    or (
      booking_id is not null
      and (select public.has_capability('bookings.pricing'))
      and (select public.has_capability('bookings.manage'))
    )
  )
  and (
    booking_id is null
    or exists (select 1 from public.bookings b where b.id = account_entries.booking_id and b.homestay_id = account_entries.homestay_id)
  )
);

create policy "rbac account entries delete" on public.account_entries
for delete to authenticated
using (
  homestay_id in (select private.accessible_homestay_ids())
  and (
    (select public.has_capability('revenue.view'))
    or (booking_id is null and entry_type = 'expense' and (select public.has_capability('expenses.manage')))
    or (
      booking_id is not null
      and (select public.has_capability('bookings.pricing'))
      and (select public.has_capability('bookings.manage'))
    )
  )
);

-- Staff ("Staff management": all / limited / assigned team / no). Full records (salary, ID
-- numbers) need "staff.manage"; Property Managers use public.get_team_directory().
create policy "rbac staff select" on public.staff_members
for select to authenticated
using (owner_id = (select public.current_data_owner_id()) and (select public.has_capability('staff.manage')));

create policy "rbac staff insert" on public.staff_members
for insert to authenticated
with check (owner_id = (select public.current_data_owner_id()) and (select public.has_capability('staff.manage')));

create policy "rbac staff update" on public.staff_members
for update to authenticated
using (owner_id = (select public.current_data_owner_id()) and (select public.has_capability('staff.manage')))
with check (owner_id = (select public.current_data_owner_id()) and (select public.has_capability('staff.manage')));

create policy "rbac staff delete" on public.staff_members
for delete to authenticated
using (owner_id = (select public.current_data_owner_id()) and (select public.is_admin()));

-- Payroll ("Financial reports": all / limited / no / no) stays admin-only.
create policy "rbac salary payments all" on public.staff_salary_payments
for all to authenticated
using (
  (select public.has_capability('staff.salary'))
  and exists (
    select 1 from public.staff_members s
    where s.id = staff_salary_payments.staff_id
      and s.owner_id = (select public.current_data_owner_id())
  )
)
with check (
  (select public.has_capability('staff.salary'))
  and exists (
    select 1 from public.staff_members s
    where s.id = staff_salary_payments.staff_id
      and s.owner_id = (select public.current_data_owner_id())
  )
);

-- Team membership: members read their own row; admins read and manage their workspace.
-- Admins cannot edit their own row here (no accidental self-lockout).
create policy "rbac team members select" on public.team_members
for select to authenticated
using (
  user_id = (select auth.uid())
  or (owner_id = (select public.current_data_owner_id()) and (select public.is_admin()))
);

create policy "rbac team members write" on public.team_members
for all to authenticated
using (
  owner_id = (select public.current_data_owner_id())
  and (select public.is_admin())
  and user_id <> (select auth.uid())
)
with check (
  owner_id = (select public.current_data_owner_id())
  and (select public.is_admin())
  and user_id <> (select auth.uid())
);

create policy "rbac team assignments select" on public.team_member_homestays
for select to authenticated
using (
  user_id = (select auth.uid())
  or (
    (select public.is_admin())
    and homestay_id in (select private.accessible_homestay_ids())
  )
);

create policy "rbac team assignments write" on public.team_member_homestays
for all to authenticated
using (
  (select public.is_admin())
  and homestay_id in (select private.accessible_homestay_ids())
)
with check (
  (select public.is_admin())
  and homestay_id in (select private.accessible_homestay_ids())
  and exists (
    select 1 from public.team_members tm
    where tm.user_id = team_member_homestays.user_id
      and tm.owner_id = (select public.current_data_owner_id())
  )
);

create policy "rbac staff allocation select" on public.staff_member_homestays
for select to authenticated
using (
  homestay_id in (select private.accessible_homestay_ids())
  and (select public.has_capability('staff.view_team'))
);

create policy "rbac staff allocation write" on public.staff_member_homestays
for all to authenticated
using (
  homestay_id in (select private.accessible_homestay_ids())
  and (select public.has_capability('staff.manage'))
)
with check (
  homestay_id in (select private.accessible_homestay_ids())
  and (select public.has_capability('staff.manage'))
  and exists (
    select 1 from public.staff_members s
    where s.id = staff_member_homestays.staff_id
      and s.owner_id = (select public.current_data_owner_id())
  )
);

-- -------------------------------------------------------------------------------------
-- RPCs used by the app
-- -------------------------------------------------------------------------------------

-- Everything the UI needs to decide what to show, in one round trip.
create or replace function public.get_my_access()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r public.app_role := public.current_app_role();
  member public.team_members%rowtype;
begin
  select * into member from public.team_members tm where tm.user_id = auth.uid();

  return jsonb_build_object(
    'role', r,
    'is_member', member.user_id is not null,
    'is_active', coalesce(member.is_active, r is not null),
    'display_name', member.display_name,
    'owner_id', public.current_data_owner_id(),
    'all_properties', public.has_capability('properties.all'),
    'homestay_ids', coalesce((select jsonb_agg(id) from private.accessible_homestay_ids() as id), '[]'::jsonb),
    'can_view_pricing', public.has_capability('bookings.pricing'),
    'can_enter_expenses', public.has_capability('expenses.enter')
  );
end;
$$;

-- Bookings without amounts, plus the guest's name and phone ("limited" guest info), for users
-- who cannot read booking pricing (Caretakers, Property Managers without the pricing flag).
create or replace function public.get_booking_schedule()
returns table (
  id uuid,
  homestay_id uuid,
  room_id uuid,
  customer_id uuid,
  guest_name text,
  guest_phone text,
  check_in date,
  check_out date,
  guest_count integer,
  status public.booking_status,
  channel text
)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, b.homestay_id, b.room_id, b.customer_id, c.full_name, c.phone,
         b.check_in, b.check_out, b.guest_count, b.status, b.channel
  from public.bookings b
  join public.customers c on c.id = b.customer_id
  where public.has_capability('bookings.view')
    and b.homestay_id in (select private.accessible_homestay_ids())
  order by b.check_in;
$$;

-- "Assigned team" for Property Managers: contact details only, no salary or ID numbers.
create or replace function public.get_team_directory()
returns table (
  id uuid,
  full_name text,
  mobile_number text,
  email text,
  employee_type text,
  is_active boolean,
  homestay_ids uuid[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.full_name, s.mobile_number, s.email, s.employee_type, s.is_active,
         array_agg(a.homestay_id order by a.homestay_id)
  from public.staff_members s
  join public.staff_member_homestays a on a.staff_id = s.id
  where public.has_capability('staff.view_team')
    and s.owner_id = public.current_data_owner_id()
    and a.homestay_id in (select private.accessible_homestay_ids())
  group by s.id
  order by s.full_name;
$$;

-- Create / edit a booking without touching amounts. Used by Property Managers who cannot see
-- booking pricing: they cannot SELECT the bookings table, so a plain UPDATE would match no rows.
-- Same rules as the table policies: "bookings.manage", assigned property (before and after),
-- guest and room from the same workspace / property. New bookings start with 0 amounts.
create or replace function public.save_booking_details(
  booking_id uuid,
  target_homestay_id uuid,
  target_room_id uuid,
  target_customer_id uuid,
  new_check_in date,
  new_check_out date,
  new_guest_count integer,
  new_status public.booking_status,
  new_channel text,
  new_notes text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  existing_homestay uuid;
  saved_id uuid;
begin
  if not public.has_capability('bookings.manage') then
    raise exception 'Not allowed to manage bookings' using errcode = '42501';
  end if;

  if not public.can_access_homestay(target_homestay_id) then
    raise exception 'Property is not assigned to you' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.customers c
    where c.id = target_customer_id and c.owner_id = public.current_data_owner_id()
  ) then
    raise exception 'Guest is not in your workspace' using errcode = '42501';
  end if;

  if target_room_id is not null and not exists (
    select 1 from public.rooms r where r.id = target_room_id and r.homestay_id = target_homestay_id
  ) then
    raise exception 'Room does not belong to that property' using errcode = '23514';
  end if;

  if booking_id is not null then
    select b.homestay_id into existing_homestay from public.bookings b where b.id = booking_id;
  end if;

  if existing_homestay is not null then
    if not public.can_access_homestay(existing_homestay) then
      raise exception 'Booking is not at a property assigned to you' using errcode = '42501';
    end if;

    update public.bookings b set
      homestay_id = target_homestay_id,
      room_id = target_room_id,
      customer_id = target_customer_id,
      check_in = new_check_in,
      check_out = new_check_out,
      guest_count = new_guest_count,
      status = new_status,
      channel = coalesce(nullif(trim(new_channel), ''), b.channel),
      notes = new_notes,
      updated_at = now()
    where b.id = booking_id
    returning b.id into saved_id;
  else
    insert into public.bookings (
      id, homestay_id, room_id, customer_id, check_in, check_out, guest_count, status, channel, notes,
      total_amount, amount_paid
    )
    values (
      coalesce(booking_id, gen_random_uuid()), target_homestay_id, target_room_id, target_customer_id,
      new_check_in, new_check_out, new_guest_count, new_status,
      coalesce(nullif(trim(new_channel), ''), 'Direct'), new_notes, 0, 0
    )
    returning id into saved_id;
  end if;

  return saved_id;
end;
$$;

-- Admin: set a member's role, flags and property assignments atomically.
create or replace function public.set_team_member_access(
  target_user_id uuid,
  new_role public.app_role,
  new_display_name text default null,
  new_homestay_ids uuid[] default '{}',
  new_can_view_pricing boolean default false,
  new_can_enter_expenses boolean default false,
  new_is_active boolean default true,
  new_staff_member_id uuid default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  owner uuid := public.current_data_owner_id();
  existing_owner uuid;
begin
  if not public.is_admin() then
    raise exception 'Only admins can manage team access' using errcode = '42501';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'You cannot change your own access' using errcode = '42501';
  end if;

  if not exists (select 1 from auth.users u where u.id = target_user_id) then
    raise exception 'No user with that id' using errcode = 'P0002';
  end if;

  select tm.owner_id into existing_owner from public.team_members tm where tm.user_id = target_user_id;
  if existing_owner is not null and existing_owner <> owner then
    raise exception 'That user belongs to another workspace' using errcode = '42501';
  end if;

  if exists (
    select 1 from unnest(coalesce(new_homestay_ids, '{}')) as hid
    where not exists (select 1 from public.homestays h where h.id = hid and h.owner_id = owner)
  ) then
    raise exception 'One or more properties are not in your workspace' using errcode = '42501';
  end if;

  if new_staff_member_id is not null and not exists (
    select 1 from public.staff_members s where s.id = new_staff_member_id and s.owner_id = owner
  ) then
    raise exception 'That staff record is not in your workspace' using errcode = '42501';
  end if;

  insert into public.team_members as tm (
    user_id, owner_id, role, display_name, email, staff_member_id,
    can_view_pricing, can_enter_expenses, is_active
  )
  values (
    target_user_id, owner, new_role, nullif(trim(new_display_name), ''),
    (select u.email from auth.users u where u.id = target_user_id),
    new_staff_member_id,
    new_role in ('admin', 'office_executive') or (new_role = 'property_manager' and new_can_view_pricing),
    new_role in ('admin', 'office_executive', 'property_manager') or (new_role = 'caretaker' and new_can_enter_expenses),
    new_is_active
  )
  on conflict (user_id) do update set
    role = excluded.role,
    display_name = coalesce(excluded.display_name, tm.display_name),
    email = excluded.email,
    staff_member_id = excluded.staff_member_id,
    can_view_pricing = excluded.can_view_pricing,
    can_enter_expenses = excluded.can_enter_expenses,
    is_active = excluded.is_active,
    updated_at = now();

  delete from public.team_member_homestays a
  where a.user_id = target_user_id
    and not (a.homestay_id = any (coalesce(new_homestay_ids, '{}')));

  insert into public.team_member_homestays (user_id, homestay_id)
  select target_user_id, hid from unnest(coalesce(new_homestay_ids, '{}')) as hid
  on conflict do nothing;
end;
$$;

-- Admin: add an existing Supabase Auth user (created or invited in the dashboard) by email.
create or replace function public.add_team_member_by_email(
  member_email text,
  new_role public.app_role,
  new_display_name text default null,
  new_homestay_ids uuid[] default '{}',
  new_can_view_pricing boolean default false,
  new_can_enter_expenses boolean default false
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  found_user uuid;
begin
  if not public.is_admin() then
    raise exception 'Only admins can manage team access' using errcode = '42501';
  end if;

  select u.id into found_user
  from auth.users u
  where lower(u.email) = lower(trim(member_email));

  if found_user is null then
    raise exception 'No Supabase user with email %. Invite them from Supabase Auth first.', member_email
      using errcode = 'P0002';
  end if;

  perform public.set_team_member_access(
    found_user, new_role, new_display_name, new_homestay_ids,
    new_can_view_pricing, new_can_enter_expenses, true, null
  );

  return found_user;
end;
$$;

-- Admin / office executive: property-wise staff allocation.
create or replace function public.set_staff_homestays(target_staff_id uuid, new_homestay_ids uuid[])
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  owner uuid := public.current_data_owner_id();
begin
  if not public.has_capability('staff.manage') then
    raise exception 'Not allowed to allocate staff' using errcode = '42501';
  end if;

  if not exists (select 1 from public.staff_members s where s.id = target_staff_id and s.owner_id = owner) then
    raise exception 'That staff record is not in your workspace' using errcode = '42501';
  end if;

  if exists (
    select 1 from unnest(coalesce(new_homestay_ids, '{}')) as hid
    where not exists (select 1 from public.homestays h where h.id = hid and h.owner_id = owner)
  ) then
    raise exception 'One or more properties are not in your workspace' using errcode = '42501';
  end if;

  delete from public.staff_member_homestays a
  where a.staff_id = target_staff_id
    and not (a.homestay_id = any (coalesce(new_homestay_ids, '{}')));

  insert into public.staff_member_homestays (staff_id, homestay_id)
  select target_staff_id, hid from unnest(coalesce(new_homestay_ids, '{}')) as hid
  on conflict do nothing;
end;
$$;

revoke all on function public.get_my_access() from public, anon;
revoke all on function public.get_booking_schedule() from public, anon;
revoke all on function public.get_team_directory() from public, anon;
revoke all on function public.save_booking_details(uuid, uuid, uuid, uuid, date, date, integer, public.booking_status, text, text) from public, anon;
revoke all on function public.set_team_member_access(uuid, public.app_role, text, uuid[], boolean, boolean, boolean, uuid) from public, anon;
revoke all on function public.add_team_member_by_email(text, public.app_role, text, uuid[], boolean, boolean) from public, anon;
revoke all on function public.set_staff_homestays(uuid, uuid[]) from public, anon;
grant execute on function public.get_my_access() to authenticated;
grant execute on function public.get_booking_schedule() to authenticated;
grant execute on function public.get_team_directory() to authenticated;
grant execute on function public.save_booking_details(uuid, uuid, uuid, uuid, date, date, integer, public.booking_status, text, text) to authenticated;
grant execute on function public.set_team_member_access(uuid, public.app_role, text, uuid[], boolean, boolean, boolean, uuid) to authenticated;
grant execute on function public.add_team_member_by_email(text, public.app_role, text, uuid[], boolean, boolean) to authenticated;
grant execute on function public.set_staff_homestays(uuid, uuid[]) to authenticated;
revoke all on function private.protect_booking_pricing() from public, anon, authenticated;

-- -------------------------------------------------------------------------------------
-- Existing users
--   * app_metadata.role = 'admin'  -> nothing to migrate; still admin through the JWT fallback.
--   * app_metadata.role = 'manager' (legacy) -> becomes a Property Manager of the owner in
--     app_metadata.owner_id (or of themselves), assigned to ALL of that owner's properties,
--     which is exactly the data RLS already let them read. Admins narrow it in Team & access.
-- -------------------------------------------------------------------------------------
with legacy_managers as (
  insert into public.team_members (user_id, owner_id, role, display_name, email)
  select
    u.id,
    case
      when (u.raw_app_meta_data ->> 'owner_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and exists (select 1 from auth.users o where o.id = (u.raw_app_meta_data ->> 'owner_id')::uuid)
      then (u.raw_app_meta_data ->> 'owner_id')::uuid
      else u.id
    end,
    'property_manager',
    coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', u.email),
    u.email
  from auth.users u
  where lower(coalesce(u.raw_app_meta_data ->> 'role', '')) = 'manager'
  on conflict (user_id) do nothing
  returning user_id, owner_id
)
insert into public.team_member_homestays (user_id, homestay_id)
select lm.user_id, h.id
from legacy_managers lm
join public.homestays h on h.owner_id = lm.owner_id
on conflict do nothing;
