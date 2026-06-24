import type { LucideIcon } from "lucide-react";

export type ModuleKey = "overview" | "homestays" | "customers" | "bookings" | "accounts";

export type HomestayStatus = "active" | "maintenance" | "paused";

export type Homestay = {
  id: string;
  name: string;
  location: string;
  units: number;
  status: HomestayStatus;
  nightlyRate: number;
  manager: string;
};

export type Room = {
  id: string;
  homestayId: string;
  name: string;
  capacity: number;
  nightlyRate: number;
  isActive: boolean;
};

export type Customer = {
  id: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  stays: number;
  lifetimeValue: number;
  lastStay: string;
  preference: string;
};

export type BookingStatus = "confirmed" | "pending" | "checked_in" | "checked_out" | "cancelled";

export type Booking = {
  id: string;
  homestayId: string;
  customerId: string;
  roomId?: string;
  room: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  status: BookingStatus;
  amount: number;
  paid: number;
  channel: "Direct" | "Airbnb" | "Booking.com" | "Walk-in";
};

export type AccountEntryType = "income" | "expense";

export type AccountEntry = {
  id: string;
  homestayId: string;
  bookingId?: string;
  label: string;
  type: AccountEntryType;
  category: string;
  date: string;
  amount: number;
  status: "cleared" | "pending" | "overdue";
};

export type NavItem = {
  key: ModuleKey;
  label: string;
  href: string;
  icon: LucideIcon;
};

export type DashboardData = {
  homestays: Homestay[];
  rooms: Room[];
  customers: Customer[];
  bookings: Booking[];
  accountEntries: AccountEntry[];
};
