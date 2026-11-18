import type {
  AccountEntry,
  Booking,
  DashboardData,
  Homestay,
  Room,
  StaffPaymentMethod,
  StaffSalaryPayment,
} from "@/lib/types";

import {
  inr,
  dateFormatter,
  type BookingForm,
  type HomestayRoomForm,
  type StaffForm,
  type StaffSalaryPaymentForm,
  type BookingEntryForm,
  type CommonExpenseForm,
} from "./shared";

export function formatDate(value: string) {
  if (!value) {
    return "No date";
  }

  return dateFormatter.format(new Date(`${value}T00:00:00`));
}

export function formatDateRangeLabel(from: string, to: string) {
  if (from && to) {
    return `${formatDate(from)} - ${formatDate(to)}`;
  }

  if (from) {
    return `From ${formatDate(from)}`;
  }

  if (to) {
    return `Until ${formatDate(to)}`;
  }

  return "All dates";
}

export function formatSalaryPaymentBreakdown(payment: StaffSalaryPayment) {
  const details = [formatMonthLabel(payment.salaryMonth)];

  if (payment.advanceAmount > 0) {
    details.push(`Advance ${inr.format(payment.advanceAmount)}`);
  }

  if (payment.cashAmount > 0) {
    details.push(`Cash ${inr.format(payment.cashAmount)}`);
  }

  if (payment.bankAmount > 0) {
    details.push(`Bank ${inr.format(payment.bankAmount)}`);
  }

  if (payment.incentiveAmount > 0) {
    details.push(`Incentive ${inr.format(payment.incentiveAmount)}`);
  }

  return `Business-wide - ${details.join(" - ")}`;
}

export function salaryMonthDate(month: string) {
  return month ? `${month}-01` : `${todayMonth()}-01`;
}

export function applyStaffPaymentMethod(
  form: StaffSalaryPaymentForm,
  paymentMethod: StaffPaymentMethod,
): StaffSalaryPaymentForm {
  const remainingAmount = Math.max(
    0,
    form.baseAmount + form.incentiveAmount - form.advanceAmount,
  );

  if (paymentMethod === "bank") {
    return {
      ...form,
      paymentMethod,
      cashAmount: 0,
      bankAmount: remainingAmount,
    };
  }

  if (paymentMethod === "split") {
    const cashAmount = Math.round((remainingAmount / 2) * 100) / 100;

    return {
      ...form,
      paymentMethod,
      cashAmount,
      bankAmount: remainingAmount - cashAmount,
    };
  }

  return {
    ...form,
    paymentMethod,
    cashAmount: remainingAmount,
    bankAmount: 0,
  };
}

export function isDateInRange(value: string, from: string, to: string) {
  if (!value) {
    return false;
  }

  if (from && value < from) {
    return false;
  }

  if (to && value > to) {
    return false;
  }

  return true;
}

export function doesStayOverlapRange(
  checkIn: string,
  checkOut: string,
  from: string,
  to: string,
) {
  if (!from && !to) {
    return true;
  }

  if (from && checkOut < from) {
    return false;
  }

  if (to && checkIn > to) {
    return false;
  }

  return true;
}

export function todayIso() {
  return toLocalIsoDate(new Date());
}

export function todayMonth() {
  return todayIso().slice(0, 7);
}

export function startOfMonthIso(date: Date) {
  return toLocalIsoDate(new Date(date.getFullYear(), date.getMonth(), 1));
}

export function endOfMonthIso(date: Date) {
  return toLocalIsoDate(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

export function addDaysIso(date: Date, days: number) {
  const nextDate = new Date(date);

  nextDate.setDate(nextDate.getDate() + days);

  return toLocalIsoDate(nextDate);
}

export function shiftMonth(month: string, amount: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  const nextDate = new Date(year, monthNumber - 1 + amount, 1);

  return toLocalIsoDate(nextDate).slice(0, 7);
}

export function formatMonthLabel(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);

  return new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, monthNumber - 1, 1));
}

export function buildCalendarDays(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const firstDay = new Date(year, monthNumber - 1, 1);
  const startDate = new Date(firstDay);
  const monthIndex = firstDay.getMonth();

  startDate.setDate(firstDay.getDate() - firstDay.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(startDate);

    date.setDate(startDate.getDate() + index);

    return {
      date: toLocalIsoDate(date),
      dayNumber: date.getDate(),
      inMonth: date.getMonth() === monthIndex,
    };
  });
}

export function toLocalIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function isBookingOnCalendarDay(booking: Booking, day: string) {
  const checkOutDisplayDay =
    booking.checkOut > booking.checkIn
      ? addDaysIso(new Date(`${booking.checkOut}T00:00:00`), -1)
      : booking.checkOut;

  return booking.checkIn <= day && checkOutDisplayDay >= day;
}

export function getBookingEntries(entries: AccountEntry[], bookingId: string) {
  return entries.filter((entry) => entry.bookingId === bookingId);
}

export function getEntryNet(entries: AccountEntry[]) {
  return entries.reduce((total, entry) => {
    return total + (entry.type === "income" ? entry.amount : -entry.amount);
  }, 0);
}

export function defaultBookingEntryLabel(category: string) {
  const labels: Record<string, string> = {
    Decoration: "Decoration package",
    BBQ: "BBQ add-on",
    "Camp fire": "Camp fire add-on",
    "Damage recovery": "Damage recovery",
    "Offer discount": "Offer discount",
    Food: "Food service",
    Transport: "Transport service",
    Other: "Booking adjustment",
  };

  return labels[category] ?? "Booking adjustment";
}

export function defaultCommonExpenseLabel(category: string) {
  const labels: Record<string, string> = {
    "Monthly rent": "Monthly rent paid",
    "Maid salary": "Maid salary paid",
    Housekeeping: "Housekeeping expense",
    Electricity: "Electricity bill paid",
    Internet: "Internet bill paid",
    Laundry: "Laundry expense",
    Repairs: "Repair expense",
    Maintenance: "Maintenance expense",
    Supplies: "Supplies purchase",
    "Staff food": "Staff food expense",
    Other: "Common expense",
  };

  return labels[category] ?? "Common expense";
}

export function ensureBookingFormDefaults(
  current: BookingForm,
  data: DashboardData,
): BookingForm {
  const homestayId = data.homestays.some(
    (homestay) => homestay.id === current.homestayId,
  )
    ? current.homestayId
    : (data.homestays[0]?.id ?? "");
  const customerId = data.customers.some(
    (customer) => customer.id === current.customerId,
  )
    ? current.customerId
    : (data.customers[0]?.id ?? "");
  const roomId =
    current.roomId &&
    data.rooms.some(
      (room) => room.id === current.roomId && room.homestayId === homestayId,
    )
      ? current.roomId
      : (data.rooms.find((room) => room.homestayId === homestayId)?.id ?? "");

  return {
    ...current,
    homestayId,
    customerId,
    roomId,
  };
}

export function ensureBookingEntryFormDefaults(
  current: BookingEntryForm,
  data: DashboardData,
): BookingEntryForm {
  const bookingId = data.bookings.some(
    (booking) => booking.id === current.bookingId,
  )
    ? current.bookingId
    : (data.bookings[0]?.id ?? "");

  return {
    ...current,
    bookingId,
  };
}

export function ensureCommonExpenseFormDefaults(
  current: CommonExpenseForm,
  data: DashboardData,
): CommonExpenseForm {
  const homestayId = data.homestays.some(
    (homestay) => homestay.id === current.homestayId,
  )
    ? current.homestayId
    : (data.homestays[0]?.id ?? "");

  return {
    ...current,
    homestayId,
    entryDate: current.entryDate || todayIso(),
    label: current.label || defaultCommonExpenseLabel(current.category),
  };
}

export function createBlankRoomForm(defaultRate = 0): HomestayRoomForm {
  return {
    name: "",
    capacity: 2,
    nightlyRate: defaultRate,
  };
}

export function createBlankStaffForm(): StaffForm {
  return {
    name: "",
    mobileNumber: "",
    email: "",
    dateOfJoining: "",
    aadharNumber: "",
    panNumber: "",
    emergencyContact: "",
    monthlySalary: 0,
    monthlyIncentive: 0,
    employeeType: "Staff",
  };
}

export function normalizeHomestayRoomForms(
  rooms: HomestayRoomForm[],
  defaultRate: number,
) {
  return rooms
    .map((room) => {
      const capacity = Number(room.capacity);
      const nightlyRate = Number(room.nightlyRate);
      const fallbackRate = Number(defaultRate);

      return {
        id: room.id,
        name: room.name.trim(),
        capacity: Number.isFinite(capacity) ? Math.max(1, capacity) : 1,
        nightlyRate: Number.isFinite(nightlyRate)
          ? Math.max(0, nightlyRate)
          : Math.max(0, Number.isFinite(fallbackRate) ? fallbackRate : 0),
      };
    })
    .filter((room) => room.name);
}

const occupyingStatuses = new Set<Booking["status"]>([
  "confirmed",
  "checked_in",
  "checked_out",
]);

/**
 * Occupancy % = occupied room-nights / available room-nights in the period.
 *
 * - Period: the Overview date filter (`from`..`to`, both inclusive nights). An open end falls back
 *   to the earliest check-in / latest check-out of the counted bookings, so "All dates" means the
 *   span the bookings cover.
 * - Available: per homestay, its active rooms (or `units` when no rooms are set up) × nights.
 * - Occupied: confirmed, checked-in and checked-out bookings (not pending or cancelled), one room
 *   per booking for each night from check-in up to (not including) check-out, clamped to the
 *   period and capped at the homestay's rooms on any single night, so double bookings can't push
 *   it past 100%.
 */
export function calculateOccupancy({
  bookings,
  homestays,
  rooms,
  from,
  to,
}: {
  bookings: Booking[];
  homestays: Homestay[];
  rooms: Room[];
  from: string;
  to: string;
}) {
  const homestayIds = new Set(homestays.map((homestay) => homestay.id));
  const counted = bookings.filter(
    (booking) =>
      occupyingStatuses.has(booking.status) &&
      homestayIds.has(booking.homestayId) &&
      booking.checkOut > booking.checkIn,
  );

  const periodStart =
    from || counted.reduce((min, booking) => (!min || booking.checkIn < min ? booking.checkIn : min), "");
  const lastNight = (checkOut: string) =>
    addDaysIso(new Date(`${checkOut}T00:00:00`), -1);
  const periodEnd =
    to ||
    counted.reduce((max, booking) => {
      const night = lastNight(booking.checkOut);
      return !max || night > max ? night : max;
    }, "");

  if (!periodStart || !periodEnd || periodEnd < periodStart) {
    return 0;
  }

  const nights: string[] = [];
  for (
    let night = periodStart;
    night <= periodEnd;
    night = addDaysIso(new Date(`${night}T00:00:00`), 1)
  ) {
    nights.push(night);
  }

  const capacity = new Map(
    homestays.map((homestay) => {
      const activeRooms = rooms.filter(
        (room) => room.homestayId === homestay.id && room.isActive,
      ).length;
      return [homestay.id, activeRooms > 0 ? activeRooms : Math.max(0, homestay.units)];
    }),
  );
  const available =
    [...capacity.values()].reduce((total, value) => total + value, 0) * nights.length;

  if (available === 0) {
    return 0;
  }

  let occupied = 0;
  for (const homestay of homestays) {
    const roomCount = capacity.get(homestay.id) ?? 0;
    const stays = counted.filter((booking) => booking.homestayId === homestay.id);
    for (const night of nights) {
      const booked = stays.filter(
        (booking) => booking.checkIn <= night && booking.checkOut > night,
      ).length;
      occupied += Math.min(booked, roomCount);
    }
  }

  return Math.min(100, Math.round((occupied / available) * 100));
}
