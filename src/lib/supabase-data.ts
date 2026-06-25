import { supabase } from "./supabase";
import type {
  AccountEntry,
  Booking,
  BookingStatus,
  Customer,
  DashboardData,
  Homestay,
  HomestayStatus,
  Room,
} from "./types";

type HomestayRow = {
  id: string;
  name: string;
  location: string;
  manager_name: string | null;
  units: number;
  nightly_rate: string | number;
  status: HomestayStatus;
};

type CustomerRow = {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  city: string | null;
  preferences: string | null;
};

type RoomRow = {
  id: string;
  homestay_id: string;
  name: string;
  capacity: number;
  nightly_rate: string | number;
  is_active: boolean;
};

type BookingRow = {
  id: string;
  homestay_id: string;
  room_id: string | null;
  customer_id: string;
  check_in: string;
  check_out: string;
  guest_count: number;
  status: BookingStatus;
  channel: string;
  total_amount: string | number;
  amount_paid: string | number;
};

type AccountEntryRow = {
  id: string;
  homestay_id: string;
  booking_id: string | null;
  label: string;
  entry_type: "income" | "expense";
  category: string;
  entry_date: string;
  amount: string | number;
  is_cleared: boolean;
};

export type CreateBookingInput = {
  homestayId: string;
  roomId: string | null;
  customerId: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  amount: number;
  paid: number;
  channel: string;
};

export type UpdateBookingInput = CreateBookingInput & {
  id: string;
  status: BookingStatus;
};

export type CreateHomestayInput = {
  ownerId: string;
  name: string;
  location: string;
  managerName: string;
  units: number;
  nightlyRate: number;
  roomName: string;
};

export type UpdateHomestayInput = {
  id: string;
  name: string;
  location: string;
  managerName: string;
  units: number;
  nightlyRate: number;
  status: HomestayStatus;
};

export type CreateCustomerInput = {
  ownerId: string;
  fullName: string;
  phone: string;
  email: string;
  city: string;
  preferences: string;
};

export type UpdateCustomerInput = Omit<CreateCustomerInput, "ownerId"> & {
  id: string;
};

export type CreateAccountEntryInput = {
  homestayId: string;
  bookingId: string;
  type: "income" | "expense";
  category: string;
  label: string;
  amount: number;
  isCleared: boolean;
};

export async function fetchDashboardData(): Promise<DashboardData> {
  if (!supabase) {
    throw new Error("Supabase environment variables are not configured.");
  }

  const [homestaysResult, customersResult, roomsResult, bookingsResult, accountsResult] = await Promise.all([
    supabase
      .from("homestays")
      .select("id,name,location,manager_name,units,nightly_rate,status")
      .order("name", { ascending: true }),
    supabase
      .from("customers")
      .select("id,full_name,phone,email,city,preferences")
      .order("full_name", { ascending: true }),
    supabase
      .from("rooms")
      .select("id,homestay_id,name,capacity,nightly_rate,is_active")
      .eq("is_active", true)
      .order("name", { ascending: true }),
    supabase
      .from("bookings")
      .select("id,homestay_id,room_id,customer_id,check_in,check_out,guest_count,status,channel,total_amount,amount_paid")
      .order("check_in", { ascending: true }),
    supabase
      .from("account_entries")
      .select("id,homestay_id,booking_id,label,entry_type,category,entry_date,amount,is_cleared")
      .order("entry_date", { ascending: false }),
  ]);

  const firstError =
    homestaysResult.error ??
    customersResult.error ??
    roomsResult.error ??
    bookingsResult.error ??
    accountsResult.error;

  if (firstError) {
    throw new Error(firstError.message);
  }

  const homestays = ((homestaysResult.data ?? []) as HomestayRow[]).map(mapHomestay);
  const rooms = ((roomsResult.data ?? []) as RoomRow[]).map(mapRoom);
  const rawBookings = (bookingsResult.data ?? []) as BookingRow[];
  const bookings = rawBookings.map((row) => mapBooking(row, rooms));
  const customers = ((customersResult.data ?? []) as CustomerRow[]).map((row) => mapCustomer(row, rawBookings));
  const accountEntries = ((accountsResult.data ?? []) as AccountEntryRow[]).map(mapAccountEntry);

  return { homestays, rooms, customers, bookings, accountEntries };
}

export async function createBooking(input: CreateBookingInput): Promise<Booking> {
  if (!supabase) {
    throw new Error("Supabase environment variables are not configured.");
  }

  const { data, error } = await supabase
    .from("bookings")
    .insert({
      homestay_id: input.homestayId,
      room_id: input.roomId,
      customer_id: input.customerId,
      check_in: input.checkIn,
      check_out: input.checkOut,
      guest_count: input.guests,
      status: input.paid > 0 ? "confirmed" : "pending",
      channel: input.channel,
      total_amount: input.amount,
      amount_paid: input.paid,
    })
    .select("id,homestay_id,room_id,customer_id,check_in,check_out,guest_count,status,channel,total_amount,amount_paid")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapBooking(data as BookingRow, []);
}

export async function updateBooking(input: UpdateBookingInput): Promise<Booking> {
  if (!supabase) {
    throw new Error("Supabase environment variables are not configured.");
  }

  const { data, error } = await supabase
    .from("bookings")
    .update({
      homestay_id: input.homestayId,
      room_id: input.roomId,
      customer_id: input.customerId,
      check_in: input.checkIn,
      check_out: input.checkOut,
      guest_count: input.guests,
      status: input.status,
      channel: input.channel,
      total_amount: input.amount,
      amount_paid: input.paid,
    })
    .eq("id", input.id)
    .select("id,homestay_id,room_id,customer_id,check_in,check_out,guest_count,status,channel,total_amount,amount_paid")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapBooking(data as BookingRow, []);
}

export async function createHomestay(input: CreateHomestayInput): Promise<void> {
  if (!supabase) {
    throw new Error("Supabase environment variables are not configured.");
  }

  const { data, error } = await supabase
    .from("homestays")
    .insert({
      owner_id: input.ownerId,
      name: input.name,
      location: input.location,
      manager_name: input.managerName || null,
      units: input.units,
      nightly_rate: input.nightlyRate,
      status: "active",
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const roomName = input.roomName.trim();

  if (roomName) {
    const { error: roomError } = await supabase.from("rooms").insert({
      homestay_id: (data as { id: string }).id,
      name: roomName,
      capacity: 2,
      nightly_rate: input.nightlyRate,
      is_active: true,
    });

    if (roomError) {
      throw new Error(roomError.message);
    }
  }
}

export async function updateHomestay(input: UpdateHomestayInput): Promise<Homestay> {
  if (!supabase) {
    throw new Error("Supabase environment variables are not configured.");
  }

  const { data, error } = await supabase
    .from("homestays")
    .update({
      name: input.name,
      location: input.location,
      manager_name: input.managerName || null,
      units: input.units,
      nightly_rate: input.nightlyRate,
      status: input.status,
    })
    .eq("id", input.id)
    .select("id,name,location,manager_name,units,nightly_rate,status")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapHomestay(data as HomestayRow);
}

export async function createCustomer(input: CreateCustomerInput): Promise<string> {
  if (!supabase) {
    throw new Error("Supabase environment variables are not configured.");
  }

  const { data, error } = await supabase
    .from("customers")
    .insert({
      owner_id: input.ownerId,
      full_name: input.fullName,
      phone: input.phone,
      email: input.email || null,
      city: input.city || null,
      preferences: input.preferences || null,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return (data as { id: string }).id;
}

export async function updateCustomer(input: UpdateCustomerInput): Promise<Customer> {
  if (!supabase) {
    throw new Error("Supabase environment variables are not configured.");
  }

  const { data, error } = await supabase
    .from("customers")
    .update({
      full_name: input.fullName,
      phone: input.phone,
      email: input.email || null,
      city: input.city || null,
      preferences: input.preferences || null,
    })
    .eq("id", input.id)
    .select("id,full_name,phone,email,city,preferences")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapCustomer(data as CustomerRow, []);
}

export async function createAccountEntry(input: CreateAccountEntryInput): Promise<void> {
  if (!supabase) {
    throw new Error("Supabase environment variables are not configured.");
  }

  const { error } = await supabase.from("account_entries").insert({
    homestay_id: input.homestayId,
    booking_id: input.bookingId,
    entry_type: input.type,
    category: input.category,
    label: input.label,
    amount: input.amount,
    is_cleared: input.isCleared,
  });

  if (error) {
    throw new Error(error.message);
  }
}

function mapHomestay(row: HomestayRow): Homestay {
  return {
    id: row.id,
    name: row.name,
    location: row.location,
    units: row.units,
    status: row.status,
    nightlyRate: Number(row.nightly_rate),
    manager: row.manager_name ?? "Unassigned",
  };
}

function mapRoom(row: RoomRow): Room {
  return {
    id: row.id,
    homestayId: row.homestay_id,
    name: row.name,
    capacity: row.capacity,
    nightlyRate: Number(row.nightly_rate),
    isActive: row.is_active,
  };
}

function mapCustomer(row: CustomerRow, bookings: BookingRow[]): Customer {
  const customerBookings = bookings.filter((booking) => booking.customer_id === row.id);
  const sortedBookings = [...customerBookings].sort((a, b) => b.check_out.localeCompare(a.check_out));

  return {
    id: row.id,
    name: row.full_name,
    phone: row.phone,
    email: row.email ?? "",
    city: row.city ?? "",
    stays: customerBookings.length,
    lifetimeValue: customerBookings.reduce((total, booking) => total + Number(booking.total_amount), 0),
    lastStay: sortedBookings[0]?.check_out ?? "",
    preference: row.preferences ?? "",
  };
}

function mapBooking(row: BookingRow, rooms: Room[]): Booking {
  const room = rooms.find((item) => item.id === row.room_id);

  return {
    id: row.id,
    homestayId: row.homestay_id,
    customerId: row.customer_id,
    roomId: row.room_id ?? undefined,
    room: room?.name ?? "Unassigned room",
    checkIn: row.check_in,
    checkOut: row.check_out,
    guests: row.guest_count,
    status: row.status,
    amount: Number(row.total_amount),
    paid: Number(row.amount_paid),
    channel: normalizeChannel(row.channel),
  };
}

function mapAccountEntry(row: AccountEntryRow): AccountEntry {
  return {
    id: row.id,
    homestayId: row.homestay_id,
    bookingId: row.booking_id ?? undefined,
    label: row.label,
    type: row.entry_type,
    category: row.category,
    date: row.entry_date,
    amount: Number(row.amount),
    status: row.is_cleared ? "cleared" : "pending",
  };
}

function normalizeChannel(channel: string): Booking["channel"] {
  if (channel === "Airbnb" || channel === "Booking.com" || channel === "Walk-in") {
    return channel;
  }

  return "Direct";
}
