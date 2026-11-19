# Roles and property-wise access

StayLedger has the four roles from the Homely Holidays CRM spec (section 5). The database is the
source of truth: `public.team_members` holds each person's role and `public.team_member_homestays`
holds the properties they are assigned to. Row level security (RLS) uses both, so a Property
Manager's phone only ever receives rows for their properties.

## What each role can do

| Area | Admin | Office Executive | Property Manager | Caretaker |
| --- | --- | --- | --- | --- |
| Properties | All, edit | All, edit | Assigned, view | Assigned, view |
| Bookings | All, create/edit/delete | All, create/edit/delete | Assigned, create/edit | Assigned, view only |
| Guest information | All | All | Read/search all guests (contact details only); edit guests booked at assigned properties + guests they added | Name and phone of guests staying at assigned properties |
| Booking pricing (amounts, payments, extras) | Yes | Yes | Only if "Can see booking pricing" is on (off by default) | No |
| Revenue (overview totals, Accounts) | Yes | Yes | No | No |
| Expense entry | Yes | Yes | Yes (assigned properties) | Only if "Can record expenses" is on (off by default) |
| Staff | All records + payroll | Records, no payroll | Contact list of staff allocated to assigned properties | No |
| Financial reports / payroll | Full | Limited (no payroll) | No | No |
| Team & access (system settings) | Yes | No | No | No |

Default landing page: Admin, Office Executive and Property Manager open the Overview; Caretakers
open the Calendar.

## Where each rule is enforced

| Rule | Database (RLS / RPC) | UI |
| --- | --- | --- |
| Property scope for every table (homestays, rooms, bookings, account_entries, staff allocation; customers for edits) | Yes | Property switcher only lists assigned properties |
| Guest search: Property Managers read all of the workspace's guests (name, phone, email, city, preferences) | Yes (`customers` SELECT needs `guests.view` and at least one assigned property; other workspaces stay hidden) | Quick-booking guest search and Customers list show every guest |
| Guest money fields (lifetime / stay value) hidden without pricing | Yes, by design: `customers` has no money columns; stay value is computed from booking amounts, which those users cannot read (`bookings` SELECT needs pricing, `get_booking_schedule()` has no amounts) | Lifetime value shows "—" |
| Guests outside a Property Manager's properties are read-only | Yes (`customers` UPDATE still needs `created_by = auth.uid()` or a booking at an assigned property; delete is Admin/Office Executive only) | Edit button replaced by "View only" |
| Booking amounts hidden from roles without pricing | Yes. The `bookings` table is not readable without pricing; those users read `get_booking_schedule()`, which has no amount columns. A trigger stops them setting or changing amounts. | Amount fields, dues, extras and lifetime value are not rendered |
| Booking-linked income/expense lines | Yes (need pricing) | Hidden |
| Revenue / income entries, Accounts | Yes (`revenue.view`) | Module hidden, overview shows counts only |
| Common expenses: add | Yes (`expenses.enter`) | Form shown only when allowed |
| Common expenses: edit / delete | Yes (`expenses.manage`) | Buttons hidden for caretakers |
| Booking create / edit | Yes (`bookings.manage`) | Buttons hidden for caretakers |
| Booking delete | Yes (Admin, Office Executive) | No delete button exists in the app today |
| Property create / edit | Yes (Admin, Office Executive); delete Admin only | Buttons hidden |
| Staff records incl. salary, Aadhar, PAN | Yes (Admin, Office Executive). PMs get `get_team_directory()` without those columns. | Directory view for PMs |
| Payroll (salary payments) | Yes (Admin only) | Hidden for others |
| Team & access | Yes (Admin only; `set_team_member_access` etc. check `is_admin()`; admins cannot change their own access) | Module hidden |
| Overview metrics for Property Managers | n/a (computed from rows they can already read) | Revenue cards replaced by counts |
| Room nightly rates on property cards | Not hidden by RLS (rooms are property details) | Hidden for roles without pricing |

Housekeeping and Maintenance are future modules. The migration already defines
`housekeeping.view` / `maintenance.view` capabilities, and new tables only need
`homestay_id in (select private.accessible_homestay_ids())` in their policies to get the same
property scope.

Note for Property Managers who can see pricing: a guest's stays and lifetime value only count
bookings at their assigned properties, because bookings at other properties stay hidden.

## Resolved decisions

* **Guest search (resolved: yes).** Property Managers can search every guest of the workspace when
  creating a booking, so a returning guest is not duplicated. They still only see bookings of their
  assigned properties. Guests without a booking at their properties (and not added by them) are
  read-only for them; booking such a guest at one of their properties makes the guest editable.
  Caretakers are unchanged: name and phone only, for guests staying at their properties.
* **Office Executive (resolved: confirmed).** Office Executives manage staff records but not
  payroll (salary payments stay Admin only). No code change was needed.

## Existing users

* `app_metadata.role = "admin"` users need nothing: without a `team_members` row the JWT role is
  still honoured, so `resortadmin@...` keeps full access.
* Legacy `app_metadata.role = "manager"` users are migrated to **Property Manager** of the owner in
  `app_metadata.owner_id` (or of themselves if that is missing/invalid) and **assigned to every
  property of that owner**. That is the same data RLS let them read before, so nothing disappears.
  Booking pricing starts **off** (spec default). Narrow their properties or turn pricing on in
  Team & access.
* A Manager created later without a `team_members` row gets **no properties** (and no guests)
  until an Admin assigns some (deny by default).
* Until the migration is applied, the app falls back to the old behaviour (Admin: everything,
  everyone else: calendar only), so deploying the code first is safe.

## Applying the migration

1. Supabase dashboard → SQL Editor → New query.
2. Paste `supabase/migrations/20261118180000_roles_property_access.sql` and run it.
   It is safe to run twice. Or, with the Supabase CLI linked to the project: `supabase db push`.
3. Check: `select role, email from public.team_members;` lists your legacy managers.

`supabase/schema.sql` contains the same SQL at the end, for new projects.

## Adding a team member

Supabase Auth users can only be created with the service-role key, which the browser never has.

**Without a service-role key (default):**

1. Supabase dashboard → Authentication → Users → **Invite user** (or Add user) with their email.
2. In StayLedger, sign in as Admin → More → **Team & access** → **Add team member**.
3. Enter the same email, pick the role and properties, toggle pricing / expenses, save.

**With invites from the app (optional):** set `SUPABASE_SERVICE_ROLE_KEY` as a server-side
environment variable (never `NEXT_PUBLIC_`, never commit it). Team & access then shows "Send invite
email": the server action sends the Supabase invite, and the role/properties are saved with the
Admin's own session through `add_team_member_by_email()`, so the database still checks that the
caller is an Admin.

To remove access, edit the member and switch **Active** off (they can still sign in but see
nothing), or delete the user in Supabase Auth.

## Tests

`supabase/tests/rbac/run.sh` applies the old schema, seeds fake rows, runs the migration twice and
checks 281 role × table × operation expectations, plus a fresh install from `schema.sql`. Run it
only against a throwaway local Postgres:

```bash
PGHOST=/tmp PGPORT=54329 PGUSER=postgres ./supabase/tests/rbac/run.sh
```
