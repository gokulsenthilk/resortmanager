import { MapPin, Pencil, Plus } from "lucide-react";
import { FormEvent } from "react";
import type { Booking, Homestay, Room } from "@/lib/types";

import { RoomListEditor } from "./rooms";
import { inr, type HomestayForm, type HomestayEditForm } from "./shared";
import { Field, Stat } from "./ui";
import { normalizeHomestayRoomForms } from "./utils";

export function HomestayCreateForm({
  form,
  isSaving,
  error,
  disabled,
  onChange,
  onSubmit,
  onCancel,
}: {
  form: HomestayForm;
  isSaving: boolean;
  error: string;
  disabled: boolean;
  onChange: (form: HomestayForm) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">
            Add Homestay
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Create a property and define its rooms or floors.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700 transition hover:border-slate-300"
        >
          Cancel
        </button>
      </div>

      <form className="mt-5 grid gap-4 lg:grid-cols-3" onSubmit={onSubmit}>
        <Field label="Homestay name">
          <input
            value={form.name}
            onChange={(event) =>
              onChange({ ...form, name: event.target.value })
            }
            className="field-control"
            required
            disabled={disabled}
          />
        </Field>
        <Field label="Location">
          <input
            value={form.location}
            onChange={(event) =>
              onChange({ ...form, location: event.target.value })
            }
            className="field-control"
            required
            disabled={disabled}
          />
        </Field>
        <Field label="Manager">
          <input
            value={form.managerName}
            onChange={(event) =>
              onChange({ ...form, managerName: event.target.value })
            }
            className="field-control"
            disabled={disabled}
          />
        </Field>
        <Field label="Nightly rate">
          <input
            type="number"
            min="0"
            value={form.nightlyRate}
            onChange={(event) =>
              onChange({ ...form, nightlyRate: Number(event.target.value) })
            }
            className="field-control"
            required
            disabled={disabled}
          />
        </Field>
        <div className="lg:col-span-3">
          <RoomListEditor
            rooms={form.rooms}
            defaultRate={form.nightlyRate}
            disabled={disabled}
            onChange={(rooms) =>
              onChange({ ...form, rooms, units: rooms.length || 1 })
            }
          />
        </div>
        <div className="lg:col-span-3">
          <button
            type="submit"
            disabled={disabled || isSaving}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <Plus className="h-4 w-4" />
            {isSaving ? "Adding homestay" : "Add Homestay"}
          </button>
          {disabled && (
            <p className="mt-2 text-sm text-slate-500">
              Sign in to Supabase before adding homestays.
            </p>
          )}
          {error && (
            <p className="mt-2 text-sm font-medium text-red-700">{error}</p>
          )}
        </div>
      </form>
    </section>
  );
}

export function HomestayEditFormPanel({
  form,
  isSaving,
  error,
  disabled,
  onChange,
  onSubmit,
}: {
  form: HomestayEditForm;
  isSaving: boolean;
  error: string;
  disabled: boolean;
  onChange: (form: HomestayEditForm) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const canSubmit = Boolean(
    form.homestayId &&
      form.name &&
      form.location &&
      normalizeHomestayRoomForms(form.rooms, form.nightlyRate).length > 0 &&
      !isSaving,
  );

  return (
    <section className="min-w-0 bg-white">
      <h2 className="text-base font-semibold text-slate-950">Edit Homestay</h2>
      <p className="mt-1 text-sm text-slate-500">
        Update property details, manager, status, rate, and rooms.
      </p>

      <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={onSubmit}>
        <Field label="Homestay name">
          <input
            value={form.name}
            onChange={(event) => onChange({ ...form, name: event.target.value })}
            className="field-control"
            required
            disabled={disabled}
          />
        </Field>
        <Field label="Location">
          <input
            value={form.location}
            onChange={(event) =>
              onChange({ ...form, location: event.target.value })
            }
            className="field-control"
            required
            disabled={disabled}
          />
        </Field>
        <Field label="Manager">
          <input
            value={form.managerName}
            onChange={(event) =>
              onChange({ ...form, managerName: event.target.value })
            }
            className="field-control"
            disabled={disabled}
          />
        </Field>
        <Field label="Status">
          <select
            value={form.status}
            onChange={(event) =>
              onChange({
                ...form,
                status: event.target.value as Homestay["status"],
              })
            }
            className="field-control"
            disabled={disabled}
          >
            <option value="active">Active</option>
            <option value="maintenance">Maintenance</option>
            <option value="paused">Paused</option>
          </select>
        </Field>
        <Field label="Nightly rate">
          <input
            type="number"
            min="0"
            value={form.nightlyRate}
            onChange={(event) =>
              onChange({ ...form, nightlyRate: Number(event.target.value) })
            }
            className="field-control"
            required
            disabled={disabled}
          />
        </Field>
        <div className="sm:col-span-2">
          <RoomListEditor
            rooms={form.rooms}
            defaultRate={form.nightlyRate}
            disabled={disabled}
            onChange={(rooms) =>
              onChange({ ...form, rooms, units: rooms.length || 1 })
            }
          />
        </div>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={disabled || !canSubmit}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-slate-950 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <Pencil className="h-4 w-4" />
            {isSaving ? "Saving changes" : "Update Homestay"}
          </button>
          {disabled && (
            <p className="mt-2 text-sm text-slate-500">
              Sign in to Supabase before editing homestays.
            </p>
          )}
          {error && (
            <p className="mt-2 text-sm font-medium text-red-700">{error}</p>
          )}
        </div>
      </form>
    </section>
  );
}

export function HomestayGrid({
  selectedHomestayId,
  homestays,
  rooms,
  bookings,
  onEditHomestay,
}: {
  selectedHomestayId: string;
  homestays: Homestay[];
  rooms: Room[];
  bookings: Booking[];
  onEditHomestay: (homestay: Homestay) => void;
}) {
  const visibleHomestays =
    selectedHomestayId === "all"
      ? homestays
      : homestays.filter((homestay) => homestay.id === selectedHomestayId);

  return (
    <section className="grid min-w-0 gap-4 lg:grid-cols-3">
      {visibleHomestays.map((homestay) => (
        <HomestayCard
          key={homestay.id}
          homestay={homestay}
          rooms={rooms.filter((room) => room.homestayId === homestay.id)}
          bookings={bookings}
          onEditHomestay={onEditHomestay}
        />
      ))}
    </section>
  );
}

export function HomestayCard({
  homestay,
  rooms,
  bookings,
  onEditHomestay,
}: {
  homestay: Homestay;
  rooms: Room[];
  bookings: Booking[];
  onEditHomestay: (homestay: Homestay) => void;
}) {
  const activeRooms = rooms.filter((room) => room.isActive);
  const homestayBookings = bookings.filter(
    (booking) => booking.homestayId === homestay.id,
  );
  const revenue = homestayBookings.reduce(
    (total, booking) => total + booking.amount,
    0,
  );

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-950">
            {homestay.name}
          </h2>
          <p className="mt-1 flex items-center gap-1 text-sm text-slate-500">
            <MapPin className="h-4 w-4" />
            {homestay.location}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={`rounded-md border px-2 py-1 text-xs font-semibold ${
              homestay.status === "active"
                ? "border-teal-200 bg-teal-50 text-teal-700"
                : "border-amber-200 bg-amber-50 text-amber-700"
            }`}
          >
            {homestay.status}
          </span>
          <button
            type="button"
            onClick={() => onEditHomestay(homestay)}
            className="grid h-8 w-8 place-items-center rounded-md border border-slate-200 text-slate-700 transition hover:border-slate-300"
            aria-label={`Edit ${homestay.name}`}
          >
            <Pencil className="h-4 w-4" />
          </button>
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-3 gap-3">
        <Stat label="Units" value={String(activeRooms.length || homestay.units)} />
        <Stat label="Rate" value={inr.format(homestay.nightlyRate)} />
        <Stat label="Revenue" value={inr.format(revenue)} />
      </dl>

      <div className="mt-5 border-t border-slate-100 pt-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Rooms
          </p>
          <span className="text-xs text-slate-400">
            {activeRooms.length || 0} active
          </span>
        </div>
        {activeRooms.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {activeRooms.map((room) => (
              <span
                key={room.id}
                className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
              >
                {room.name}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-500">No rooms configured.</p>
        )}
      </div>

      <div className="mt-5 border-t border-slate-100 pt-4 text-sm text-slate-600">
        Manager:{" "}
        <span className="font-medium text-slate-900">{homestay.manager}</span>
      </div>
    </article>
  );
}
