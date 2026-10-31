import type { Booking, Homestay } from "@/lib/types";
import type { PickerOption } from "./picker";

const BADGE_COLORS = ["#426043", "#b66243", "#516353", "#8f4a31", "#607d4c", "#304a3e"];

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? parts[0]?.[1] ?? "")).toUpperCase() || "?";
}

function badgeColor(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0;
  return BADGE_COLORS[Math.abs(h) % BADGE_COLORS.length];
}

function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Homestay options with an initials badge, the town as the sub-line and an "N arriving today" tag (when bookings are passed). */
export function homestayPickerOptions(homestays: Homestay[], bookings?: Booking[]): PickerOption<string>[] {
  const today = localToday();
  return homestays.map((h) => {
    const arriving = bookings?.filter((b) => b.homestayId === h.id && b.checkIn.slice(0, 10) === today && b.status !== "cancelled").length ?? 0;
    return {
      value: h.id,
      label: h.name,
      sub: h.location || undefined,
      badge: { text: initials(h.name), color: badgeColor(h.id) },
      tag: arriving > 0 ? `${arriving} arriving today` : undefined,
    };
  });
}

export const toOptions = (values: readonly string[], labels?: Record<string, string>): PickerOption<string>[] =>
  values.map((v) => ({ value: v, label: labels?.[v] ?? v }));
