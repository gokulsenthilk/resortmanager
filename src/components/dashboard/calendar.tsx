import { CheckCircle2, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import type { Booking, DashboardData, Homestay } from "@/lib/types";

import { statusStyles, inr } from "./shared";
import { DashboardModal, EmptyState } from "./ui";
import {
  formatDate,
  doesStayOverlapRange,
  todayIso,
  todayMonth,
  shiftMonth,
  formatMonthLabel,
  buildCalendarDays,
  isBookingOnCalendarDay,
} from "./utils";

export function BookingsCalendarView({
  bookings,
  customers,
  homestays,
  month,
  onMonthChange,
}: {
  bookings: Booking[];
  customers: DashboardData["customers"];
  homestays: Homestay[];
  month: string;
  onMonthChange: (month: string) => void;
}) {
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const days = buildCalendarDays(month);
  const monthBookings = bookings.filter((booking) =>
    doesStayOverlapRange(
      booking.checkIn,
      booking.checkOut,
      `${month}-01`,
      days[days.length - 1].date,
    ),
  );

  return (
    <section className="min-w-0 rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">
            Bookings calendar
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Month view of occupied nights across selected homestays.
          </p>
        </div>
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 sm:flex">
          <button
            type="button"
            onClick={() => onMonthChange(shiftMonth(month, -1))}
            className="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
          >
            Prev
          </button>
          <div className="min-w-36 rounded-md border border-slate-200 px-3 py-2 text-center text-sm font-semibold text-slate-950">
            {formatMonthLabel(month)}
          </div>
          <button
            type="button"
            onClick={() => onMonthChange(shiftMonth(month, 1))}
            className="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
          >
            Next
          </button>
          <button
            type="button"
            onClick={() => onMonthChange(todayMonth())}
            className="col-span-3 inline-flex h-9 items-center justify-center rounded-md bg-slate-950 px-3 text-sm font-semibold text-white transition hover:bg-slate-800 sm:col-auto"
          >
            Today
          </button>
        </div>
      </div>

      {monthBookings.length === 0 && (
        <EmptyState message="No bookings fall inside this calendar month for the current filters." />
      )}

      <div className="hidden min-w-0 md:block">
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day} className="px-3 py-2">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const dayBookings = monthBookings.filter((booking) =>
              isBookingOnCalendarDay(booking, day.date),
            );

            return (
              <div
                key={day.date}
                className={`min-h-36 border-b border-r border-slate-100 p-2 ${
                  day.inMonth ? "bg-white" : "bg-slate-50 text-slate-400"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`grid h-7 w-7 place-items-center rounded-md text-sm font-semibold ${
                      day.date === todayIso()
                        ? "bg-teal-700 text-white"
                        : "text-slate-700"
                    }`}
                  >
                    {day.dayNumber}
                  </span>
                  {dayBookings.length > 0 && (
                    <span className="text-xs font-medium text-slate-500">
                      {dayBookings.length}
                    </span>
                  )}
                </div>
                <div className="mt-2 space-y-1">
                  {dayBookings.slice(0, 3).map((booking) => (
                    <CalendarBookingChip
                      key={booking.id}
                      booking={booking}
                      customer={customers.find(
                        (item) => item.id === booking.customerId,
                      )}
                      homestay={homestays.find(
                        (item) => item.id === booking.homestayId,
                      )}
                      onClick={() => setSelectedBooking(booking)}
                    />
                  ))}
                  {dayBookings.length > 3 && (
                    <p className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500">
                      +{dayBookings.length - 3} more
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="divide-y divide-slate-100 md:hidden">
        {days
          .filter((day) => day.inMonth)
          .map((day) => {
            const dayBookings = monthBookings.filter((booking) =>
              isBookingOnCalendarDay(booking, day.date),
            );

            return (
              <div key={day.date} className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">
                      {formatDate(day.date)}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {dayBookings.length} bookings
                    </p>
                  </div>
                  {day.date === todayIso() && (
                    <span className="rounded-md bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-700">
                      Today
                    </span>
                  )}
                </div>
                <div className="mt-3 space-y-2">
                  {dayBookings.length === 0 && (
                    <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-500">
                      No bookings.
                    </p>
                  )}
                  {dayBookings.map((booking) => (
                    <CalendarBookingChip
                      key={booking.id}
                      booking={booking}
                      customer={customers.find(
                        (item) => item.id === booking.customerId,
                      )}
                      homestay={homestays.find(
                        (item) => item.id === booking.homestayId,
                      )}
                      onClick={() => setSelectedBooking(booking)}
                      roomy
                    />
                  ))}
                </div>
              </div>
            );
          })}
      </div>

      {selectedBooking && (
        <DashboardModal
          ariaLabel="Booking details"
          onClose={() => setSelectedBooking(null)}
        >
          <CalendarBookingDetails
            booking={selectedBooking}
            customer={customers.find(
              (item) => item.id === selectedBooking.customerId,
            )}
            homestay={homestays.find(
              (item) => item.id === selectedBooking.homestayId,
            )}
          />
        </DashboardModal>
      )}
    </section>
  );
}

export function CalendarBookingChip({
  booking,
  customer,
  homestay,
  onClick,
  roomy = false,
}: {
  booking: Booking;
  customer?: DashboardData["customers"][number];
  homestay?: Homestay;
  onClick: () => void;
  roomy?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`View booking details for ${customer?.name ?? "guest"}`}
      className={`min-w-0 w-full rounded-md border px-2 py-1.5 text-left transition hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1 ${statusStyles[booking.status]} ${
        roomy ? "px-3 py-2" : ""
      }`}
    >
      <div className="flex min-w-0 items-center justify-between gap-2">
        <p className="truncate text-xs font-semibold">
          {customer?.name ?? "Guest"}
        </p>
        <span className="shrink-0 text-xs">{booking.guests} guests</span>
      </div>
      <p className="mt-0.5 truncate text-xs opacity-80">
        {homestay?.name ?? "Homestay"} - {booking.room}
      </p>
      {roomy && (
        <p className="mt-1 text-xs opacity-80">
          {formatDate(booking.checkIn)} to {formatDate(booking.checkOut)} -{" "}
          {inr.format(booking.amount)}
        </p>
      )}
    </button>
  );
}

export function CalendarBookingDetails({
  booking,
  customer,
  homestay,
}: {
  booking: Booking;
  customer?: DashboardData["customers"][number];
  homestay?: Homestay;
}) {
  const [copyStatus, setCopyStatus] = useState<
    "idle" | "copied" | "error"
  >("idle");
  const phone = customer?.phone?.trim() ?? "";

  useEffect(() => {
    if (copyStatus === "idle") {
      return;
    }

    const timeout = window.setTimeout(() => setCopyStatus("idle"), 2000);
    return () => window.clearTimeout(timeout);
  }, [copyStatus]);

  async function copyMobileNumber() {
    if (!phone) {
      return;
    }

    try {
      await navigator.clipboard.writeText(phone);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("error");
    }
  }

  return (
    <section className="pr-10">
      <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
        Booking details
      </p>
      <h2 className="mt-2 text-xl font-semibold text-slate-950">
        {customer?.name ?? "Guest"}
      </h2>
      <div className="mt-2 flex min-h-9 flex-wrap items-center gap-2">
        <p className="text-sm font-medium text-slate-600">
          {phone || "Mobile number not recorded"}
        </p>
        {phone && (
          <button
            type="button"
            onClick={copyMobileNumber}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 transition hover:border-teal-300 hover:bg-teal-50 hover:text-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
            aria-label={`Copy mobile number ${phone}`}
          >
            {copyStatus === "copied" ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-teal-600" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copyStatus === "copied"
              ? "Copied"
              : copyStatus === "error"
                ? "Try again"
                : "Copy"}
          </button>
        )}
        <span className="sr-only" aria-live="polite">
          {copyStatus === "copied"
            ? "Mobile number copied to clipboard"
            : copyStatus === "error"
              ? "Could not copy mobile number"
              : ""}
        </span>
      </div>

      <dl className="mt-4 grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Homestay
          </dt>
          <dd className="mt-1 text-sm font-medium text-slate-950">
            {homestay?.name ?? "Not assigned"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Room
          </dt>
          <dd className="mt-1 text-sm font-medium text-slate-950">
            {booking.room || "Not assigned"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Stay
          </dt>
          <dd className="mt-1 text-sm font-medium text-slate-950">
            {formatDate(booking.checkIn)} to {formatDate(booking.checkOut)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Guests
          </dt>
          <dd className="mt-1 text-sm font-medium text-slate-950">
            {booking.guests}
          </dd>
        </div>
      </dl>
    </section>
  );
}
