import { Filter, Pencil, Plus, X } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import type {
  AccountEntry,
  Booking,
  BookingStatus,
  DashboardData,
  Homestay,
  Room,
} from "@/lib/types";

import { SearchableCustomerSelect } from "./customers";
import {
  statusLabels,
  statusStyles,
  inr,
  bookingEntryCategories,
  type BookingForm,
  type BookingEditForm,
  type BookingLineItemForm,
  type BookingEntryForm,
} from "./shared";
import { DateRangeControl, EmptyState, Field } from "./ui";
import {
  formatDate,
  doesStayOverlapRange,
  getBookingEntries,
  getEntryNet,
  defaultBookingEntryLabel,
} from "./utils";

export function BookingTable({
  bookings: visibleBookings,
  customers,
  homestays,
  accountEntries,
  onEditBooking,
}: {
  bookings: Booking[];
  customers: DashboardData["customers"];
  homestays: Homestay[];
  accountEntries: AccountEntry[];
  onEditBooking: (booking: Booking) => void;
}) {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<BookingStatus | "all">(
    "all",
  );
  const [channelFilter, setChannelFilter] = useState<Booking["channel"] | "all">(
    "all",
  );
  const [bookingDateFrom, setBookingDateFrom] = useState("");
  const [bookingDateTo, setBookingDateTo] = useState("");
  const channelOptions = useMemo(() => {
    return Array.from(
      new Set(visibleBookings.map((booking) => booking.channel)),
    ).sort();
  }, [visibleBookings]);
  const filteredBookings = useMemo(() => {
    return visibleBookings.filter((booking) => {
      const matchesStatus =
        statusFilter === "all" || booking.status === statusFilter;
      const matchesChannel =
        channelFilter === "all" || booking.channel === channelFilter;
      const matchesDate = doesStayOverlapRange(
        booking.checkIn,
        booking.checkOut,
        bookingDateFrom,
        bookingDateTo,
      );

      return matchesStatus && matchesChannel && matchesDate;
    });
  }, [
    bookingDateFrom,
    bookingDateTo,
    channelFilter,
    statusFilter,
    visibleBookings,
  ]);
  const hasBookingFilter =
    statusFilter !== "all" ||
    channelFilter !== "all" ||
    Boolean(bookingDateFrom || bookingDateTo);

  function clearBookingFilters() {
    setStatusFilter("all");
    setChannelFilter("all");
    setBookingDateFrom("");
    setBookingDateTo("");
  }

  return (
    <section className="min-w-0 rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">
            Booking pipeline
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Upcoming reservations across selected homestays.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsFilterOpen((current) => !current)}
          className={`inline-flex h-9 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium transition ${
            hasBookingFilter
              ? "border-teal-200 bg-teal-50 text-teal-800"
              : "border-slate-200 text-slate-700 hover:border-slate-300"
          }`}
        >
          <Filter className="h-4 w-4" />
          {hasBookingFilter ? `Filter (${filteredBookings.length})` : "Filter"}
        </button>
      </div>

      {isFilterOpen && (
        <div className="grid gap-3 border-b border-slate-200 bg-slate-50 p-4 md:grid-cols-[180px_180px_minmax(260px,360px)_minmax(0,1fr)_auto] md:items-end">
          <Field label="Status">
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as BookingStatus | "all")
              }
              className="field-control"
            >
              <option value="all">All statuses</option>
              {(Object.keys(statusLabels) as BookingStatus[]).map((status) => (
                <option key={status} value={status}>
                  {statusLabels[status]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Channel">
            <select
              value={channelFilter}
              onChange={(event) =>
                setChannelFilter(event.target.value as Booking["channel"] | "all")
              }
              className="field-control"
            >
              <option value="all">All channels</option>
              {channelOptions.map((channel) => (
                <option key={channel} value={channel}>
                  {channel}
                </option>
              ))}
            </select>
          </Field>
          <DateRangeControl
            dateFrom={bookingDateFrom}
            dateTo={bookingDateTo}
            label="Stay date range"
            onDateFromChange={setBookingDateFrom}
            onDateToChange={setBookingDateTo}
          />
          <p className="text-sm text-slate-500">
            Showing {filteredBookings.length} of {visibleBookings.length} bookings.
          </p>
          <button
            type="button"
            onClick={clearBookingFilters}
            disabled={!hasBookingFilter}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:text-slate-300"
          >
            <X className="h-4 w-4" />
            Clear
          </button>
        </div>
      )}

      {visibleBookings.length === 0 && (
        <EmptyState message="No bookings matched the current homestay and search filters." />
      )}
      {visibleBookings.length > 0 && filteredBookings.length === 0 && (
        <EmptyState message="No bookings matched the selected booking filters." />
      )}

      <div className="divide-y divide-slate-100 md:hidden">
        {filteredBookings.map((booking) => {
          const customer = customers.find(
            (item) => item.id === booking.customerId,
          );
          const homestay = homestays.find(
            (item) => item.id === booking.homestayId,
          );
          const bookingEntries = getBookingEntries(accountEntries, booking.id);
          const netAdjustment = getEntryNet(bookingEntries);

          return (
            <article key={booking.id} className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-slate-950">
                    <span>{customer?.name ?? "Guest"}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                      {booking.channel}
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {homestay?.name}
                  </p>
                </div>
                <span
                  className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${statusStyles[booking.status]}`}
                >
                  {statusLabels[booking.status]}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">
                  {booking.room}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {homestay?.name} - {formatDate(booking.checkIn)} to{" "}
                  {formatDate(booking.checkOut)}
                </p>
              </div>
              <div className="flex items-end justify-between gap-3">
                <p className="text-xs text-slate-500">
                  {booking.guests} guests
                </p>
                <div className="text-right">
                  <p className="font-semibold text-slate-950">
                    {inr.format(booking.amount)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {inr.format(booking.amount - booking.paid)} due
                  </p>
                </div>
              </div>
              <BookingEntryList
                entries={bookingEntries}
                netAdjustment={netAdjustment}
              />
              <button
                type="button"
                onClick={() => onEditBooking(booking)}
                className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-slate-200 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
              >
                <Pencil className="h-4 w-4" />
                Edit booking
              </button>
            </article>
          );
        })}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Guest</th>
              <th className="px-4 py-3 font-semibold">Stay</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 text-right font-semibold">Amount</th>
              <th className="px-4 py-3 text-right font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredBookings.map((booking) => {
              const customer = customers.find(
                (item) => item.id === booking.customerId,
              );
              const homestay = homestays.find(
                (item) => item.id === booking.homestayId,
              );
              const bookingEntries = getBookingEntries(
                accountEntries,
                booking.id,
              );
              const netAdjustment = getEntryNet(bookingEntries);

              return (
                <tr key={booking.id} className="hover:bg-slate-50">
                  <td className="px-4 py-4">
                    <p className="flex flex-wrap items-center gap-2 font-medium text-slate-900">
                      <span>{customer?.name ?? "Guest"}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                        {booking.channel}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {homestay?.name}
                    </p>
                  </td>
                  <td className="px-4 py-4">
                    <p className="font-medium text-slate-900">{booking.room}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatDate(booking.checkIn)} -{" "}
                      {formatDate(booking.checkOut)} - {booking.guests} guests
                    </p>
                    <BookingEntryList
                      entries={bookingEntries}
                      netAdjustment={netAdjustment}
                      compact
                    />
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${statusStyles[booking.status]}`}
                    >
                      {statusLabels[booking.status]}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <p className="font-semibold text-slate-950">
                      {inr.format(booking.amount)}
                    </p>
                    {bookingEntries.length > 0 && (
                      <p
                        className={`mt-1 text-xs font-semibold ${
                          netAdjustment >= 0 ? "text-teal-700" : "text-red-700"
                        }`}
                      >
                        {netAdjustment >= 0 ? "+" : "-"}
                        {inr.format(Math.abs(netAdjustment))} extras
                      </p>
                    )}
                    <p className="mt-1 text-xs text-slate-500">
                      {inr.format(booking.amount - booking.paid)} due
                    </p>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => onEditBooking(booking)}
                      className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
                    >
                      <Pencil className="h-4 w-4" />
                      Edit
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function QuickBookingForm({
  form,
  customers,
  homestays,
  rooms,
  isSaving,
  saveError,
  variant = "card",
  onChange,
  onAddCustomerClick,
  onSubmit,
}: {
  form: BookingForm;
  customers: DashboardData["customers"];
  homestays: Homestay[];
  rooms: Room[];
  isSaving: boolean;
  saveError: string;
  variant?: "card" | "modal";
  onChange: (form: BookingForm) => void;
  onAddCustomerClick: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const canSubmit = Boolean(
    form.customerId &&
    form.homestayId &&
    form.checkIn &&
    form.checkOut &&
    !isSaving,
  );

  return (
    <section
      className={
        variant === "modal"
          ? "min-w-0 bg-white"
          : "min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
      }
    >
      <h2 className="text-base font-semibold text-slate-950">Quick booking</h2>
      <p className="mt-1 text-sm text-slate-500">
        Capture direct and walk-in enquiries without leaving the dashboard.
      </p>

      <form className="mt-5 space-y-4" onSubmit={onSubmit}>
        <div>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Customer
          </span>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <SearchableCustomerSelect
              key={form.customerId}
              customers={customers}
              selectedCustomerId={form.customerId}
              onSelect={(customerId) => onChange({ ...form, customerId })}
            />
            <button
              type="button"
              onClick={onAddCustomerClick}
              className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 transition hover:border-slate-300"
            >
              <Plus className="h-4 w-4" />
              Add Customer
            </button>
          </div>
        </div>

        <Field label="Homestay">
          <select
            value={form.homestayId}
            onChange={(event) => {
              const nextHomestayId = event.target.value;

              onChange({ ...form, homestayId: nextHomestayId, roomId: "" });
            }}
            className="field-control"
            disabled={homestays.length === 0}
          >
            {homestays.length === 0 && (
              <option value="">No homestays found</option>
            )}
            {homestays.map((homestay) => (
              <option key={homestay.id} value={homestay.id}>
                {homestay.name}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Check in">
            <input
              type="date"
              value={form.checkIn}
              onChange={(event) =>
                onChange({ ...form, checkIn: event.target.value })
              }
              className="field-control"
            />
          </Field>
          <Field label="Check out">
            <input
              type="date"
              value={form.checkOut}
              onChange={(event) =>
                onChange({ ...form, checkOut: event.target.value })
              }
              className="field-control"
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Room">
            <select
              value={form.roomId}
              onChange={(event) =>
                onChange({ ...form, roomId: event.target.value })
              }
              className="field-control"
            >
              <option value="">No room assigned</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Guests">
            <input
              type="number"
              min="1"
              value={form.guests}
              onChange={(event) =>
                onChange({ ...form, guests: Number(event.target.value) })
              }
              className="field-control"
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Amount">
            <input
              type="number"
              min="0"
              value={form.amount}
              onChange={(event) =>
                onChange({ ...form, amount: Number(event.target.value) })
              }
              className="field-control"
            />
          </Field>
          <Field label="Advance paid">
            <input
              type="number"
              min="0"
              value={form.paid}
              onChange={(event) =>
                onChange({ ...form, paid: Number(event.target.value) })
              }
              className="field-control"
            />
          </Field>
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-slate-950 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <Plus className="h-4 w-4" />
          {isSaving ? "Saving" : "Save booking"}
        </button>
        {saveError && (
          <p className="text-sm font-medium text-red-700">{saveError}</p>
        )}
      </form>
    </section>
  );
}

export function BookingEditFormPanel({
  form,
  customers,
  homestays,
  rooms,
  isSaving,
  saveError,
  onChange,
  onSubmit,
}: {
  form: BookingEditForm;
  customers: DashboardData["customers"];
  homestays: Homestay[];
  rooms: Room[];
  isSaving: boolean;
  saveError: string;
  onChange: (form: BookingEditForm) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const canSubmit = Boolean(
    form.bookingId &&
      form.customerId &&
      form.homestayId &&
      form.checkIn &&
      form.checkOut &&
      !isSaving,
  );

  return (
    <section className="min-w-0 bg-white">
      <h2 className="text-base font-semibold text-slate-950">Edit booking</h2>
      <p className="mt-1 break-all text-sm text-slate-500">
        Update reservation details, payment, status, and amount for {form.bookingId}.
      </p>

      <form className="mt-5 space-y-4" onSubmit={onSubmit}>
        <div>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Customer
          </span>
          <SearchableCustomerSelect
            key={form.customerId}
            customers={customers}
            selectedCustomerId={form.customerId}
            onSelect={(customerId) => onChange({ ...form, customerId })}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Homestay">
            <select
              value={form.homestayId}
              onChange={(event) => {
                const nextHomestayId = event.target.value;

                onChange({ ...form, homestayId: nextHomestayId, roomId: "" });
              }}
              className="field-control"
              disabled={homestays.length === 0}
            >
              {homestays.length === 0 && (
                <option value="">No homestays found</option>
              )}
              {homestays.map((homestay) => (
                <option key={homestay.id} value={homestay.id}>
                  {homestay.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Room">
            <select
              value={form.roomId}
              onChange={(event) =>
                onChange({ ...form, roomId: event.target.value })
              }
              className="field-control"
            >
              <option value="">No room assigned</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Check in">
            <input
              type="date"
              value={form.checkIn}
              onChange={(event) =>
                onChange({ ...form, checkIn: event.target.value })
              }
              className="field-control"
            />
          </Field>
          <Field label="Check out">
            <input
              type="date"
              value={form.checkOut}
              onChange={(event) =>
                onChange({ ...form, checkOut: event.target.value })
              }
              className="field-control"
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Status">
            <select
              value={form.status}
              onChange={(event) =>
                onChange({
                  ...form,
                  status: event.target.value as BookingStatus,
                })
              }
              className="field-control"
            >
              {(Object.keys(statusLabels) as BookingStatus[]).map((status) => (
                <option key={status} value={status}>
                  {statusLabels[status]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Channel">
            <select
              value={form.channel}
              onChange={(event) =>
                onChange({
                  ...form,
                  channel: event.target.value as Booking["channel"],
                })
              }
              className="field-control"
            >
              {["Direct", "Airbnb", "Booking.com", "Walk-in"].map((channel) => (
                <option key={channel} value={channel}>
                  {channel}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Guests">
            <input
              type="number"
              min="1"
              value={form.guests}
              onChange={(event) =>
                onChange({ ...form, guests: Number(event.target.value) })
              }
              className="field-control"
            />
          </Field>
          <Field label="Amount">
            <input
              type="number"
              min="0"
              value={form.amount}
              onChange={(event) =>
                onChange({ ...form, amount: Number(event.target.value) })
              }
              className="field-control"
            />
          </Field>
          <Field label="Paid">
            <input
              type="number"
              min="0"
              value={form.paid}
              onChange={(event) =>
                onChange({ ...form, paid: Number(event.target.value) })
              }
              className="field-control"
            />
          </Field>
        </div>

        <BookingLineItemsEditor
          lineItems={form.lineItems}
          onChange={(lineItems) => onChange({ ...form, lineItems })}
        />

        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-slate-950 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <Pencil className="h-4 w-4" />
          {isSaving ? "Saving changes" : "Update booking"}
        </button>
        {saveError && (
          <p className="text-sm font-medium text-red-700">{saveError}</p>
        )}
      </form>
    </section>
  );
}

export function BookingLineItemsEditor({
  lineItems,
  onChange,
}: {
  lineItems: BookingLineItemForm[];
  onChange: (lineItems: BookingLineItemForm[]) => void;
}) {
  const income = lineItems
    .filter((item) => item.type === "income")
    .reduce((total, item) => total + Number(item.amount || 0), 0);
  const expense = lineItems
    .filter((item) => item.type === "expense")
    .reduce((total, item) => total + Number(item.amount || 0), 0);

  function addLineItem() {
    onChange([
      ...lineItems,
      {
        type: "income",
        category: "Decoration",
        label: defaultBookingEntryLabel("Decoration"),
        amount: 0,
        isCleared: false,
      },
    ]);
  }

  function updateLineItem(index: number, nextItem: BookingLineItemForm) {
    onChange(
      lineItems.map((item, itemIndex) =>
        itemIndex === index ? nextItem : item,
      ),
    );
  }

  function removeLineItem(index: number) {
    onChange(lineItems.filter((_item, itemIndex) => itemIndex !== index));
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-950">
            Booking income / expense
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Edit decoration, BBQ, camp fire, damage recovery, offers, and other booking items.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-800">
            +{inr.format(income)}
          </span>
          <span className="rounded-md bg-red-50 px-2 py-1 text-xs font-semibold text-red-800">
            -{inr.format(expense)}
          </span>
          <button
            type="button"
            onClick={addLineItem}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
          >
            <Plus className="h-4 w-4" />
            Add item
          </button>
        </div>
      </div>

      <div className="mt-3 space-y-3">
        {lineItems.length === 0 && (
          <p className="rounded-md border border-dashed border-slate-200 bg-white p-3 text-sm text-slate-500">
            No booking-level income or expense items yet.
          </p>
        )}
        {lineItems.map((item, index) => (
          <div
            key={item.id ?? `new-line-item-${index}`}
            className="grid min-w-0 gap-3 rounded-md border border-slate-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-12"
          >
            <div className="min-w-0 lg:col-span-3">
              <Field label="Type">
                <select
                  value={item.type}
                  onChange={(event) =>
                    updateLineItem(index, {
                      ...item,
                      type: event.target.value as BookingLineItemForm["type"],
                    })
                  }
                  className="field-control"
                >
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                </select>
              </Field>
            </div>
            <div className="min-w-0 lg:col-span-4">
              <Field label="Category">
                <select
                  value={item.category}
                  onChange={(event) =>
                    updateLineItem(index, {
                      ...item,
                      category: event.target.value,
                      label: defaultBookingEntryLabel(event.target.value),
                    })
                  }
                  className="field-control"
                >
                  {bookingEntryCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="min-w-0 sm:col-span-2 lg:col-span-5">
              <Field label="Label">
                <input
                  value={item.label}
                  onChange={(event) =>
                    updateLineItem(index, {
                      ...item,
                      label: event.target.value,
                    })
                  }
                  className="field-control"
                />
              </Field>
            </div>
            <div className="min-w-0 lg:col-span-4">
              <Field label="Amount">
                <input
                  type="number"
                  min="0"
                  value={item.amount}
                  onChange={(event) =>
                    updateLineItem(index, {
                      ...item,
                      amount: Number(event.target.value),
                    })
                  }
                  className="field-control"
                />
              </Field>
            </div>
            <label className="flex h-10 min-w-0 items-center gap-2 self-end rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700 lg:col-span-4">
              <input
                type="checkbox"
                checked={item.isCleared}
                onChange={(event) =>
                  updateLineItem(index, {
                    ...item,
                    isCleared: event.target.checked,
                  })
                }
                className="h-4 w-4 rounded border-slate-300 text-teal-700"
              />
              Cleared
            </label>
            <button
              type="button"
              onClick={() => removeLineItem(index)}
              className="inline-flex h-10 min-w-0 items-center justify-center gap-2 self-end rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 lg:col-span-4"
            >
              <X className="h-4 w-4" />
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BookingEntryFormPanel({
  form,
  bookings,
  customers,
  isSaving,
  saveError,
  variant = "card",
  onChange,
  onSubmit,
}: {
  form: BookingEntryForm;
  bookings: Booking[];
  customers: DashboardData["customers"];
  isSaving: boolean;
  saveError: string;
  variant?: "card" | "modal";
  onChange: (form: BookingEntryForm) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const canSubmit = Boolean(
    form.bookingId &&
    form.category &&
    form.label &&
    form.amount > 0 &&
    !isSaving,
  );

  return (
    <section
      className={
        variant === "modal"
          ? "min-w-0 bg-white"
          : "min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
      }
    >
      <h2 className="text-base font-semibold text-slate-950">
        Booking income / expense
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        Add decoration, BBQ, camp fire, damage recovery, offers, or other
        booking-level items.
      </p>

      <form className="mt-5 space-y-4" onSubmit={onSubmit}>
        <Field label="Booking">
          <select
            value={form.bookingId}
            onChange={(event) =>
              onChange({ ...form, bookingId: event.target.value })
            }
            className="field-control"
            disabled={bookings.length === 0}
          >
            {bookings.length === 0 && (
              <option value="">No bookings found</option>
            )}
            {bookings.map((booking) => {
              const customer = customers.find(
                (item) => item.id === booking.customerId,
              );

              return (
                <option key={booking.id} value={booking.id}>
                  {booking.id.slice(0, 8)} - {customer?.name ?? "Guest"} -{" "}
                  {formatDate(booking.checkIn)}
                </option>
              );
            })}
          </select>
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Type">
            <select
              value={form.type}
              onChange={(event) =>
                onChange({
                  ...form,
                  type: event.target.value as BookingEntryForm["type"],
                })
              }
              className="field-control"
            >
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </select>
          </Field>
          <Field label="Category">
            <select
              value={form.category}
              onChange={(event) => {
                const category = event.target.value;

                onChange({
                  ...form,
                  category,
                  label: defaultBookingEntryLabel(category),
                });
              }}
              className="field-control"
            >
              {bookingEntryCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Label">
          <input
            value={form.label}
            onChange={(event) =>
              onChange({ ...form, label: event.target.value })
            }
            className="field-control"
            required
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Amount">
            <input
              type="number"
              min="0"
              value={form.amount}
              onChange={(event) =>
                onChange({ ...form, amount: Number(event.target.value) })
              }
              className="field-control"
              required
            />
          </Field>
          <label className="flex h-10 items-center gap-2 self-end rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={form.isCleared}
              onChange={(event) =>
                onChange({ ...form, isCleared: event.target.checked })
              }
              className="h-4 w-4 rounded border-slate-300 text-teal-700"
            />
            Cleared
          </label>
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-slate-950 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <Plus className="h-4 w-4" />
          {isSaving ? "Saving item" : "Add to booking"}
        </button>
        {saveError && (
          <p className="text-sm font-medium text-red-700">{saveError}</p>
        )}
      </form>
    </section>
  );
}

export function BookingEntryList({
  entries,
  netAdjustment,
  compact = false,
}: {
  entries: AccountEntry[];
  netAdjustment: number;
  compact?: boolean;
}) {
  if (entries.length === 0) {
    return null;
  }

  return (
    <div className={compact ? "mt-2 space-y-1" : "rounded-md bg-slate-50 p-3"}>
      {!compact && (
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Booking items ({netAdjustment >= 0 ? "+" : "-"}
          {inr.format(Math.abs(netAdjustment))})
        </p>
      )}
      {entries.slice(0, compact ? 2 : 4).map((entry) => (
        <div
          key={entry.id}
          className="flex items-center justify-between gap-3 text-xs"
        >
          <span className="min-w-0 truncate text-slate-500">
            {entry.category}: {entry.label}
          </span>
          <span
            className={
              entry.type === "income"
                ? "font-semibold text-teal-700"
                : "font-semibold text-red-700"
            }
          >
            {entry.type === "income" ? "+" : "-"}
            {inr.format(entry.amount)}
          </span>
        </div>
      ))}
      {entries.length > (compact ? 2 : 4) && (
        <p className="text-xs text-slate-400">
          +{entries.length - (compact ? 2 : 4)} more
        </p>
      )}
    </div>
  );
}
