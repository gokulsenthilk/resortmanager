import { Plus, X } from "lucide-react";

import type { HomestayRoomForm } from "./shared";
import { Field } from "./ui";
import { createBlankRoomForm } from "./utils";

export function RoomListEditor({
  rooms,
  defaultRate,
  disabled,
  onChange,
}: {
  rooms: HomestayRoomForm[];
  defaultRate: number;
  disabled: boolean;
  onChange: (rooms: HomestayRoomForm[]) => void;
}) {
  function updateRoom(index: number, nextRoom: HomestayRoomForm) {
    onChange(rooms.map((room, roomIndex) => (roomIndex === index ? nextRoom : room)));
  }

  function addRoom() {
    onChange([...rooms, createBlankRoomForm(defaultRate)]);
  }

  function removeRoom(index: number) {
    const nextRooms = rooms.filter((_room, roomIndex) => roomIndex !== index);

    onChange(nextRooms.length > 0 ? nextRooms : [createBlankRoomForm(defaultRate)]);
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-950">Rooms</p>
          <p className="mt-1 text-xs text-slate-500">
            Add bookable room/floor names such as Ground floor, Top floor, or Room 1.
          </p>
        </div>
        <button
          type="button"
          onClick={addRoom}
          disabled={disabled}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:text-slate-300"
        >
          <Plus className="h-4 w-4" />
          Add room
        </button>
      </div>
      <div className="mt-3 space-y-3">
        {rooms.map((room, index) => (
          <div
            key={room.id ?? `new-room-${index}`}
            className="grid gap-3 rounded-md border border-slate-200 bg-white p-3 lg:grid-cols-[minmax(0,1fr)_120px_150px_auto]"
          >
            <Field label="Room / floor name">
              <input
                value={room.name}
                placeholder="Ground floor"
                onChange={(event) =>
                  updateRoom(index, { ...room, name: event.target.value })
                }
                className="field-control"
                required
                disabled={disabled}
              />
            </Field>
            <Field label="Capacity">
              <input
                type="number"
                min="1"
                value={room.capacity}
                onChange={(event) =>
                  updateRoom(index, {
                    ...room,
                    capacity: Number(event.target.value),
                  })
                }
                className="field-control"
                required
                disabled={disabled}
              />
            </Field>
            <Field label="Rate">
              <input
                type="number"
                min="0"
                value={room.nightlyRate}
                onChange={(event) =>
                  updateRoom(index, {
                    ...room,
                    nightlyRate: Number(event.target.value),
                  })
                }
                className="field-control"
                required
                disabled={disabled}
              />
            </Field>
            <button
              type="button"
              onClick={() => removeRoom(index)}
              disabled={disabled || rooms.length === 1}
              className="inline-flex h-10 items-center justify-center gap-2 self-end rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:text-slate-300"
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
