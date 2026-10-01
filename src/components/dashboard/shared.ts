import type {
  Booking,
  BookingStatus,
  Homestay,
  StaffPaymentMethod,
} from "@/lib/types";

export const statusLabels: Record<BookingStatus, string> = {
  confirmed: "Confirmed",
  pending: "Pending",
  checked_in: "Checked in",
  checked_out: "Checked out",
  cancelled: "Cancelled",
};

export const statusStyles: Record<BookingStatus, string> = {
  confirmed: "border-teal-200 bg-teal-50 text-teal-700",
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  checked_in: "border-blue-200 bg-blue-50 text-blue-700",
  checked_out: "border-slate-200 bg-slate-50 text-slate-600",
  cancelled: "border-red-200 bg-red-50 text-red-700",
};

export const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
});

export type BookingForm = {
  customerId: string;
  homestayId: string;
  roomId: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  amount: number;
  paid: number;
  channel: Booking["channel"];
};

export type BookingEditForm = BookingForm & {
  bookingId: string;
  status: BookingStatus;
  lineItems: BookingLineItemForm[];
};

export type BookingLineItemForm = {
  id?: string;
  type: "income" | "expense";
  category: string;
  label: string;
  amount: number;
  isCleared: boolean;
};

export type HomestayForm = {
  name: string;
  location: string;
  managerName: string;
  units: number;
  nightlyRate: number;
  rooms: HomestayRoomForm[];
};

export type HomestayRoomForm = {
  id?: string;
  name: string;
  capacity: number;
  nightlyRate: number;
};

export type HomestayEditForm = HomestayForm & {
  homestayId: string;
  status: Homestay["status"];
};

export type CustomerForm = {
  fullName: string;
  phone: string;
  email: string;
  city: string;
  preferences: string;
};

export type CustomerEditForm = CustomerForm & {
  customerId: string;
};

export type StaffForm = {
  name: string;
  mobileNumber: string;
  email: string;
  dateOfJoining: string;
  aadharNumber: string;
  panNumber: string;
  emergencyContact: string;
  monthlySalary: number;
  monthlyIncentive: number;
  employeeType: string;
};

export type StaffEditForm = StaffForm & {
  staffId: string;
  isActive: boolean;
};

export type StaffSalaryPaymentForm = {
  staffId: string;
  staffName: string;
  salaryMonth: string;
  daysWorked: number;
  baseAmount: number;
  incentiveAmount: number;
  advanceAmount: number;
  cashAmount: number;
  bankAmount: number;
  paymentMethod: StaffPaymentMethod;
  paidOn: string;
};

export type BookingEntryForm = {
  bookingId: string;
  type: "income" | "expense";
  category: string;
  label: string;
  amount: number;
  isCleared: boolean;
};

export type CommonExpenseForm = {
  homestayId: string;
  category: string;
  label: string;
  amount: number;
  entryDate: string;
  isCleared: boolean;
};

export const bookingEntryCategories = [
  "Decoration",
  "BBQ",
  "Camp fire",
  "Damage recovery",
  "Offer discount",
  "Food",
  "Transport",
  "Other",
];

export const commonExpenseCategories = [
  "Monthly rent",
  "Maid salary",
  "Housekeeping",
  "Electricity",
  "Internet",
  "Laundry",
  "Repairs",
  "Maintenance",
  "Supplies",
  "Staff food",
  "Other",
];

export const employeeTypes = [
  "Manager",
  "Caretaker",
  "Housekeeping",
  "Cook",
  "Security",
  "Maintenance",
  "Driver",
  "Staff",
];

export const staffPaymentMethods: Array<{
  value: StaffPaymentMethod;
  label: string;
}> = [
  { value: "cash", label: "Cash" },
  { value: "bank", label: "Bank" },
  { value: "split", label: "Split" },
];

export const expenseHistoryPageSize = 10;
