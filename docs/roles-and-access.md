# Roles and property-wise access

StayLedger has the four roles from the Homely Holidays CRM spec (section 5). The database is the
source of truth: `public.team_members` holds each person's organisation and role, and
`public.team_member_homestays` holds the properties they are assigned to. Row level security (RLS)
uses both, so a Property Manager's phone only ever receives rows for their organisation and their
properties.

## Organisations (multi-tenant)

Since `20261119210000_organisations.sql`, StayLedger is multi-tenant:

* `public.organisations` is the tenant (name, slug, `status` active/suspended, `owner_user_id`,
  `welcomely_enabled`). Homely Holidays is organisation #1 (slug `homely-holidays`), created by the
  backfill from the existing `owner_id` data.
* Every tenant table has a `NOT NULL org_id`: homestays, rooms, customers, bookings,
  account_entries, staff_members, staff_salary_payments, staff_member_homestays, team_members,
  team_member_homestays. Child rows must share their parent's organisation (composite foreign keys
  on `(id, org_id)`), so a row can never point at another organisation's property, guest or staff.
* `org_id` is filled by a trigger from the signed-in member's organisation (or from the parent row).
  The browser cannot choose it, and a spoofed `owner_id` / `org_id` is overwritten. `owner_id` is
  still kept (set to the organisation owner) so older app builds keep working.
* A membership is the person's `team_members` row (one organisation per login for now). The
  organisation owner has an Admin row with `is_owner = true`; nobody can edit or deactivate it from
  Team & access.
* RLS on every table = same organisation **and** the existing role + per-property assignment rules.
* `get_my_access()` returns the organisation (`org: {id, name, slug, status, welcomely_enabled}`),
  `is_member`, `is_owner`, `can_manage_kitchen` and `welcomely_homestay_ids`. The sidebar shows
  "Role · Organisation".
* New organisations are created with `public.create_organisation(name, slug, owner_email)`. It is
  callable only with the service-role key (SQL Editor or a server job), never from the browser. The
  owner must already exist in Supabase Auth and must not belong to another organisation.

### No membership = no access

A signed-in user without an active `team_members` row in an active organisation gets **no role
and no data**. There is no longer a fallback to `app_metadata.role` in the JWT (before, a user with
`app_metadata.role = "admin"` and no row was treated as Admin of their own workspace). The app
sends such users to a "No access" screen with a Sign out button; it says whether the account has
no membership, is paused, or the organisation is suspended. If access cannot be loaded at all
(e.g. the migration is missing), the app also fails closed.

### Kitchen flag and Welcomely add-on (schema only)

* `team_members.can_manage_kitchen`: a Caretaker-only flag (not a fifth role), toggled in Team &
  access as "Can manage the kitchen". It grants the `kitchen.manage` capability (Admins, Office
  Executives and Property Managers have it by role). No kitchen screens exist yet.
* `organisations.welcomely_enabled` and `homestays.welcomely_enabled` (both default off): the
  Welcomely guest add-on is on for a property only when both are on
  (`private.welcomely_homestay_ids()`). No Welcomely features are built yet.

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
| Kitchen board (future, Welcomely add-on) | Yes | Yes | Yes | Only if "Can manage the kitchen" is on (off by default) |

Default landing page: Admin, Office Executive and Property Manager open the Overview; Caretakers
open the Calendar.

## Where each rule is enforced

| Rule | Database (RLS / RPC) | UI |
| --- | --- | --- |
| Organisation isolation for every table | Yes (`org_id = current_org_id()` in every policy; same-org composite foreign keys; `org_id` set by trigger) | Only the member's organisation is ever loaded |
| No membership / paused member / suspended organisation = no access | Yes (`current_app_role()` and `current_org_id()` return null) | "No access" screen with Sign out |
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
| Team & access | Yes (Admin only; `set_team_member_access` etc. check `is_admin()`; admins cannot change their own access or the owner's; members of other organisations cannot be touched) | Module hidden; no Edit button on the Owner |
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

* After the organisations migration every existing owner (each distinct `owner_id`) is an Admin
  member (`is_owner = true`) of their own organisation. The owner with the most properties becomes
  "Homely Holidays"; any other owner gets "<email name>'s workspace". Rename with
  `update public.organisations set name = '...' where slug = '...';`.
* Users with `app_metadata.role = "admin"` and no `team_members` row get an Admin membership in
  the organisation of their `app_metadata.owner_id` (or their own workspace) during the backfill.
* Legacy `app_metadata.role = "manager"` users were already moved to Property Manager rows by the
  roles migration. A JWT-only user created **after** the migration has no access until an Admin
  adds them in Team & access.

## Applying the migrations (order matters)

1. Supabase dashboard → SQL Editor → New query.
2. If not done yet, run `supabase/migrations/20261118180000_roles_property_access.sql`.
3. Run `supabase/migrations/20261119210000_organisations.sql`. It is one transaction, additive
   (no table or column is dropped, `owner_id` stays) and safe to run twice. Or, with the Supabase
   CLI linked to the project: `supabase db push`.
4. Check: `select name, slug, status from public.organisations;` and
   `select role, email, is_owner from public.team_members;`.
5. **Then** deploy the app version with organisations. The previous app keeps working against the
   migrated database, but the new app fails closed ("Access could not be loaded") against a
   database without the organisations migration.

Do **not** re-run the roles migration after the organisations migration: it would restore the old
JWT fallback in `current_app_role()` and the `owner_id` policies. To go back on purpose, use the
rollback below.

`supabase/schema.sql` contains both migrations at the end, for new projects (e.g. the new Mumbai
project): run it, then create the first organisation with `create_organisation()`.

### Rollback

`supabase/rollback/20261119210000_organisations_down.sql` removes the organisation triggers,
constraints, helpers and policies and makes `org_id` nullable again; it keeps all data and the new
columns. Then re-run `20261118180000_roles_property_access.sql` to restore the owner-based policies
and redeploy the previous app version. The test suite exercises this path.

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

`supabase/tests/rbac/run.sh` applies the old schema, seeds fake rows, runs the roles migration and
the organisations migration twice each and checks 489 expectations: 281 role × table × operation
checks plus 208 organisation checks (backfill, cross-organisation reads/writes/RPCs, owner_id
spoofing, no-membership / JWT-only users, paused members, suspended organisations, kitchen flag,
owner protection, Welcomely entitlement, `create_organisation`). It also verifies a fresh install
from `schema.sql`, and runs the rollback (9 checks) and re-applies the migration. Run it only
against a throwaway local Postgres, never a Supabase project:

```bash
PGHOST=/tmp PGPORT=54329 PGUSER=postgres ./supabase/tests/rbac/run.sh
```
