import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  BedDouble,
  CheckCircle2,
  Clock3,
  ReceiptText,
  WalletCards,
} from "lucide-react";
import type {
  AccountEntry,
  Booking,
  DashboardData,
  Homestay,
} from "@/lib/types";

import { inr } from "./shared";
import { EmptyState } from "./ui";
import { formatDate } from "./utils";

export function MetricGrid({
  metrics,
  bookings: visibleBookings,
}: {
  metrics: {
    bookedRevenue: number;
    totalRevenue: number;
    bookingExtraIncome: number;
    bookingExtraExpense: number;
    expenses: number;
    salaryExpenses: number;
    received: number;
    pending: number;
    occupancy: number;
  };
  bookings: Booking[];
}) {
  return (
    <section className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-5">
      <MetricCard
        label="Total revenue"
        value={inr.format(metrics.totalRevenue)}
        detail={`${inr.format(metrics.bookingExtraIncome)} extras, ${inr.format(metrics.bookingExtraExpense)} adjustments`}
        icon={WalletCards}
        trend="up"
      />
      <MetricCard
        label="Booked revenue"
        value={inr.format(metrics.bookedRevenue)}
        detail={`${visibleBookings.length} active reservations`}
        icon={BarChart3}
        trend="up"
      />
      <MetricCard
        label="Received"
        value={inr.format(metrics.received)}
        detail={`${inr.format(metrics.pending)} still pending`}
        icon={CheckCircle2}
        trend="up"
      />
      <MetricCard
        label="Occupancy"
        value={`${metrics.occupancy}%`}
        detail="Confirmed and checked-in units"
        icon={BedDouble}
        trend="flat"
      />
      <MetricCard
        label="Expenses"
        value={inr.format(metrics.expenses)}
        detail={`${inr.format(metrics.salaryExpenses)} staff salaries`}
        icon={ReceiptText}
        trend="down"
      />
    </section>
  );
}

export function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  trend,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof BarChart3;
  trend: "up" | "down" | "flat";
}) {
  return (
    <article className="metric-card rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="metric-value mt-2 text-slate-950">
            {value}
          </p>
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-md bg-slate-100 text-teal-700">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2 text-xs font-medium text-slate-500">
        {trend === "up" && <ArrowUpRight className="h-4 w-4 text-teal-600" />}
        {trend === "down" && (
          <ArrowDownRight className="h-4 w-4 text-red-600" />
        )}
        {trend === "flat" && <Clock3 className="h-4 w-4 text-amber-600" />}
        {detail}
      </div>
    </article>
  );
}

export function OverviewFocus({
  bookings,
  accounts,
  customers,
  homestays,
}: {
  bookings: Booking[];
  accounts: AccountEntry[];
  customers: DashboardData["customers"];
  homestays: Homestay[];
}) {
  return (
    <section className="grid min-w-0 gap-5 xl:grid-cols-2">
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4">
          <h2 className="text-base font-semibold text-slate-950">
            Upcoming bookings
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            A short operational view. Use Bookings for the full pipeline.
          </p>
        </div>
        <div className="divide-y divide-slate-100">
          {bookings.length === 0 && (
            <EmptyState message="No bookings in the selected range." />
          )}
          {bookings.slice(0, 4).map((booking) => {
            const customer = customers.find(
              (item) => item.id === booking.customerId,
            );
            const homestay = homestays.find(
              (item) => item.id === booking.homestayId,
            );

            return (
              <div
                key={booking.id}
                className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_120px] md:items-center"
              >
                <div>
                  <p className="font-medium text-slate-950">
                    {customer?.name ?? "Guest"} - {booking.room}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {homestay?.name ?? "Homestay"} -{" "}
                    {formatDate(booking.checkIn)} to{" "}
                    {formatDate(booking.checkOut)}
                  </p>
                </div>
                <p className="text-right text-sm font-semibold text-slate-950">
                  {inr.format(booking.amount)}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4">
          <h2 className="text-base font-semibold text-slate-950">
            Recent account entries
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Latest income, expenses, and booking adjustments.
          </p>
        </div>
        <div className="divide-y divide-slate-100">
          {accounts.length === 0 && (
            <EmptyState message="No account entries in the selected range." />
          )}
          {accounts.slice(0, 5).map((entry) => {
            const homestay = homestays.find(
              (item) => item.id === entry.homestayId,
            );

            return (
              <div
                key={entry.id}
                className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_120px] md:items-center"
              >
                <div>
                  <p className="font-medium text-slate-950">{entry.label}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {homestay?.name ?? "Homestay"} - {entry.category}
                  </p>
                </div>
                <p
                  className={`text-right text-sm font-semibold ${
                    entry.type === "income" ? "text-teal-700" : "text-red-700"
                  }`}
                >
                  {entry.type === "income" ? "+" : "-"}
                  {inr.format(entry.amount)}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
