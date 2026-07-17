create extension if not exists pgcrypto;

do $$
begin
  create type public.homestay_status as enum ('active', 'maintenance', 'paused');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.booking_status as enum ('pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.account_entry_type as enum ('income', 'expense');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.homestays (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  location text not null,
  manager_name text,
  units integer not null default 1 check (units > 0),
  nightly_rate numeric(12, 2) not null default 0 check (nightly_rate >= 0),
  status public.homestay_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  full_name text not null,
  phone text not null,
  email text,
  city text,
  preferences text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  homestay_id uuid not null references public.homestays (id) on delete cascade,
  name text not null,
  capacity integer not null default 2 check (capacity > 0),
  nightly_rate numeric(12, 2) not null default 0 check (nightly_rate >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  homestay_id uuid not null references public.homestays (id) on delete cascade,
  room_id uuid references public.rooms (id) on delete set null,
  customer_id uuid not null references public.customers (id) on delete restrict,
  check_in date not null,
  check_out date not null,
  guest_count integer not null default 1 check (guest_count > 0),
  status public.booking_status not null default 'pending',
  channel text not null default 'Direct',
  total_amount numeric(12, 2) not null default 0 check (total_amount >= 0),
  amount_paid numeric(12, 2) not null default 0 check (amount_paid >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookings_valid_dates check (check_out > check_in),
  constraint bookings_paid_not_above_total check (amount_paid <= total_amount)
);

create table if not exists public.account_entries (
  id uuid primary key default gen_random_uuid(),
  homestay_id uuid not null references public.homestays (id) on delete cascade,
  booking_id uuid references public.bookings (id) on delete set null,
  entry_type public.account_entry_type not null,
  category text not null,
  label text not null,
  entry_date date not null default current_date,
  amount numeric(12, 2) not null check (amount >= 0),
  is_cleared boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.staff_members (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  full_name text not null,
  mobile_number text not null,
  email text,
  date_of_joining date,
  aadhar_number text,
  pan_number text,
  emergency_contact text,
  monthly_salary numeric(12, 2) not null default 0 check (monthly_salary >= 0),
  monthly_incentive numeric(12, 2) not null default 0 check (monthly_incentive >= 0),
  employee_type text not null default 'Staff',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.staff_salary_payments (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff_members (id) on delete cascade,
  salary_month date not null,
  amount numeric(12, 2) not null default 0 check (amount >= 0),
  base_amount numeric(12, 2) not null default 0 check (base_amount >= 0),
  incentive_amount numeric(12, 2) not null default 0 check (incentive_amount >= 0),
  advance_amount numeric(12, 2) not null default 0 check (advance_amount >= 0),
  cash_amount numeric(12, 2) not null default 0 check (cash_amount >= 0),
  bank_amount numeric(12, 2) not null default 0 check (bank_amount >= 0),
  payment_method text not null default 'cash' check (payment_method in ('cash', 'bank', 'split')),
  days_worked integer not null default 0 check (days_worked >= 0),
  paid_on date not null default current_date,
  created_at timestamptz not null default now(),
  constraint staff_salary_payments_unique_month unique (staff_id, salary_month)
);

alter table public.staff_salary_payments
  add column if not exists days_worked integer not null default 0 check (days_worked >= 0);

alter table public.staff_members
  add column if not exists email text,
  add column if not exists date_of_joining date,
  add column if not exists monthly_incentive numeric(12, 2) not null default 0 check (monthly_incentive >= 0);

alter table public.staff_salary_payments
  add column if not exists base_amount numeric(12, 2) not null default 0 check (base_amount >= 0),
  add column if not exists incentive_amount numeric(12, 2) not null default 0 check (incentive_amount >= 0),
  add column if not exists advance_amount numeric(12, 2) not null default 0 check (advance_amount >= 0),
  add column if not exists cash_amount numeric(12, 2) not null default 0 check (cash_amount >= 0),
  add column if not exists bank_amount numeric(12, 2) not null default 0 check (bank_amount >= 0),
  add column if not exists payment_method text not null default 'cash' check (payment_method in ('cash', 'bank', 'split'));

create index if not exists homestays_owner_id_idx on public.homestays (owner_id);
create index if not exists customers_owner_id_idx on public.customers (owner_id);
create index if not exists customers_owner_name_idx on public.customers (owner_id, full_name);
create index if not exists rooms_homestay_id_idx on public.rooms (homestay_id);
create index if not exists bookings_homestay_id_idx on public.bookings (homestay_id);
create index if not exists bookings_customer_id_idx on public.bookings (customer_id);
create index if not exists bookings_room_id_idx on public.bookings (room_id);
create index if not exists bookings_homestay_dates_idx on public.bookings (homestay_id, check_in, check_out);
create index if not exists bookings_status_idx on public.bookings (status);
create index if not exists account_entries_homestay_id_idx on public.account_entries (homestay_id);
create index if not exists account_entries_booking_id_idx on public.account_entries (booking_id);
create index if not exists account_entries_date_idx on public.account_entries (entry_date desc);
create index if not exists account_entries_common_expenses_idx
  on public.account_entries (homestay_id, entry_date desc, id desc)
  where entry_type = 'expense' and booking_id is null;
create index if not exists staff_members_owner_name_idx on public.staff_members (owner_id, full_name);
create index if not exists staff_salary_payments_staff_month_idx on public.staff_salary_payments (staff_id, salary_month desc);

alter table public.homestays enable row level security;
alter table public.customers enable row level security;
alter table public.rooms enable row level security;
alter table public.bookings enable row level security;
alter table public.account_entries enable row level security;
alter table public.staff_members enable row level security;
alter table public.staff_salary_payments enable row level security;

drop policy if exists "owners can manage homestays" on public.homestays;
drop policy if exists "owners can manage customers" on public.customers;
drop policy if exists "owners can manage rooms" on public.rooms;
drop policy if exists "owners can manage bookings" on public.bookings;
drop policy if exists "owners can manage account entries" on public.account_entries;
drop policy if exists "owners can manage staff" on public.staff_members;
drop policy if exists "owners can manage staff salary payments" on public.staff_salary_payments;

create policy "owners can manage homestays"
on public.homestays
for all
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

create policy "owners can manage customers"
on public.customers
for all
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

create policy "owners can manage rooms"
on public.rooms
for all
using (
  exists (
    select 1
    from public.homestays h
    where h.id = rooms.homestay_id
      and h.owner_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.homestays h
    where h.id = rooms.homestay_id
      and h.owner_id = (select auth.uid())
  )
);

create policy "owners can manage bookings"
on public.bookings
for all
using (
  exists (
    select 1
    from public.homestays h
    where h.id = bookings.homestay_id
      and h.owner_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.homestays h
    join public.customers c on c.id = bookings.customer_id
    where h.id = bookings.homestay_id
      and h.owner_id = (select auth.uid())
      and c.owner_id = (select auth.uid())
  )
);

create policy "owners can manage account entries"
on public.account_entries
for all
using (
  exists (
    select 1
    from public.homestays h
    where h.id = account_entries.homestay_id
      and h.owner_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.homestays h
    where h.id = account_entries.homestay_id
      and h.owner_id = (select auth.uid())
  )
);

create policy "owners can manage staff"
on public.staff_members
for all
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

create policy "owners can manage staff salary payments"
on public.staff_salary_payments
for all
using (
  exists (
    select 1
    from public.staff_members s
    where s.id = staff_salary_payments.staff_id
      and s.owner_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.staff_members s
    where s.id = staff_salary_payments.staff_id
      and s.owner_id = (select auth.uid())
  )
);
