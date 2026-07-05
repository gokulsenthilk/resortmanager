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

export type HomestayRoomInput = {
  id?: string;
  name: string;
  capacity: number;
  nightlyRate: number;
};

export type CreateHomestayInput = {
  ownerId: string;
  name: string;
  location: string;
  managerName: string;
  units: number;
  nightlyRate: number;
  rooms: HomestayRoomInput[];
};

export type UpdateHomestayInput = {
  id: string;
  name: string;
  location: string;
  managerName: string;
  units: number;
  nightlyRate: number;
  status: HomestayStatus;
  rooms: HomestayRoomInput[];
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
  bookingId?: string | null;
  type: "income" | "expense";
  category: string;
  label: string;
  amount: number;
  isCleared: boolean;
  entryDate?: string;
};

export type UpdateAccountEntryInput = CreateAccountEntryInput & {
  id: string;
};

export type UpsertBookingAccountEntryInput = {
  id?: string;
  type: "income" | "expense";
  category: string;
  label: string;
  amount: number;
  isCleared: boolean;
};

export type CommonExpenseHistoryInput = {
  homestayId: string;
  dateFrom: string;
  dateTo: string;
  page: number;
  pageSize: number;
};

export type CommonExpenseHistoryResult = {
  entries: AccountEntry[];
  totalCount: number;
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

export async function fetchCommonExpenseHistory({
  homestayId,
  dateFrom,
  dateTo,
  page,
  pageSize,
}: CommonExpenseHistoryInput): Promise<CommonExpenseHistoryResult> {
  if (!supabase) {
    throw new Error("Supabase environment variables are not configured.");
  }

  const safePage = Math.max(1, page);
  const safePageSize = Math.max(1, pageSize);
  const from = (safePage - 1) * safePageSize;
  const to = from + safePageSize - 1;

  let query = supabase
    .from("account_entries")
    .select(
      "id,homestay_id,booking_id,label,entry_type,category,entry_date,amount,is_cleared",
      { count: "exact" },
    )
    .eq("entry_type", "expense")
    .is("booking_id", null)
    .order("entry_date", { ascending: false })
    .order("id", { ascending: false })
    .range(from, to);

  if (homestayId !== "all") {
    query = query.eq("homestay_id", homestayId);
  }

  if (dateFrom) {
    query = query.gte("entry_date", dateFrom);
  }

  if (dateTo) {
    query = query.lte("entry_date", dateTo);
  }

  const { data, error, count } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return {
    entries: ((data ?? []) as AccountEntryRow[]).map(mapAccountEntry),
    totalCount: count ?? 0,
  };
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

  const roomRows = input.rooms
    .map((room) => ({
      homestay_id: (data as { id: string }).id,
      name: room.name.trim(),
      capacity: room.capacity,
      nightly_rate: room.nightlyRate,
      is_active: true,
    }))
    .filter((room) => room.name);

  if (roomRows.length > 0) {
    const { error: roomError } = await supabase.from("rooms").insert(roomRows);

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

  const { data: existingRooms, error: roomsLoadError } = await supabase
    .from("rooms")
    .select("id")
    .eq("homestay_id", input.id);

  if (roomsLoadError) {
    throw new Error(roomsLoadError.message);
  }

  const activeRooms = input.rooms
    .map((room) => ({
      id: room.id,
      name: room.name.trim(),
      capacity: room.capacity,
      nightly_rate: room.nightlyRate,
    }))
    .filter((room) => room.name);
  const activeRoomIds = activeRooms
    .map((room) => room.id)
    .filter((id): id is string => Boolean(id));
  const inactiveRoomIds = ((existingRooms ?? []) as Array<{ id: string }>)
    .map((room) => room.id)
    .filter((roomId) => !activeRoomIds.includes(roomId));

  if (inactiveRoomIds.length > 0) {
    const { error: deactivateError } = await supabase
      .from("rooms")
      .update({ is_active: false })
      .in("id", inactiveRoomIds)
      .eq("homestay_id", input.id);

    if (deactivateError) {
      throw new Error(deactivateError.message);
    }
  }

  const roomUpdates = activeRooms.filter((room) => room.id);
  const roomInserts = activeRooms.filter((room) => !room.id);

  for (const room of roomUpdates) {
    const { error: roomUpdateError } = await supabase
      .from("rooms")
      .update({
        name: room.name,
        capacity: room.capacity,
        nightly_rate: room.nightly_rate,
        is_active: true,
      })
      .eq("id", room.id)
      .eq("homestay_id", input.id);

    if (roomUpdateError) {
      throw new Error(roomUpdateError.message);
    }
  }

  if (roomInserts.length > 0) {
    const { error: roomInsertError } = await supabase.from("rooms").insert(
      roomInserts.map((room) => ({
        homestay_id: input.id,
        name: room.name,
        capacity: room.capacity,
        nightly_rate: room.nightly_rate,
        is_active: true,
      })),
    );

    if (roomInsertError) {
      throw new Error(roomInsertError.message);
    }
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
    booking_id: input.bookingId || null,
    entry_type: input.type,
    category: input.category,
    label: input.label,
    amount: input.amount,
    is_cleared: input.isCleared,
    ...(input.entryDate ? { entry_date: input.entryDate } : {}),
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function updateAccountEntry(input: UpdateAccountEntryInput): Promise<void> {
  if (!supabase) {
    throw new Error("Supabase environment variables are not configured.");
  }

  const { error } = await supabase
    .from("account_entries")
    .update({
      homestay_id: input.homestayId,
      booking_id: input.bookingId || null,
      entry_type: input.type,
      category: input.category,
      label: input.label,
      amount: input.amount,
      is_cleared: input.isCleared,
      ...(input.entryDate ? { entry_date: input.entryDate } : {}),
    })
    .eq("id", input.id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteAccountEntry(id: string): Promise<void> {
  if (!supabase) {
    throw new Error("Supabase environment variables are not configured.");
  }

  const { error } = await supabase.from("account_entries").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function syncBookingAccountEntries(
  bookingId: string,
  homestayId: string,
  entries: UpsertBookingAccountEntryInput[],
): Promise<void> {
  if (!supabase) {
    throw new Error("Supabase environment variables are not configured.");
  }

  const { data: existingRows, error: loadError } = await supabase
    .from("account_entries")
    .select("id")
    .eq("booking_id", bookingId);

  if (loadError) {
    throw new Error(loadError.message);
  }

  const normalizedEntries = entries
    .map((entry) => ({
      id: entry.id,
      entry_type: entry.type,
      category: entry.category,
      label: entry.label.trim(),
      amount: entry.amount,
      is_cleared: entry.isCleared,
    }))
    .filter((entry) => entry.label && entry.amount > 0);
  const submittedExistingIds = normalizedEntries
    .map((entry) => entry.id)
    .filter((id): id is string => Boolean(id));
  const deletedEntryIds = ((existingRows ?? []) as Array<{ id: string }>)
    .map((entry) => entry.id)
    .filter((entryId) => !submittedExistingIds.includes(entryId));

  if (deletedEntryIds.length > 0) {
    const { error: deleteError } = await supabase
      .from("account_entries")
      .delete()
      .in("id", deletedEntryIds)
      .eq("booking_id", bookingId);

    if (deleteError) {
      throw new Error(deleteError.message);
    }
  }

  for (const entry of normalizedEntries.filter((item) => item.id)) {
    const { error: updateError } = await supabase
      .from("account_entries")
      .update({
        homestay_id: homestayId,
        entry_type: entry.entry_type,
        category: entry.category,
        label: entry.label,
        amount: entry.amount,
        is_cleared: entry.is_cleared,
      })
      .eq("id", entry.id)
      .eq("booking_id", bookingId);

    if (updateError) {
      throw new Error(updateError.message);
    }
  }

  const newEntries = normalizedEntries.filter((entry) => !entry.id);

  if (newEntries.length > 0) {
    const { error: insertError } = await supabase.from("account_entries").insert(
      newEntries.map((entry) => ({
        homestay_id: homestayId,
        booking_id: bookingId,
        entry_type: entry.entry_type,
        category: entry.category,
        label: entry.label,
        amount: entry.amount,
        is_cleared: entry.is_cleared,
      })),
    );

    if (insertError) {
      throw new Error(insertError.message);
    }
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
