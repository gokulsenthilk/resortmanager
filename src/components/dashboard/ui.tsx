import Link from "next/link";
import {
  CalendarDays,
  ChevronDown,
  Filter,
  LogOut,
  ShieldCheck,
  X,
} from "lucide-react";
import { ReactNode, useState } from "react";
import type { UserRole } from "@/lib/authorization";

import {
  formatDateRangeLabel,
  todayIso,
  startOfMonthIso,
  endOfMonthIso,
  addDaysIso,
} from "./utils";

export function DateFilterBar({
  dateFrom,
  dateTo,
  description = "Filters bookings by stay dates and accounts by entry date.",
  onDateFromChange,
  onDateToChange,
  onClear,
}: {
  dateFrom: string;
  dateTo: string;
  description?: string;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onClear: () => void;
}) {
  const hasFilter = Boolean(dateFrom || dateTo);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">
            Date filter
          </h2>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-[minmax(260px,360px)_auto]">
          <DateRangeControl
            dateFrom={dateFrom}
            dateTo={dateTo}
            label="Date range"
            onDateFromChange={onDateFromChange}
            onDateToChange={onDateToChange}
          />
          <button
            type="button"
            onClick={() => {
              onClear();
            }}
            disabled={!hasFilter}
            className="inline-flex h-10 items-center justify-center gap-2 self-end rounded-md border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:text-slate-300"
          >
            <Filter className="h-4 w-4" />
            Clear
          </button>
        </div>
      </div>
    </section>
  );
}

export function DateRangeControl({
  dateFrom,
  dateTo,
  label,
  onDateFromChange,
  onDateToChange,
}: {
  dateFrom: string;
  dateTo: string;
  label: string;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
}) {
  const [isRangeOpen, setIsRangeOpen] = useState(false);

  function setRange(from: string, to: string) {
    onDateFromChange(from);
    onDateToChange(to);
    setIsRangeOpen(false);
  }

  return (
    <div className="relative min-w-0">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <button
        type="button"
        onClick={() => setIsRangeOpen((current) => !current)}
        aria-expanded={isRangeOpen}
        className="inline-flex h-10 w-full items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 text-left text-sm font-semibold text-slate-800 transition hover:border-teal-300"
      >
        <span className="inline-flex min-w-0 items-center gap-2">
          <CalendarDays className="h-4 w-4 shrink-0 text-teal-700" />
          <span className="truncate">
            {formatDateRangeLabel(dateFrom, dateTo)}
          </span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
      </button>
      {isRangeOpen && (
        <div className="absolute right-0 z-30 mt-2 w-full rounded-lg border border-slate-200 bg-white p-3 shadow-lg sm:w-[360px]">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Start date">
              <input
                type="date"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(event) => {
                  const nextFrom = event.target.value;

                  onDateFromChange(nextFrom);

                  if (dateTo && nextFrom && nextFrom > dateTo) {
                    onDateToChange(nextFrom);
                  }
                }}
                className="field-control"
              />
            </Field>
            <Field label="End date">
              <input
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(event) => {
                  const nextTo = event.target.value;

                  onDateToChange(nextTo);

                  if (dateFrom && nextTo && nextTo < dateFrom) {
                    onDateFromChange(nextTo);
                  }
                }}
                className="field-control"
              />
            </Field>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setRange(todayIso(), todayIso())}
              className="rounded-md border border-slate-200 px-2 py-2 text-xs font-semibold text-slate-700 transition hover:border-teal-300 hover:text-teal-800"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setRange(todayIso(), addDaysIso(new Date(), 6))}
              className="rounded-md border border-slate-200 px-2 py-2 text-xs font-semibold text-slate-700 transition hover:border-teal-300 hover:text-teal-800"
            >
              Next 7 days
            </button>
            <button
              type="button"
              onClick={() =>
                setRange(startOfMonthIso(new Date()), endOfMonthIso(new Date()))
              }
              className="rounded-md border border-slate-200 px-2 py-2 text-xs font-semibold text-slate-700 transition hover:border-teal-300 hover:text-teal-800"
            >
              This month
            </button>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => setIsRangeOpen(false)}
              className="rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-teal-800"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function DashboardModal({
  ariaLabel,
  children,
  onClose,
}: {
  ariaLabel: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      aria-label={ariaLabel}
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-end bg-slate-950/40 p-0 sm:place-items-center sm:p-4"
    >
      <button
        type="button"
        aria-label="Dismiss popup"
        className="absolute inset-0"
        onClick={onClose}
      />
      <div className="relative max-h-[92vh] w-full overflow-y-auto rounded-t-lg border border-slate-200 bg-white p-4 sm:max-w-2xl sm:rounded-lg">
        <button
          type="button"
          aria-label="Close popup"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 grid h-9 w-9 place-items-center rounded-md border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="w-full">{children}</div>
      </div>
    </div>
  );
}

export function StatusPanel({
  title,
  message,
  tone = "info",
}: {
  title: string;
  message: string;
  tone?: "info" | "error";
}) {
  return (
    <section
      className={`rounded-lg border p-4 shadow-sm ${
        tone === "error"
          ? "border-red-200 bg-red-50 text-red-900"
          : "border-slate-200 bg-white text-slate-900"
      }`}
    >
      <h2 className="text-base font-semibold">{title}</h2>
      <p
        className={`mt-1 text-sm ${tone === "error" ? "text-red-700" : "text-slate-500"}`}
      >
        {message}
      </p>
    </section>
  );
}

export function SidebarAuthCard({
  isConfigured,
  email,
  role,
  onSignOut,
}: {
  isConfigured: boolean;
  email: string;
  role: UserRole;
  onSignOut: () => void;
}) {
  return (
    <section className="mt-4 rounded-md border border-slate-800 bg-slate-900 p-4">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400">
        <ShieldCheck className="h-4 w-4" />
        Your account
      </div>

      {email ? (
        <div className="mt-3 space-y-3">
          <div>
            <p className="truncate text-sm font-semibold text-white">{email}</p>
            <p className="mt-1 text-xs text-slate-400">{role}</p>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-slate-700 px-3 text-sm font-semibold text-slate-200 transition hover:border-slate-500"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <p className="text-xs leading-5 text-slate-400">
            {isConfigured
              ? "Use Admin or Manager access."
              : "Configure Supabase before signing in."}
          </p>
          <Link
            href="/sign-in"
            className="inline-flex h-9 w-full items-center justify-center rounded-md bg-teal-400 px-3 text-sm font-semibold text-slate-950 transition hover:bg-teal-300"
          >
            Open sign-in page
          </Link>
        </div>
      )}
    </section>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <p className="p-4 text-sm text-slate-500">{message}</p>;
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md bg-slate-50 p-3">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 truncate text-sm font-semibold text-slate-950">
        {value}
      </dd>
    </div>
  );
}
