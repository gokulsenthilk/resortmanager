# StayLedger Homestay Manager

Next.js and Supabase application for managing a multi-homestay business.

It includes:

- Customer module for guest profiles, contact details, preferences, and stay value.
- Booking module for property-level reservations, check-in dates, payment status, and channels.
- Accounts module for income, expenses, pending invoices, and net position.
- Homestay switcher for managing multiple properties from one dashboard.

## Getting Started

Install dependencies and run the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

To connect Supabase:

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. Copy `.env.example` to `.env.local`.
4. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
5. Restart `npm run dev`.

The app reads homestays, rooms, customers, bookings, and account entries from Supabase through `src/lib/supabase-data.ts`. If row level security is enabled, the browser must have a Supabase Auth session that can access the owner-scoped rows.

## Supabase Notes

The schema uses:

- Owner-scoped row level security policies.
- Indexed foreign keys for joins and cascade operations.
- Composite booking date index for property calendars.
- Numeric money columns for exact account totals.
- Date constraints to prevent invalid stays and overpaid bookings.

## Scripts

- `npm run dev` starts the local development server.
- `npm run lint` runs ESLint.
- `npm run build` builds the Next.js app.
