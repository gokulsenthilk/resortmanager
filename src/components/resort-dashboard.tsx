"use client";

import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  BedDouble,
  Bell,
  Building2,
  CalendarDays,
  CalendarCheck,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Filter,
  Home,
  IdCard,
  LogOut,
  MapPin,
  Menu,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  ShieldCheck,
  Trash2,
  UsersRound,
  WalletCards,
  X,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";

import {
  createAccountEntry,
  createBooking,
  createCustomer,
  createHomestay,
  createStaff,
  deleteAccountEntry,
  fetchCommonExpenseHistory,
  fetchDashboardData,
  markStaffSalaryPaid,
  markStaffSalaryUnpaid,
  syncBookingAccountEntries,
  updateAccountEntry,
  updateBooking,
  updateCustomer,
  updateHomestay,
  updateStaff,
} from "@/lib/supabase-data";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type {
  AccountEntry,
  Booking,
  BookingStatus,
  DashboardData,
  Homestay,
  ModuleKey,
  NavItem,
  Room,
  StaffMember,
  StaffPaymentMethod,
  StaffSalaryPayment,
} from "@/lib/types";

const navItems: NavItem[] = [
  { key: "overview", label: "Overview", href: "/", icon: Home },
  { key: "homestays", label: "Homestays", href: "/homestays", icon: Building2 },
  {
    key: "customers",
    label: "Customers",
    href: "/customers",
    icon: UsersRound,
  },
  { key: "staff", label: "Staff", href: "/staff", icon: IdCard },
  {
    key: "bookings",
    label: "Bookings",
    href: "/bookings",
    icon: CalendarCheck,
  },
  {
    key: "calendar",
    label: "Calendar",
    href: "/calendar",
    icon: CalendarDays,
  },
  { key: "expenses", label: "Expenses", href: "/expenses", icon: ReceiptText },
  { key: "accounts", label: "Accounts", href: "/accounts", icon: WalletCards },
];

const statusLabels: Record<BookingStatus, string> = {
  confirmed: "Confirmed",
  pending: "Pending",
  checked_in: "Checked in",
  checked_out: "Checked out",
  cancelled: "Cancelled",
};

const statusStyles: Record<BookingStatus, string> = {
  confirmed: "border-teal-200 bg-teal-50 text-teal-700",
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  checked_in: "border-blue-200 bg-blue-50 text-blue-700",
  checked_out: "border-slate-200 bg-slate-50 text-slate-600",
  cancelled: "border-red-200 bg-red-50 text-red-700",
};

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
});

type BookingForm = {
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

type BookingEditForm = BookingForm & {
  bookingId: string;
  status: BookingStatus;
  lineItems: BookingLineItemForm[];
};

type BookingLineItemForm = {
  id?: string;
  type: "income" | "expense";
  category: string;
  label: string;
  amount: number;
  isCleared: boolean;
};

type HomestayForm = {
  name: string;
  location: string;
  managerName: string;
  units: number;
  nightlyRate: number;
  rooms: HomestayRoomForm[];
};

type HomestayRoomForm = {
  id?: string;
  name: string;
  capacity: number;
  nightlyRate: number;
};

type HomestayEditForm = HomestayForm & {
  homestayId: string;
  status: Homestay["status"];
};

type CustomerForm = {
  fullName: string;
  phone: string;
  email: string;
  city: string;
  preferences: string;
};

type CustomerEditForm = CustomerForm & {
  customerId: string;
};

type StaffForm = {
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

type StaffEditForm = StaffForm & {
  staffId: string;
  isActive: boolean;
};

type StaffSalaryPaymentForm = {
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

type BookingEntryForm = {
  bookingId: string;
  type: "income" | "expense";
  category: string;
  label: string;
  amount: number;
  isCleared: boolean;
};

type CommonExpenseForm = {
  homestayId: string;
  category: string;
  label: string;
  amount: number;
  entryDate: string;
  isCleared: boolean;
};

type UserRole = "Admin" | "Manager";

const roleStorageKey = "stayledger-role";

const bookingEntryCategories = [
  "Decoration",
  "BBQ",
  "Camp fire",
  "Damage recovery",
  "Offer discount",
  "Food",
  "Transport",
  "Other",
];

const commonExpenseCategories = [
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

const employeeTypes = [
  "Manager",
  "Caretaker",
  "Housekeeping",
  "Cook",
  "Security",
  "Maintenance",
  "Driver",
  "Staff",
];

const staffPaymentMethods: Array<{
  value: StaffPaymentMethod;
  label: string;
}> = [
  { value: "cash", label: "Cash" },
  { value: "bank", label: "Bank" },
  { value: "split", label: "Split" },
];

const expenseHistoryPageSize = 10;

const emptyDashboardData: DashboardData = {
  homestays: [],
  rooms: [],
  customers: [],
  staffMembers: [],
  staffSalaryPayments: [],
  bookings: [],
  accountEntries: [],
};

export function ResortDashboard({
  initialModule = "overview",
}: {
  initialModule?: ModuleKey;
}) {
  const [activeModule, setActiveModule] = useState<ModuleKey>(initialModule);
  const [selectedHomestayId, setSelectedHomestayId] = useState("all");
  const [query, setQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [expenseDateFrom, setExpenseDateFrom] = useState(
    startOfMonthIso(new Date()),
  );
  const [expenseDateTo, setExpenseDateTo] = useState(endOfMonthIso(new Date()));
  const [staffSalaryMonth, setStaffSalaryMonth] = useState(todayMonth());
  const [expenseHistoryPage, setExpenseHistoryPage] = useState(1);
  const [expenseHistoryReloadKey, setExpenseHistoryReloadKey] = useState(0);
  const [calendarMonth, setCalendarMonth] = useState(todayMonth());
  const [data, setData] = useState<DashboardData>(emptyDashboardData);
  const [commonExpenseHistory, setCommonExpenseHistory] = useState<
    AccountEntry[]
  >([]);
  const [commonExpenseHistoryTotal, setCommonExpenseHistoryTotal] = useState(0);
  const [isCommonExpenseHistoryLoading, setIsCommonExpenseHistoryLoading] =
    useState(false);
  const [commonExpenseHistoryError, setCommonExpenseHistoryError] =
    useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [sessionEmail, setSessionEmail] = useState("");
  const [activeRole, setActiveRole] = useState<UserRole>("Admin");
  const [userId, setUserId] = useState("");
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [showQuickBookingModal, setShowQuickBookingModal] = useState(false);
  const [showBookingEntryModal, setShowBookingEntryModal] = useState(false);
  const [showEditBookingModal, setShowEditBookingModal] = useState(false);
  const [showEditHomestayModal, setShowEditHomestayModal] = useState(false);
  const [showEditCustomerModal, setShowEditCustomerModal] = useState(false);
  const [showEditStaffModal, setShowEditStaffModal] = useState(false);
  const [showStaffSalaryPaymentModal, setShowStaffSalaryPaymentModal] =
    useState(false);
  const [showHomestayForm, setShowHomestayForm] = useState(false);
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [showQuickCustomerModal, setShowQuickCustomerModal] = useState(false);
  const [homestaySaveError, setHomestaySaveError] = useState("");
  const [customerSaveError, setCustomerSaveError] = useState("");
  const [staffSaveError, setStaffSaveError] = useState("");
  const [staffSalaryError, setStaffSalaryError] = useState("");
  const [bookingEntrySaveError, setBookingEntrySaveError] = useState("");
  const [commonExpenseSaveError, setCommonExpenseSaveError] = useState("");
  const [commonExpenseDeleteError, setCommonExpenseDeleteError] = useState("");
  const [editBookingSaveError, setEditBookingSaveError] = useState("");
  const [editHomestaySaveError, setEditHomestaySaveError] = useState("");
  const [editCustomerSaveError, setEditCustomerSaveError] = useState("");
  const [editStaffSaveError, setEditStaffSaveError] = useState("");
  const [isHomestaySaving, setIsHomestaySaving] = useState(false);
  const [isCustomerSaving, setIsCustomerSaving] = useState(false);
  const [isStaffSaving, setIsStaffSaving] = useState(false);
  const [isBookingEntrySaving, setIsBookingEntrySaving] = useState(false);
  const [isCommonExpenseSaving, setIsCommonExpenseSaving] = useState(false);
  const [deletingCommonExpenseId, setDeletingCommonExpenseId] = useState("");
  const [isBookingUpdating, setIsBookingUpdating] = useState(false);
  const [isHomestayUpdating, setIsHomestayUpdating] = useState(false);
  const [isCustomerUpdating, setIsCustomerUpdating] = useState(false);
  const [isStaffUpdating, setIsStaffUpdating] = useState(false);
  const [updatingStaffSalaryId, setUpdatingStaffSalaryId] = useState("");
  const [homestayForm, setHomestayForm] = useState<HomestayForm>({
    name: "",
    location: "",
    managerName: "",
    units: 1,
    nightlyRate: 0,
    rooms: [createBlankRoomForm()],
  });
  const [homestayEditForm, setHomestayEditForm] =
    useState<HomestayEditForm>({
      homestayId: "",
      name: "",
      location: "",
      managerName: "",
      units: 1,
      nightlyRate: 0,
      rooms: [createBlankRoomForm()],
      status: "active",
    });
  const [customerForm, setCustomerForm] = useState<CustomerForm>({
    fullName: "",
    phone: "",
    email: "",
    city: "",
    preferences: "",
  });
  const [customerEditForm, setCustomerEditForm] = useState<CustomerEditForm>({
    customerId: "",
    fullName: "",
    phone: "",
    email: "",
    city: "",
    preferences: "",
  });
  const [staffForm, setStaffForm] = useState<StaffForm>({
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
  });
  const [staffEditForm, setStaffEditForm] = useState<StaffEditForm>({
    staffId: "",
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
    isActive: true,
  });
  const [staffSalaryPaymentForm, setStaffSalaryPaymentForm] =
    useState<StaffSalaryPaymentForm>({
      staffId: "",
      staffName: "",
      salaryMonth: salaryMonthDate(staffSalaryMonth),
      daysWorked: 0,
      baseAmount: 0,
      incentiveAmount: 0,
      advanceAmount: 0,
      cashAmount: 0,
      bankAmount: 0,
      paymentMethod: "cash",
      paidOn: todayIso(),
    });
  const [bookingForm, setBookingForm] = useState<BookingForm>({
    customerId: "",
    homestayId: "",
    roomId: "",
    checkIn: todayIso(),
    checkOut: addDaysIso(new Date(), 1),
    guests: 1,
    amount: 0,
    paid: 0,
    channel: "Direct",
  });
  const [bookingEditForm, setBookingEditForm] = useState<BookingEditForm>({
    bookingId: "",
    customerId: "",
    homestayId: "",
    roomId: "",
    checkIn: todayIso(),
    checkOut: addDaysIso(new Date(), 1),
    guests: 1,
    amount: 0,
    paid: 0,
    channel: "Direct",
    status: "pending",
    lineItems: [],
  });
  const [bookingEntryForm, setBookingEntryForm] = useState<BookingEntryForm>({
    bookingId: "",
    type: "income",
    category: "Decoration",
    label: "Decoration package",
    amount: 0,
    isCleared: false,
  });
  const [commonExpenseForm, setCommonExpenseForm] =
    useState<CommonExpenseForm>({
      homestayId: "",
      category: "Monthly rent",
      label: "Monthly rent paid",
      amount: 0,
      entryDate: todayIso(),
      isCleared: true,
    });
  const [editingCommonExpenseId, setEditingCommonExpenseId] = useState("");
  const [pendingDeleteCommonExpense, setPendingDeleteCommonExpense] =
    useState<AccountEntry | null>(null);
  const {
    homestays,
    rooms,
    customers,
    staffMembers,
    staffSalaryPayments,
    bookings: bookingList,
    accountEntries,
  } = data;

  useEffect(() => {
    if (!supabase) {
      return;
    }

    supabase.auth.getSession().then(({ data: sessionData }) => {
      setSessionEmail(sessionData.session?.user.email ?? "");
      setUserId(sessionData.session?.user.id ?? "");
      setActiveRole(
        resolveUserRole(
          sessionData.session?.user.user_metadata?.role ?? readStoredRole(),
        ),
      );
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionEmail(session?.user.email ?? "");
      setUserId(session?.user.id ?? "");
      setActiveRole(
        resolveUserRole(session?.user.user_metadata?.role ?? readStoredRole()),
      );
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setIsLoading(true);
      setLoadError("");

      try {
        const dashboardData = await fetchDashboardData();

        if (!isMounted) {
          return;
        }

        setData(dashboardData);
        setBookingForm((current) =>
          ensureBookingFormDefaults(current, dashboardData),
        );
        setBookingEntryForm((current) =>
          ensureBookingEntryFormDefaults(current, dashboardData),
        );
        setCommonExpenseForm((current) =>
          ensureCommonExpenseFormDefaults(current, dashboardData),
        );
      } catch (error) {
        if (isMounted) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "Unable to load Supabase data.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [sessionEmail]);

  useEffect(() => {
    if (!supabase || activeModule !== "expenses") {
      return;
    }

    let isMounted = true;

    async function loadCommonExpenseHistory() {
      setIsCommonExpenseHistoryLoading(true);
      setCommonExpenseHistoryError("");

      try {
        const result = await fetchCommonExpenseHistory({
          homestayId: selectedHomestayId,
          dateFrom: expenseDateFrom,
          dateTo: expenseDateTo,
          page: expenseHistoryPage,
          pageSize: expenseHistoryPageSize,
        });

        if (!isMounted) {
          return;
        }

        setCommonExpenseHistory(result.entries);
        setCommonExpenseHistoryTotal(result.totalCount);

        const maxPage = Math.max(
          1,
          Math.ceil(result.totalCount / expenseHistoryPageSize),
        );

        if (expenseHistoryPage > maxPage) {
          setExpenseHistoryPage(maxPage);
        }
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setCommonExpenseHistoryError(
          error instanceof Error
            ? error.message
            : "Unable to load expense history.",
        );
      } finally {
        if (isMounted) {
          setIsCommonExpenseHistoryLoading(false);
        }
      }
    }

    loadCommonExpenseHistory();

    return () => {
      isMounted = false;
    };
  }, [
    activeModule,
    expenseDateFrom,
    expenseDateTo,
    expenseHistoryPage,
    expenseHistoryReloadKey,
    selectedHomestayId,
  ]);

  function updateSelectedHomestay(value: string) {
    setSelectedHomestayId(value);
    setExpenseHistoryPage(1);
  }

  const visibleBookings = useMemo(() => {
    return bookingList.filter((booking) => {
      const customer = customers.find((item) => item.id === booking.customerId);
      const homestay = homestays.find((item) => item.id === booking.homestayId);
      const matchesHomestay =
        selectedHomestayId === "all" ||
        booking.homestayId === selectedHomestayId;
      const matchesDateRange = doesStayOverlapRange(
        booking.checkIn,
        booking.checkOut,
        dateFrom,
        dateTo,
      );
      const haystack =
        `${booking.id} ${customer?.name ?? ""} ${homestay?.name ?? ""} ${booking.room}`.toLowerCase();

      return (
        matchesHomestay &&
        matchesDateRange &&
        haystack.includes(query.toLowerCase())
      );
    });
  }, [
    bookingList,
    customers,
    dateFrom,
    dateTo,
    homestays,
    query,
    selectedHomestayId,
  ]);

  const visibleAccounts = useMemo(() => {
    return accountEntries.filter(
      (entry) =>
        (selectedHomestayId === "all" ||
          entry.homestayId === selectedHomestayId) &&
        isDateInRange(entry.date, dateFrom, dateTo),
    );
  }, [accountEntries, dateFrom, dateTo, selectedHomestayId]);

  const visibleSalaryPayments = useMemo(() => {
    return staffSalaryPayments.filter((payment) =>
      isDateInRange(payment.paidOn, dateFrom, dateTo),
    );
  }, [dateFrom, dateTo, staffSalaryPayments]);

  const filteredCommonExpenseTotal = useMemo(() => {
    return accountEntries.filter(
      (entry) =>
        entry.type === "expense" &&
        !entry.bookingId &&
        (selectedHomestayId === "all" ||
          entry.homestayId === selectedHomestayId) &&
        isDateInRange(entry.date, expenseDateFrom, expenseDateTo),
    ).reduce((total, entry) => total + entry.amount, 0);
  }, [accountEntries, expenseDateFrom, expenseDateTo, selectedHomestayId]);

  const formRooms = useMemo(() => {
    return rooms.filter((room) => room.homestayId === bookingForm.homestayId);
  }, [bookingForm.homestayId, rooms]);

  const editFormRooms = useMemo(() => {
    return rooms.filter(
      (room) => room.homestayId === bookingEditForm.homestayId,
    );
  }, [bookingEditForm.homestayId, rooms]);

  const metrics = useMemo(() => {
    const bookedRevenue = visibleBookings.reduce(
      (total, booking) => total + booking.amount,
      0,
    );
    const received = visibleBookings.reduce(
      (total, booking) => total + booking.paid,
      0,
    );
    const visibleBookingIds = new Set(
      visibleBookings.map((booking) => booking.id),
    );
    const bookingLinkedEntries = accountEntries.filter(
      (entry) =>
        entry.bookingId &&
        visibleBookingIds.has(entry.bookingId) &&
        (selectedHomestayId === "all" ||
          entry.homestayId === selectedHomestayId),
    );
    const bookingExtraIncome = bookingLinkedEntries
      .filter((entry) => entry.type === "income")
      .reduce((total, entry) => total + entry.amount, 0);
    const bookingExtraExpense = bookingLinkedEntries
      .filter((entry) => entry.type === "expense")
      .reduce((total, entry) => total + entry.amount, 0);
    const propertyExpenses = visibleAccounts
      .filter((entry) => entry.type === "expense" && !entry.bookingId)
      .reduce((total, entry) => total + entry.amount, 0);
    const salaryExpenses = visibleSalaryPayments.reduce(
      (total, payment) => total + payment.amount,
      0,
    );
    const totalRevenue =
      bookedRevenue + bookingExtraIncome - bookingExtraExpense;
    const pending = bookedRevenue - received;
    const occupied = visibleBookings.filter((booking) =>
      ["confirmed", "checked_in"].includes(booking.status),
    ).length;
    const totalUnits =
      selectedHomestayId === "all"
        ? homestays.reduce((total, homestay) => total + homestay.units, 0)
        : (homestays.find((item) => item.id === selectedHomestayId)?.units ??
          0);

    return {
      bookedRevenue,
      totalRevenue,
      bookingExtraIncome,
      bookingExtraExpense,
      expenses: propertyExpenses + salaryExpenses,
      salaryExpenses,
      received,
      pending,
      occupancy: totalUnits > 0 ? Math.round((occupied / totalUnits) * 100) : 0,
    };
  }, [
    accountEntries,
    homestays,
    selectedHomestayId,
    visibleAccounts,
    visibleBookings,
    visibleSalaryPayments,
  ]);
  const showDashboardSummary =
    activeModule === "overview" || activeModule === "accounts";

  async function addBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!bookingForm.customerId || !bookingForm.homestayId) {
      setSaveError(
        "Add at least one homestay and one customer in Supabase before creating a booking.",
      );
      return;
    }

    setIsSaving(true);
    setSaveError("");

    try {
      await createBooking({
        homestayId: bookingForm.homestayId,
        roomId: bookingForm.roomId || null,
        customerId: bookingForm.customerId,
        checkIn: bookingForm.checkIn,
        checkOut: bookingForm.checkOut,
        guests: bookingForm.guests,
        amount: bookingForm.amount,
        paid: bookingForm.paid,
        channel: bookingForm.channel,
      });

      const refreshedData = await fetchDashboardData();

      setData(refreshedData);
      setBookingForm((current) =>
        ensureBookingFormDefaults(current, refreshedData),
      );
      setBookingEntryForm((current) =>
        ensureBookingEntryFormDefaults(current, refreshedData),
      );
      setShowQuickBookingModal(false);
      setActiveModule("bookings");
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Unable to create booking.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function saveBookingEdits(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      !bookingEditForm.bookingId ||
      !bookingEditForm.customerId ||
      !bookingEditForm.homestayId
    ) {
      setEditBookingSaveError("Select a booking, customer, and homestay.");
      return;
    }

    setIsBookingUpdating(true);
    setEditBookingSaveError("");

    try {
      await updateBooking({
        id: bookingEditForm.bookingId,
        homestayId: bookingEditForm.homestayId,
        roomId: bookingEditForm.roomId || null,
        customerId: bookingEditForm.customerId,
        checkIn: bookingEditForm.checkIn,
        checkOut: bookingEditForm.checkOut,
        guests: bookingEditForm.guests,
        amount: bookingEditForm.amount,
        paid: bookingEditForm.paid,
        channel: bookingEditForm.channel,
        status: bookingEditForm.status,
      });
      await syncBookingAccountEntries(
        bookingEditForm.bookingId,
        bookingEditForm.homestayId,
        bookingEditForm.lineItems,
      );

      const refreshedData = await fetchDashboardData();

      setData(refreshedData);
      setBookingForm((current) =>
        ensureBookingFormDefaults(current, refreshedData),
      );
      setBookingEntryForm((current) =>
        ensureBookingEntryFormDefaults(current, refreshedData),
      );
      setShowEditBookingModal(false);
      setActiveModule("bookings");
    } catch (error) {
      setEditBookingSaveError(
        error instanceof Error ? error.message : "Unable to update booking.",
      );
    } finally {
      setIsBookingUpdating(false);
    }
  }

  async function addHomestay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!userId) {
      setHomestaySaveError("Sign in before adding a homestay.");
      return;
    }

    const roomsToSave = normalizeHomestayRoomForms(
      homestayForm.rooms,
      homestayForm.nightlyRate,
    );

    if (roomsToSave.length === 0) {
      setHomestaySaveError("Add at least one room for this homestay.");
      return;
    }

    setIsHomestaySaving(true);
    setHomestaySaveError("");

    try {
      await createHomestay({
        ownerId: userId,
        name: homestayForm.name,
        location: homestayForm.location,
        managerName: homestayForm.managerName,
        units: roomsToSave.length,
        nightlyRate: homestayForm.nightlyRate,
        rooms: roomsToSave,
      });

      const refreshedData = await fetchDashboardData();

      setData(refreshedData);
      setBookingForm((current) =>
        ensureBookingFormDefaults(current, refreshedData),
      );
      setBookingEntryForm((current) =>
        ensureBookingEntryFormDefaults(current, refreshedData),
      );
      setHomestayForm({
        name: "",
        location: "",
        managerName: "",
        units: 1,
        nightlyRate: 0,
        rooms: [createBlankRoomForm()],
      });
      setShowHomestayForm(false);
      setActiveModule("homestays");
    } catch (error) {
      setHomestaySaveError(
        error instanceof Error ? error.message : "Unable to add homestay.",
      );
    } finally {
      setIsHomestaySaving(false);
    }
  }

  async function saveHomestayEdits(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!userId) {
      setEditHomestaySaveError("Sign in before editing a homestay.");
      return;
    }

    if (!homestayEditForm.homestayId) {
      setEditHomestaySaveError("Select a homestay to edit.");
      return;
    }

    const roomsToSave = normalizeHomestayRoomForms(
      homestayEditForm.rooms,
      homestayEditForm.nightlyRate,
    );

    if (roomsToSave.length === 0) {
      setEditHomestaySaveError("Keep at least one active room.");
      return;
    }

    setIsHomestayUpdating(true);
    setEditHomestaySaveError("");

    try {
      await updateHomestay({
        id: homestayEditForm.homestayId,
        name: homestayEditForm.name,
        location: homestayEditForm.location,
        managerName: homestayEditForm.managerName,
        units: roomsToSave.length,
        nightlyRate: homestayEditForm.nightlyRate,
        status: homestayEditForm.status,
        rooms: roomsToSave,
      });

      const refreshedData = await fetchDashboardData();

      setData(refreshedData);
      setBookingForm((current) =>
        ensureBookingFormDefaults(current, refreshedData),
      );
      setBookingEntryForm((current) =>
        ensureBookingEntryFormDefaults(current, refreshedData),
      );
      setShowEditHomestayModal(false);
      setActiveModule("homestays");
    } catch (error) {
      setEditHomestaySaveError(
        error instanceof Error ? error.message : "Unable to update homestay.",
      );
    } finally {
      setIsHomestayUpdating(false);
    }
  }

  async function addCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!userId) {
      setCustomerSaveError("Sign in before adding a customer.");
      return;
    }

    setIsCustomerSaving(true);
    setCustomerSaveError("");

    try {
      await createCustomer({
        ownerId: userId,
        fullName: customerForm.fullName,
        phone: customerForm.phone,
        email: customerForm.email,
        city: customerForm.city,
        preferences: customerForm.preferences,
      });

      const refreshedData = await fetchDashboardData();

      setData(refreshedData);
      setBookingForm((current) =>
        ensureBookingFormDefaults(current, refreshedData),
      );
      setBookingEntryForm((current) =>
        ensureBookingEntryFormDefaults(current, refreshedData),
      );
      setCustomerForm({
        fullName: "",
        phone: "",
        email: "",
        city: "",
        preferences: "",
      });
      setShowCustomerForm(false);
      setActiveModule("customers");
    } catch (error) {
      setCustomerSaveError(
        error instanceof Error ? error.message : "Unable to add customer.",
      );
    } finally {
      setIsCustomerSaving(false);
    }
  }

  async function saveCustomerEdits(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!userId) {
      setEditCustomerSaveError("Sign in before editing a customer.");
      return;
    }

    if (!customerEditForm.customerId) {
      setEditCustomerSaveError("Select a customer to edit.");
      return;
    }

    setIsCustomerUpdating(true);
    setEditCustomerSaveError("");

    try {
      await updateCustomer({
        id: customerEditForm.customerId,
        fullName: customerEditForm.fullName,
        phone: customerEditForm.phone,
        email: customerEditForm.email,
        city: customerEditForm.city,
        preferences: customerEditForm.preferences,
      });

      const refreshedData = await fetchDashboardData();

      setData(refreshedData);
      setBookingForm((current) =>
        ensureBookingFormDefaults(current, refreshedData),
      );
      setBookingEntryForm((current) =>
        ensureBookingEntryFormDefaults(current, refreshedData),
      );
      setShowEditCustomerModal(false);
      setActiveModule("customers");
    } catch (error) {
      setEditCustomerSaveError(
        error instanceof Error ? error.message : "Unable to update customer.",
      );
    } finally {
      setIsCustomerUpdating(false);
    }
  }

  async function addStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!userId) {
      setStaffSaveError("Sign in before adding staff.");
      return;
    }

    if (!staffForm.name.trim() || !staffForm.mobileNumber.trim()) {
      setStaffSaveError("Name and mobile number are required.");
      return;
    }

    setIsStaffSaving(true);
    setStaffSaveError("");

    try {
      await createStaff({
        ownerId: userId,
        name: staffForm.name,
        mobileNumber: staffForm.mobileNumber,
        email: staffForm.email,
        dateOfJoining: staffForm.dateOfJoining,
        aadharNumber: staffForm.aadharNumber,
        panNumber: staffForm.panNumber,
        emergencyContact: staffForm.emergencyContact,
        monthlySalary: staffForm.monthlySalary,
        monthlyIncentive: staffForm.monthlyIncentive,
        employeeType: staffForm.employeeType,
      });

      const refreshedData = await fetchDashboardData();

      setData(refreshedData);
      setStaffForm(createBlankStaffForm());
      setActiveModule("staff");
    } catch (error) {
      setStaffSaveError(
        error instanceof Error ? error.message : "Unable to add staff.",
      );
    } finally {
      setIsStaffSaving(false);
    }
  }

  async function saveStaffEdits(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!userId) {
      setEditStaffSaveError("Sign in before editing staff.");
      return;
    }

    if (!staffEditForm.staffId) {
      setEditStaffSaveError("Select a staff member to edit.");
      return;
    }

    if (!staffEditForm.name.trim() || !staffEditForm.mobileNumber.trim()) {
      setEditStaffSaveError("Name and mobile number are required.");
      return;
    }

    setIsStaffUpdating(true);
    setEditStaffSaveError("");

    try {
      await updateStaff({
        id: staffEditForm.staffId,
        name: staffEditForm.name,
        mobileNumber: staffEditForm.mobileNumber,
        email: staffEditForm.email,
        dateOfJoining: staffEditForm.dateOfJoining,
        aadharNumber: staffEditForm.aadharNumber,
        panNumber: staffEditForm.panNumber,
        emergencyContact: staffEditForm.emergencyContact,
        monthlySalary: staffEditForm.monthlySalary,
        monthlyIncentive: staffEditForm.monthlyIncentive,
        employeeType: staffEditForm.employeeType,
        isActive: staffEditForm.isActive,
      });

      const refreshedData = await fetchDashboardData();

      setData(refreshedData);
      setShowEditStaffModal(false);
      setActiveModule("staff");
    } catch (error) {
      setEditStaffSaveError(
        error instanceof Error ? error.message : "Unable to update staff.",
      );
    } finally {
      setIsStaffUpdating(false);
    }
  }

  async function saveStaffSalaryPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!staffSalaryPaymentForm.staffId) {
      setStaffSalaryError("Select a staff member before marking salary paid.");
      return;
    }

    if (!staffSalaryPaymentForm.paidOn) {
      setStaffSalaryError("Paid date is required.");
      return;
    }

    const grossPay =
      staffSalaryPaymentForm.baseAmount +
      staffSalaryPaymentForm.incentiveAmount;
    const paidTotal =
      staffSalaryPaymentForm.advanceAmount +
      staffSalaryPaymentForm.cashAmount +
      staffSalaryPaymentForm.bankAmount;

    if (Math.abs(grossPay - paidTotal) > 0.01) {
      setStaffSalaryError(
        `Payment breakdown must equal ${inr.format(grossPay)} salary and incentives.`,
      );
      return;
    }

    if (
      staffSalaryPaymentForm.paymentMethod === "cash" &&
      staffSalaryPaymentForm.bankAmount > 0
    ) {
      setStaffSalaryError("Bank amount must be zero for a cash payment.");
      return;
    }

    if (
      staffSalaryPaymentForm.paymentMethod === "bank" &&
      staffSalaryPaymentForm.cashAmount > 0
    ) {
      setStaffSalaryError("Cash amount must be zero for a bank payment.");
      return;
    }

    if (
      staffSalaryPaymentForm.paymentMethod === "split" &&
      (staffSalaryPaymentForm.cashAmount <= 0 ||
        staffSalaryPaymentForm.bankAmount <= 0)
    ) {
      setStaffSalaryError("A split payment requires both cash and bank amounts.");
      return;
    }

    setUpdatingStaffSalaryId(staffSalaryPaymentForm.staffId);
    setStaffSalaryError("");

    try {
      await markStaffSalaryPaid({
        staffId: staffSalaryPaymentForm.staffId,
        salaryMonth: staffSalaryPaymentForm.salaryMonth,
        baseAmount: Math.max(0, Number(staffSalaryPaymentForm.baseAmount)),
        incentiveAmount: Math.max(
          0,
          Number(staffSalaryPaymentForm.incentiveAmount),
        ),
        advanceAmount: Math.max(
          0,
          Number(staffSalaryPaymentForm.advanceAmount),
        ),
        cashAmount: Math.max(0, Number(staffSalaryPaymentForm.cashAmount)),
        bankAmount: Math.max(0, Number(staffSalaryPaymentForm.bankAmount)),
        paymentMethod: staffSalaryPaymentForm.paymentMethod,
        daysWorked: Math.max(0, Number(staffSalaryPaymentForm.daysWorked)),
        paidOn: staffSalaryPaymentForm.paidOn,
      });

      const refreshedData = await fetchDashboardData();

      setData(refreshedData);
      setShowStaffSalaryPaymentModal(false);
    } catch (error) {
      setStaffSalaryError(
        error instanceof Error ? error.message : "Unable to mark salary paid.",
      );
    } finally {
      setUpdatingStaffSalaryId("");
    }
  }

  async function markStaffUnpaid(payment: StaffSalaryPayment) {
    setUpdatingStaffSalaryId(payment.staffId);
    setStaffSalaryError("");

    try {
      await markStaffSalaryUnpaid(payment.id);

      setData((current) => ({
        ...current,
        staffSalaryPayments: current.staffSalaryPayments.filter(
          (item) => item.id !== payment.id,
        ),
      }));
    } catch (error) {
      setStaffSalaryError(
        error instanceof Error ? error.message : "Unable to mark salary unpaid.",
      );
    } finally {
      setUpdatingStaffSalaryId("");
    }
  }

  async function addQuickCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!userId) {
      setCustomerSaveError("Sign in before adding a customer.");
      return;
    }

    setIsCustomerSaving(true);
    setCustomerSaveError("");

    try {
      const newCustomerId = await createCustomer({
        ownerId: userId,
        fullName: customerForm.fullName,
        phone: customerForm.phone,
        email: customerForm.email,
        city: customerForm.city,
        preferences: customerForm.preferences,
      });

      const refreshedData = await fetchDashboardData();

      setData(refreshedData);
      setBookingForm((current) =>
        ensureBookingFormDefaults(
          { ...current, customerId: newCustomerId },
          refreshedData,
        ),
      );
      setBookingEntryForm((current) =>
        ensureBookingEntryFormDefaults(current, refreshedData),
      );
      setCustomerForm({
        fullName: "",
        phone: "",
        email: "",
        city: "",
        preferences: "",
      });
      setShowQuickCustomerModal(false);
      setActiveModule("bookings");
    } catch (error) {
      setCustomerSaveError(
        error instanceof Error ? error.message : "Unable to add customer.",
      );
    } finally {
      setIsCustomerSaving(false);
    }
  }

  async function addBookingEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const booking = bookingList.find(
      (item) => item.id === bookingEntryForm.bookingId,
    );

    if (!booking) {
      setBookingEntrySaveError(
        "Select a booking before adding income or expense.",
      );
      return;
    }

    setIsBookingEntrySaving(true);
    setBookingEntrySaveError("");

    try {
      await createAccountEntry({
        homestayId: booking.homestayId,
        bookingId: booking.id,
        type: bookingEntryForm.type,
        category: bookingEntryForm.category,
        label: bookingEntryForm.label,
        amount: bookingEntryForm.amount,
        isCleared: bookingEntryForm.isCleared,
      });

      const refreshedData = await fetchDashboardData();

      setData(refreshedData);
      setBookingEntryForm((current) =>
        ensureBookingEntryFormDefaults(
          {
            ...current,
            label: defaultBookingEntryLabel(current.category),
            amount: 0,
            isCleared: false,
          },
          refreshedData,
        ),
      );
      setShowBookingEntryModal(false);
      setActiveModule("bookings");
    } catch (error) {
      setBookingEntrySaveError(
        error instanceof Error
          ? error.message
          : "Unable to add booking income or expense.",
      );
    } finally {
      setIsBookingEntrySaving(false);
    }
  }

  async function addCommonExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!userId) {
      setCommonExpenseSaveError("Sign in before adding expenses.");
      return;
    }

    if (!commonExpenseForm.homestayId) {
      setCommonExpenseSaveError("Select a homestay for this expense.");
      return;
    }

    if (commonExpenseForm.amount <= 0) {
      setCommonExpenseSaveError("Enter an expense amount greater than zero.");
      return;
    }

    setIsCommonExpenseSaving(true);
    setCommonExpenseSaveError("");

    try {
      const payload = {
        homestayId: commonExpenseForm.homestayId,
        bookingId: null,
        type: "expense" as const,
        category: commonExpenseForm.category,
        label: commonExpenseForm.label,
        amount: commonExpenseForm.amount,
        entryDate: commonExpenseForm.entryDate,
        isCleared: commonExpenseForm.isCleared,
      };

      if (editingCommonExpenseId) {
        await updateAccountEntry({
          id: editingCommonExpenseId,
          ...payload,
        });
      } else {
        await createAccountEntry(payload);
      }

      const refreshedData = await fetchDashboardData();

      setData(refreshedData);
      setEditingCommonExpenseId("");
      setExpenseHistoryPage(1);
      setExpenseHistoryReloadKey((current) => current + 1);
      setCommonExpenseForm((current) =>
        ensureCommonExpenseFormDefaults(
          {
            ...current,
            label: defaultCommonExpenseLabel(current.category),
            amount: 0,
            entryDate: todayIso(),
            isCleared: true,
          },
          refreshedData,
        ),
      );
      setActiveModule("expenses");
    } catch (error) {
      setCommonExpenseSaveError(
        error instanceof Error ? error.message : "Unable to add expense.",
      );
    } finally {
      setIsCommonExpenseSaving(false);
    }
  }

  function requestDeleteCommonExpense(expense: AccountEntry) {
    setPendingDeleteCommonExpense(expense);
    setCommonExpenseDeleteError("");
  }

  async function confirmDeleteCommonExpense() {
    const expense = pendingDeleteCommonExpense;

    if (!expense) {
      return;
    }

    setDeletingCommonExpenseId(expense.id);
    setCommonExpenseDeleteError("");

    try {
      await deleteAccountEntry(expense.id);

      const refreshedData = await fetchDashboardData();

      setData(refreshedData);
      setExpenseHistoryReloadKey((current) => current + 1);

      if (editingCommonExpenseId === expense.id) {
        cancelCommonExpenseEdit(refreshedData);
      }

      setPendingDeleteCommonExpense(null);
    } catch (error) {
      setCommonExpenseDeleteError(
        error instanceof Error ? error.message : "Unable to delete expense.",
      );
    } finally {
      setDeletingCommonExpenseId("");
    }
  }

  function editCommonExpense(expense: AccountEntry) {
    setEditingCommonExpenseId(expense.id);
    setCommonExpenseSaveError("");
    setCommonExpenseDeleteError("");
    setCommonExpenseForm({
      homestayId: expense.homestayId,
      category: expense.category,
      label: expense.label,
      amount: expense.amount,
      entryDate: expense.date,
      isCleared: expense.status === "cleared",
    });
  }

  function cancelCommonExpenseEdit(nextData = data) {
    setEditingCommonExpenseId("");
    setCommonExpenseSaveError("");
    setCommonExpenseForm((current) =>
      ensureCommonExpenseFormDefaults(
        {
          ...current,
          label: defaultCommonExpenseLabel(current.category),
          amount: 0,
          entryDate: todayIso(),
          isCleared: true,
        },
        nextData,
      ),
    );
  }

  async function signOut() {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
    forgetStoredRole();
    setData(emptyDashboardData);
  }

  function openHomestayForm() {
    setShowHomestayForm((current) => !current);
    setShowCustomerForm(false);
    setActiveModule("homestays");
    setIsMobileNavOpen(false);
  }

  function openCustomerForm() {
    setShowCustomerForm((current) => !current);
    setShowHomestayForm(false);
    setActiveModule("customers");
    setIsMobileNavOpen(false);
  }

  function openQuickBookingModal() {
    setSaveError("");
    setShowBookingEntryModal(false);
    setShowQuickBookingModal(true);
  }

  function openBookingEntryModal() {
    setBookingEntrySaveError("");
    setShowQuickBookingModal(false);
    setShowBookingEntryModal(true);
  }

  function openEditBookingModal(booking: Booking) {
    const bookingEntries = getBookingEntries(accountEntries, booking.id);

    setBookingEditForm({
      bookingId: booking.id,
      customerId: booking.customerId,
      homestayId: booking.homestayId,
      roomId: booking.roomId ?? "",
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      guests: booking.guests,
      amount: booking.amount,
      paid: booking.paid,
      channel: booking.channel,
      status: booking.status,
      lineItems: bookingEntries.map((entry) => ({
        id: entry.id,
        type: entry.type,
        category: entry.category,
        label: entry.label,
        amount: entry.amount,
        isCleared: entry.status === "cleared",
      })),
    });
    setEditBookingSaveError("");
    setShowQuickBookingModal(false);
    setShowBookingEntryModal(false);
    setShowEditBookingModal(true);
  }

  function openEditHomestayModal(homestay: Homestay) {
    const homestayRooms = rooms
      .filter((room) => room.homestayId === homestay.id)
      .map((room) => ({
        id: room.id,
        name: room.name,
        capacity: room.capacity,
        nightlyRate: room.nightlyRate,
      }));

    setHomestayEditForm({
      homestayId: homestay.id,
      name: homestay.name,
      location: homestay.location,
      managerName: homestay.manager === "Unassigned" ? "" : homestay.manager,
      units: homestayRooms.length || homestay.units,
      nightlyRate: homestay.nightlyRate,
      rooms:
        homestayRooms.length > 0
          ? homestayRooms
          : [createBlankRoomForm(homestay.nightlyRate)],
      status: homestay.status,
    });
    setEditHomestaySaveError("");
    setShowEditHomestayModal(true);
  }

  function openEditCustomerModal(customer: DashboardData["customers"][number]) {
    setCustomerEditForm({
      customerId: customer.id,
      fullName: customer.name,
      phone: customer.phone,
      email: customer.email,
      city: customer.city,
      preferences: customer.preference,
    });
    setEditCustomerSaveError("");
    setShowEditCustomerModal(true);
  }

  function openEditStaffModal(staff: StaffMember) {
    setStaffEditForm({
      staffId: staff.id,
      name: staff.name,
      mobileNumber: staff.mobileNumber,
      email: staff.email,
      dateOfJoining: staff.dateOfJoining,
      aadharNumber: staff.aadharNumber,
      panNumber: staff.panNumber,
      emergencyContact: staff.emergencyContact,
      monthlySalary: staff.monthlySalary,
      monthlyIncentive: staff.monthlyIncentive,
      employeeType: staff.employeeType,
      isActive: staff.isActive,
    });
    setEditStaffSaveError("");
    setShowEditStaffModal(true);
  }

  function openStaffSalaryPaymentModal(staff: StaffMember) {
    const salaryMonth = salaryMonthDate(staffSalaryMonth);
    const existingPayment = staffSalaryPayments.find(
      (payment) =>
        payment.staffId === staff.id && payment.salaryMonth === salaryMonth,
    );

    setStaffSalaryPaymentForm({
      staffId: staff.id,
      staffName: staff.name,
      salaryMonth,
      daysWorked: existingPayment?.daysWorked ?? 0,
      baseAmount: existingPayment?.baseAmount ?? staff.monthlySalary,
      incentiveAmount:
        existingPayment?.incentiveAmount ?? staff.monthlyIncentive,
      advanceAmount: existingPayment?.advanceAmount ?? 0,
      cashAmount:
        existingPayment?.cashAmount ??
        staff.monthlySalary + staff.monthlyIncentive,
      bankAmount: existingPayment?.bankAmount ?? 0,
      paymentMethod: existingPayment?.paymentMethod ?? "cash",
      paidOn: existingPayment?.paidOn ?? todayIso(),
    });
    setStaffSalaryError("");
    setShowStaffSalaryPaymentModal(true);
  }

  return (
    <div className="min-h-screen bg-white text-slate-950">
      <div className="flex min-h-screen">
        {isMobileNavOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              aria-label="Close navigation"
              className="absolute inset-0 bg-slate-950/50"
              onClick={() => setIsMobileNavOpen(false)}
            />
            <aside className="relative flex h-full w-80 max-w-[86vw] flex-col overflow-y-auto overscroll-contain bg-slate-950 px-4 py-5 text-white shadow-2xl">
              <div className="mb-6 flex items-center justify-between gap-3 px-2">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-teal-400 text-slate-950">
                    <BedDouble className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold leading-5">
                      StayLedger
                    </p>
                    <p className="truncate text-xs text-slate-400">
                      Homestay operations
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Close navigation"
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-white/10 text-slate-300 transition hover:bg-white/10 hover:text-white"
                  onClick={() => setIsMobileNavOpen(false)}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <nav className="space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeModule === item.key;

                  return (
                    <Link
                      key={item.key}
                      href={item.href}
                      onClick={() => {
                        setActiveModule(item.key);
                        setIsMobileNavOpen(false);
                      }}
                      className={`flex h-11 w-full items-center gap-3 rounded-md px-3 text-sm font-medium transition ${
                        isActive
                          ? "bg-white text-slate-950"
                          : "text-slate-300 hover:bg-slate-900 hover:text-white"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>

              <div className="mt-5 space-y-2 border-t border-white/10 pt-5">
                <Link
                  href="/bookings"
                  onClick={() => setIsMobileNavOpen(false)}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 whitespace-nowrap rounded-md bg-teal-500 px-4 text-sm font-semibold text-slate-950 transition hover:bg-teal-400"
                >
                  <Plus className="h-4 w-4" />
                  New booking
                </Link>
                <button
                  type="button"
                  onClick={openHomestayForm}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 whitespace-nowrap rounded-md border border-white/10 px-4 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  <Building2 className="h-4 w-4" />
                  Add Homestay
                </button>
                <button
                  type="button"
                  onClick={openCustomerForm}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 whitespace-nowrap rounded-md border border-white/10 px-4 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  <UsersRound className="h-4 w-4" />
                  Add Customer
                </button>
              </div>

              <SidebarAuthCard
                isConfigured={isSupabaseConfigured}
                email={sessionEmail}
                role={activeRole}
                onSignOut={signOut}
              />
            </aside>
          </div>
        )}

        <aside className="fixed inset-y-0 left-0 z-30 hidden h-dvh w-72 overflow-y-auto overscroll-contain border-r border-slate-200 bg-slate-950 px-4 py-5 text-white lg:block">
          <div className="mb-8 flex items-center gap-3 px-2">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-teal-400 text-slate-950">
              <BedDouble className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-5">StayLedger</p>
              <p className="text-xs text-slate-400">Homestay operations</p>
            </div>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeModule === item.key;

              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={`flex h-11 w-full items-center gap-3 rounded-md px-3 text-sm font-medium transition ${
                    isActive
                      ? "bg-white text-slate-950"
                      : "text-slate-300 hover:bg-slate-900 hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <SidebarAuthCard
            isConfigured={isSupabaseConfigured}
            email={sessionEmail}
            role={activeRole}
            onSignOut={signOut}
          />
        </aside>

        <main className="flex min-w-0 flex-1 flex-col bg-slate-50 lg:ml-72">
          <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur md:px-6">
            <div className="mb-4 flex items-center justify-between gap-3 lg:hidden">
              <button
                type="button"
                aria-label="Open navigation"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-slate-200 bg-white text-slate-800 transition hover:border-slate-300"
                onClick={() => setIsMobileNavOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
                  Homely Accounts Manager
                </p>
                <h1 className="truncate text-lg font-semibold tracking-normal text-slate-950">
                  Reservations and cash flow
                </h1>
              </div>
              <button
                type="button"
                aria-label="Notifications"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300"
              >
                <Bell className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="hidden lg:block">
                <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
                  Homely Accounts Manager
                </p>
                <h1 className="mt-1 text-2xl font-semibold tracking-normal text-slate-950 md:text-3xl">
                  Reservations, guests, and cash flow
                </h1>
              </div>

              <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-end">
                <label className="relative min-w-0 lg:w-64">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                    placeholder="Search bookings or guests"
                  />
                </label>

                <label className="relative">
                  <select
                    value={selectedHomestayId}
                    onChange={(event) =>
                      updateSelectedHomestay(event.target.value)
                    }
                    className="h-10 w-full appearance-none rounded-md border border-slate-200 bg-white pl-3 pr-9 text-sm font-medium text-slate-800 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100 lg:w-56"
                  >
                    <option value="all">All homestays</option>
                    {homestays.map((homestay) => (
                      <option key={homestay.id} value={homestay.id}>
                        {homestay.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                </label>

                <div className="grid grid-cols-2 gap-2 lg:hidden">
                  <button
                    type="button"
                    onClick={openQuickBookingModal}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-teal-700 px-3 text-sm font-semibold text-white transition hover:bg-teal-800"
                  >
                    <CalendarCheck className="h-4 w-4" />
                    Quick booking
                  </button>
                  <button
                    type="button"
                    onClick={openBookingEntryModal}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 transition hover:border-slate-300"
                  >
                    <ReceiptText className="h-4 w-4" />
                    Income/expense
                  </button>
                </div>

                <div className="hidden items-center gap-3 lg:flex lg:flex-wrap lg:justify-end">
                  <Link
                    href="/bookings"
                    className="inline-flex h-10 min-w-36 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800"
                  >
                    <Plus className="h-4 w-4" />
                    New booking
                  </Link>

                  <button
                    type="button"
                    onClick={openHomestayForm}
                    className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:border-slate-300"
                  >
                    <Plus className="h-4 w-4" />
                    Add Homestay
                  </button>

                  <button
                    type="button"
                    onClick={openCustomerForm}
                    className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:border-slate-300"
                  >
                    <Plus className="h-4 w-4" />
                    Add Customer
                  </button>

                  <button
                    type="button"
                    aria-label="Notifications"
                    className="grid h-10 w-10 place-items-center rounded-md border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300"
                  >
                    <Bell className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </header>

          <div className="min-w-0 space-y-5 p-4 md:p-6">
            {isLoading && (
              <StatusPanel
                title="Loading Supabase data"
                message="Fetching homestays, customers, bookings, rooms, and accounts."
              />
            )}

            {loadError && (
              <StatusPanel
                title="Supabase load failed"
                message={loadError}
                tone="error"
              />
            )}

            {!isLoading && !loadError && homestays.length === 0 && (
              <StatusPanel
                title="No homestays found"
                message="The app is connected to Supabase, but no visible homestay rows were returned. If RLS is enabled, make sure you are signed in as the owner used in the rows."
              />
            )}

            {showHomestayForm && (
              <HomestayCreateForm
                form={homestayForm}
                isSaving={isHomestaySaving}
                error={homestaySaveError}
                disabled={!userId}
                onChange={setHomestayForm}
                onSubmit={addHomestay}
                onCancel={() => setShowHomestayForm(false)}
              />
            )}

            {showCustomerForm && (
              <CustomerCreateForm
                form={customerForm}
                isSaving={isCustomerSaving}
                error={customerSaveError}
                disabled={!userId}
                onChange={setCustomerForm}
                onSubmit={addCustomer}
                onCancel={() => setShowCustomerForm(false)}
              />
            )}

            {showDashboardSummary && (
              <>
                <DateFilterBar
                  dateFrom={dateFrom}
                  dateTo={dateTo}
                  onDateFromChange={setDateFrom}
                  onDateToChange={setDateTo}
                  onClear={() => {
                    setDateFrom("");
                    setDateTo("");
                  }}
                />

                <MetricGrid
                  metrics={metrics}
                  bookings={visibleBookings}
                />
              </>
            )}

            {activeModule === "overview" && (
              <OverviewFocus
                bookings={visibleBookings}
                accounts={visibleAccounts}
                customers={customers}
                homestays={homestays}
              />
            )}

            {activeModule === "bookings" && (
              <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
                <BookingTable
                  bookings={visibleBookings}
                  customers={customers}
                  homestays={homestays}
                  accountEntries={accountEntries}
                  onEditBooking={openEditBookingModal}
                />
                <div className="space-y-5">
                  <QuickBookingForm
                    form={bookingForm}
                    customers={customers}
                    homestays={homestays}
                    rooms={formRooms}
                    isSaving={isSaving}
                    saveError={saveError}
                    onChange={setBookingForm}
                    onAddCustomerClick={() => {
                      setCustomerSaveError("");
                      setShowQuickCustomerModal(true);
                    }}
                    onSubmit={addBooking}
                  />
                  <BookingEntryFormPanel
                    form={bookingEntryForm}
                    bookings={visibleBookings}
                    customers={customers}
                    isSaving={isBookingEntrySaving}
                    saveError={bookingEntrySaveError}
                    onChange={setBookingEntryForm}
                    onSubmit={addBookingEntry}
                  />
                </div>
              </div>
            )}

            {activeModule === "calendar" && (
              <BookingsCalendarView
                bookings={visibleBookings}
                customers={customers}
                homestays={homestays}
                month={calendarMonth}
                onMonthChange={setCalendarMonth}
              />
            )}

            {activeModule === "homestays" && (
              <HomestayGrid
                selectedHomestayId={selectedHomestayId}
                homestays={homestays}
                rooms={rooms}
                bookings={bookingList}
                onEditHomestay={openEditHomestayModal}
              />
            )}

            {activeModule === "customers" && (
              <CustomerTable
                query={query}
                customers={customers}
                onEditCustomer={openEditCustomerModal}
              />
            )}

            {activeModule === "staff" && (
              <StaffPanel
                form={staffForm}
                staffMembers={staffMembers}
                salaryPayments={staffSalaryPayments}
                salaryMonth={staffSalaryMonth}
                isSaving={isStaffSaving}
                saveError={staffSaveError}
                salaryError={staffSalaryError}
                updatingSalaryStaffId={updatingStaffSalaryId}
                disabled={!userId}
                onChange={setStaffForm}
                onSubmit={addStaff}
                onEditStaff={openEditStaffModal}
                onSalaryMonthChange={setStaffSalaryMonth}
                onMarkPaid={openStaffSalaryPaymentModal}
                onMarkUnpaid={markStaffUnpaid}
              />
            )}

            {activeModule === "expenses" && (
              <div className="space-y-5">
                <DateFilterBar
                  dateFrom={expenseDateFrom}
                  dateTo={expenseDateTo}
                  description="Filters expense history by entry date."
                  onDateFromChange={(value) => {
                    setExpenseDateFrom(value);
                    setExpenseHistoryPage(1);
                  }}
                  onDateToChange={(value) => {
                    setExpenseDateTo(value);
                    setExpenseHistoryPage(1);
                  }}
                  onClear={() => {
                    setExpenseDateFrom("");
                    setExpenseDateTo("");
                    setExpenseHistoryPage(1);
                  }}
                />
                <CommonExpensesPanel
                  form={commonExpenseForm}
                  homestays={homestays}
                  expenses={commonExpenseHistory}
                  totalExpenses={filteredCommonExpenseTotal}
                  totalCount={commonExpenseHistoryTotal}
                  page={expenseHistoryPage}
                  pageSize={expenseHistoryPageSize}
                  isHistoryLoading={isCommonExpenseHistoryLoading}
                  historyError={commonExpenseHistoryError}
                  isSaving={isCommonExpenseSaving}
                  saveError={commonExpenseSaveError}
                  deleteError={commonExpenseDeleteError}
                  disabled={!userId}
                  editingExpenseId={editingCommonExpenseId}
                  deletingExpenseId={deletingCommonExpenseId}
                  onChange={setCommonExpenseForm}
                  onSubmit={addCommonExpense}
                  onEdit={editCommonExpense}
                  onCancelEdit={() => cancelCommonExpenseEdit()}
                  onDelete={requestDeleteCommonExpense}
                  onPageChange={setExpenseHistoryPage}
                />
              </div>
            )}

            {activeModule === "accounts" && (
              <AccountsPanel
                accounts={visibleAccounts}
                homestays={homestays}
                staffMembers={staffMembers}
                salaryPayments={visibleSalaryPayments}
                totalRevenue={metrics.totalRevenue}
                totalExpenses={metrics.expenses}
              />
            )}
          </div>
        </main>
      </div>

      {showQuickCustomerModal && (
        <QuickCustomerModal
          form={customerForm}
          isSaving={isCustomerSaving}
          error={customerSaveError}
          disabled={!userId}
          onChange={setCustomerForm}
          onSubmit={addQuickCustomer}
          onClose={() => setShowQuickCustomerModal(false)}
        />
      )}

      {showQuickBookingModal && (
        <DashboardModal
          ariaLabel="Quick booking"
          onClose={() => setShowQuickBookingModal(false)}
        >
          <QuickBookingForm
            form={bookingForm}
            customers={customers}
            homestays={homestays}
            rooms={formRooms}
            isSaving={isSaving}
            saveError={saveError}
            variant="modal"
            onChange={setBookingForm}
            onAddCustomerClick={() => {
              setCustomerSaveError("");
              setShowQuickCustomerModal(true);
            }}
            onSubmit={addBooking}
          />
        </DashboardModal>
      )}

      {showBookingEntryModal && (
        <DashboardModal
          ariaLabel="Booking income or expense"
          onClose={() => setShowBookingEntryModal(false)}
        >
          <BookingEntryFormPanel
            form={bookingEntryForm}
            bookings={visibleBookings}
            customers={customers}
            isSaving={isBookingEntrySaving}
            saveError={bookingEntrySaveError}
            variant="modal"
            onChange={setBookingEntryForm}
            onSubmit={addBookingEntry}
          />
        </DashboardModal>
      )}

      {showEditBookingModal && (
        <DashboardModal
          ariaLabel="Edit booking"
          onClose={() => setShowEditBookingModal(false)}
        >
          <BookingEditFormPanel
            form={bookingEditForm}
            customers={customers}
            homestays={homestays}
            rooms={editFormRooms}
            isSaving={isBookingUpdating}
            saveError={editBookingSaveError}
            onChange={setBookingEditForm}
            onSubmit={saveBookingEdits}
          />
        </DashboardModal>
      )}

      {showEditHomestayModal && (
        <DashboardModal
          ariaLabel="Edit homestay"
          onClose={() => setShowEditHomestayModal(false)}
        >
          <HomestayEditFormPanel
            form={homestayEditForm}
            isSaving={isHomestayUpdating}
            error={editHomestaySaveError}
            disabled={!userId}
            onChange={setHomestayEditForm}
            onSubmit={saveHomestayEdits}
          />
        </DashboardModal>
      )}

      {showEditCustomerModal && (
        <DashboardModal
          ariaLabel="Edit customer"
          onClose={() => setShowEditCustomerModal(false)}
        >
          <CustomerEditFormPanel
            form={customerEditForm}
            isSaving={isCustomerUpdating}
            error={editCustomerSaveError}
            disabled={!userId}
            onChange={setCustomerEditForm}
            onSubmit={saveCustomerEdits}
          />
        </DashboardModal>
      )}

      {showEditStaffModal && (
        <DashboardModal
          ariaLabel="Edit staff"
          onClose={() => setShowEditStaffModal(false)}
        >
          <StaffEditFormPanel
            form={staffEditForm}
            isSaving={isStaffUpdating}
            error={editStaffSaveError}
            disabled={!userId}
            onChange={setStaffEditForm}
            onSubmit={saveStaffEdits}
          />
        </DashboardModal>
      )}

      {showStaffSalaryPaymentModal && (
        <DashboardModal
          ariaLabel="Mark salary paid"
          onClose={() => setShowStaffSalaryPaymentModal(false)}
        >
          <StaffSalaryPaymentPanel
            form={staffSalaryPaymentForm}
            isSaving={updatingStaffSalaryId === staffSalaryPaymentForm.staffId}
            error={staffSalaryError}
            disabled={!userId}
            onChange={setStaffSalaryPaymentForm}
            onSubmit={saveStaffSalaryPayment}
          />
        </DashboardModal>
      )}

      {pendingDeleteCommonExpense && (
        <DashboardModal
          ariaLabel="Delete expense"
          onClose={() => {
            if (!deletingCommonExpenseId) {
              setPendingDeleteCommonExpense(null);
            }
          }}
        >
          <DeleteExpenseConfirm
            expense={pendingDeleteCommonExpense}
            isDeleting={deletingCommonExpenseId === pendingDeleteCommonExpense.id}
            error={commonExpenseDeleteError}
            onCancel={() => setPendingDeleteCommonExpense(null)}
            onConfirm={confirmDeleteCommonExpense}
          />
        </DashboardModal>
      )}
    </div>
  );
}

function MetricGrid({
  metrics,
  bookings: visibleBookings,
}: {
  metrics: {
    bookedRevenue: number;
    totalRevenue: number;
    bookingExtraIncome: number;
    bookingExtraExpense: number;
    expenses: number;
    salaryExpenses: number;
    received: number;
    pending: number;
    occupancy: number;
  };
  bookings: Booking[];
}) {
  return (
    <section className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-5">
      <MetricCard
        label="Total revenue"
        value={inr.format(metrics.totalRevenue)}
        detail={`${inr.format(metrics.bookingExtraIncome)} extras, ${inr.format(metrics.bookingExtraExpense)} adjustments`}
        icon={WalletCards}
        trend="up"
      />
      <MetricCard
        label="Booked revenue"
        value={inr.format(metrics.bookedRevenue)}
        detail={`${visibleBookings.length} active reservations`}
        icon={BarChart3}
        trend="up"
      />
      <MetricCard
        label="Received"
        value={inr.format(metrics.received)}
        detail={`${inr.format(metrics.pending)} still pending`}
        icon={CheckCircle2}
        trend="up"
      />
      <MetricCard
        label="Occupancy"
        value={`${metrics.occupancy}%`}
        detail="Confirmed and checked-in units"
        icon={BedDouble}
        trend="flat"
      />
      <MetricCard
        label="Expenses"
        value={inr.format(metrics.expenses)}
        detail={`${inr.format(metrics.salaryExpenses)} staff salaries`}
        icon={ReceiptText}
        trend="down"
      />
    </section>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  trend,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof BarChart3;
  trend: "up" | "down" | "flat";
}) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-normal text-slate-950">
            {value}
          </p>
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-md bg-slate-100 text-teal-700">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2 text-xs font-medium text-slate-500">
        {trend === "up" && <ArrowUpRight className="h-4 w-4 text-teal-600" />}
        {trend === "down" && (
          <ArrowDownRight className="h-4 w-4 text-red-600" />
        )}
        {trend === "flat" && <Clock3 className="h-4 w-4 text-amber-600" />}
        {detail}
      </div>
    </article>
  );
}

function OverviewFocus({
  bookings,
  accounts,
  customers,
  homestays,
}: {
  bookings: Booking[];
  accounts: AccountEntry[];
  customers: DashboardData["customers"];
  homestays: Homestay[];
}) {
  return (
    <section className="grid min-w-0 gap-5 xl:grid-cols-2">
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4">
          <h2 className="text-base font-semibold text-slate-950">
            Upcoming bookings
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            A short operational view. Use Bookings for the full pipeline.
          </p>
        </div>
        <div className="divide-y divide-slate-100">
          {bookings.length === 0 && (
            <EmptyState message="No bookings in the selected range." />
          )}
          {bookings.slice(0, 4).map((booking) => {
            const customer = customers.find(
              (item) => item.id === booking.customerId,
            );
            const homestay = homestays.find(
              (item) => item.id === booking.homestayId,
            );

            return (
              <div
                key={booking.id}
                className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_120px] md:items-center"
              >
                <div>
                  <p className="font-medium text-slate-950">
                    {customer?.name ?? "Guest"} - {booking.room}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {homestay?.name ?? "Homestay"} -{" "}
                    {formatDate(booking.checkIn)} to{" "}
                    {formatDate(booking.checkOut)}
                  </p>
                </div>
                <p className="text-right text-sm font-semibold text-slate-950">
                  {inr.format(booking.amount)}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4">
          <h2 className="text-base font-semibold text-slate-950">
            Recent account entries
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Latest income, expenses, and booking adjustments.
          </p>
        </div>
        <div className="divide-y divide-slate-100">
          {accounts.length === 0 && (
            <EmptyState message="No account entries in the selected range." />
          )}
          {accounts.slice(0, 5).map((entry) => {
            const homestay = homestays.find(
              (item) => item.id === entry.homestayId,
            );

            return (
              <div
                key={entry.id}
                className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_120px] md:items-center"
              >
                <div>
                  <p className="font-medium text-slate-950">{entry.label}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {homestay?.name ?? "Homestay"} - {entry.category}
                  </p>
                </div>
                <p
                  className={`text-right text-sm font-semibold ${
                    entry.type === "income" ? "text-teal-700" : "text-red-700"
                  }`}
                >
                  {entry.type === "income" ? "+" : "-"}
                  {inr.format(entry.amount)}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function DateFilterBar({
  dateFrom,
  dateTo,
  description = "Filters bookings by stay dates and accounts by entry date.",
  onDateFromChange,
  onDateToChange,
  onClear,
}: {
  dateFrom: string;
  dateTo: string;
  description?: string;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onClear: () => void;
}) {
  const hasFilter = Boolean(dateFrom || dateTo);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">
            Date filter
          </h2>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-[minmax(260px,360px)_auto]">
          <DateRangeControl
            dateFrom={dateFrom}
            dateTo={dateTo}
            label="Date range"
            onDateFromChange={onDateFromChange}
            onDateToChange={onDateToChange}
          />
          <button
            type="button"
            onClick={() => {
              onClear();
            }}
            disabled={!hasFilter}
            className="inline-flex h-10 items-center justify-center gap-2 self-end rounded-md border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:text-slate-300"
          >
            <Filter className="h-4 w-4" />
            Clear
          </button>
        </div>
      </div>
    </section>
  );
}

function DateRangeControl({
  dateFrom,
  dateTo,
  label,
  onDateFromChange,
  onDateToChange,
}: {
  dateFrom: string;
  dateTo: string;
  label: string;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
}) {
  const [isRangeOpen, setIsRangeOpen] = useState(false);

  function setRange(from: string, to: string) {
    onDateFromChange(from);
    onDateToChange(to);
    setIsRangeOpen(false);
  }

  return (
    <div className="relative min-w-0">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <button
        type="button"
        onClick={() => setIsRangeOpen((current) => !current)}
        aria-expanded={isRangeOpen}
        className="inline-flex h-10 w-full items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 text-left text-sm font-semibold text-slate-800 transition hover:border-teal-300"
      >
        <span className="inline-flex min-w-0 items-center gap-2">
          <CalendarDays className="h-4 w-4 shrink-0 text-teal-700" />
          <span className="truncate">
            {formatDateRangeLabel(dateFrom, dateTo)}
          </span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
      </button>
      {isRangeOpen && (
        <div className="absolute right-0 z-30 mt-2 w-full rounded-lg border border-slate-200 bg-white p-3 shadow-lg sm:w-[360px]">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Start date">
              <input
                type="date"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(event) => {
                  const nextFrom = event.target.value;

                  onDateFromChange(nextFrom);

                  if (dateTo && nextFrom && nextFrom > dateTo) {
                    onDateToChange(nextFrom);
                  }
                }}
                className="field-control"
              />
            </Field>
            <Field label="End date">
              <input
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(event) => {
                  const nextTo = event.target.value;

                  onDateToChange(nextTo);

                  if (dateFrom && nextTo && nextTo < dateFrom) {
                    onDateFromChange(nextTo);
                  }
                }}
                className="field-control"
              />
            </Field>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setRange(todayIso(), todayIso())}
              className="rounded-md border border-slate-200 px-2 py-2 text-xs font-semibold text-slate-700 transition hover:border-teal-300 hover:text-teal-800"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setRange(todayIso(), addDaysIso(new Date(), 6))}
              className="rounded-md border border-slate-200 px-2 py-2 text-xs font-semibold text-slate-700 transition hover:border-teal-300 hover:text-teal-800"
            >
              Next 7 days
            </button>
            <button
              type="button"
              onClick={() =>
                setRange(startOfMonthIso(new Date()), endOfMonthIso(new Date()))
              }
              className="rounded-md border border-slate-200 px-2 py-2 text-xs font-semibold text-slate-700 transition hover:border-teal-300 hover:text-teal-800"
            >
              This month
            </button>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => setIsRangeOpen(false)}
              className="rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-teal-800"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function BookingsCalendarView({
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
                      roomy
                    />
                  ))}
                </div>
              </div>
            );
          })}
      </div>
    </section>
  );
}

function CalendarBookingChip({
  booking,
  customer,
  homestay,
  roomy = false,
}: {
  booking: Booking;
  customer?: DashboardData["customers"][number];
  homestay?: Homestay;
  roomy?: boolean;
}) {
  return (
    <div
      className={`min-w-0 rounded-md border px-2 py-1.5 ${statusStyles[booking.status]} ${
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
    </div>
  );
}

function BookingTable({
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

function QuickBookingForm({
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

function BookingEditFormPanel({
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

function SearchableCustomerSelect({
  customers,
  selectedCustomerId,
  onSelect,
}: {
  customers: DashboardData["customers"];
  selectedCustomerId: string;
  onSelect: (customerId: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedCustomer = customers.find(
    (customer) => customer.id === selectedCustomerId,
  );
  const [search, setSearch] = useState(selectedCustomer?.name ?? "");

  const filteredCustomers = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term || selectedCustomer?.name === search) {
      return customers;
    }

    return customers.filter((customer) => {
      return `${customer.name} ${customer.phone} ${customer.email} ${customer.city}`
        .toLowerCase()
        .includes(term);
    });
  }, [customers, search, selectedCustomer?.name]);

  return (
    <div className="relative min-w-0">
      <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-8 text-sm text-slate-800 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
        placeholder={
          customers.length === 0 ? "No customers found" : "Search customer"
        }
        disabled={customers.length === 0}
      />
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />

      {isOpen && customers.length > 0 && (
        <div className="absolute left-0 right-0 top-11 z-40 max-h-64 overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg">
          {filteredCustomers.length === 0 && (
            <p className="px-3 py-2 text-sm text-slate-500">
              No matching customers.
            </p>
          )}
          {filteredCustomers.map((customer) => (
            <button
              key={customer.id}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onSelect(customer.id);
                setSearch(customer.name);
                setIsOpen(false);
              }}
              className={`block w-full px-3 py-2 text-left text-sm transition hover:bg-teal-50 ${
                customer.id === selectedCustomerId
                  ? "bg-teal-50 text-teal-800"
                  : "text-slate-800"
              }`}
            >
              <span className="block font-medium">{customer.name}</span>
              <span className="mt-0.5 block text-xs text-slate-500">
                {customer.phone ||
                  customer.email ||
                  customer.city ||
                  "No contact details"}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DashboardModal({
  ariaLabel,
  children,
  onClose,
}: {
  ariaLabel: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      aria-label={ariaLabel}
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-end bg-slate-950/40 p-0 sm:place-items-center sm:p-4"
    >
      <button
        type="button"
        aria-label="Dismiss popup"
        className="absolute inset-0"
        onClick={onClose}
      />
      <div className="relative max-h-[92vh] w-full overflow-y-auto rounded-t-lg border border-slate-200 bg-white p-4 sm:max-w-2xl sm:rounded-lg">
        <button
          type="button"
          aria-label="Close popup"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 grid h-9 w-9 place-items-center rounded-md border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="w-full">{children}</div>
      </div>
    </div>
  );
}

function DeleteExpenseConfirm({
  expense,
  isDeleting,
  error,
  onCancel,
  onConfirm,
}: {
  expense: AccountEntry;
  isDeleting: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <section className="min-w-0 pr-10">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-red-50 text-red-700">
          <Trash2 className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-950">
            Delete expense
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            This removes the expense from history and updates account totals.
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="font-medium text-slate-950">{expense.label}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
          <span>{expense.category}</span>
          <span>{formatDate(expense.date)}</span>
          <span className="font-semibold text-red-700">
            -{inr.format(expense.amount)}
          </span>
        </div>
      </div>

      {error && <p className="mt-4 text-sm font-medium text-red-700">{error}</p>}

      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isDeleting}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white text-sm font-semibold text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:text-slate-300"
        >
          <X className="h-4 w-4" />
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isDeleting}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-red-700 text-sm font-semibold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:bg-red-300"
        >
          <Trash2 className="h-4 w-4" />
          {isDeleting ? "Deleting expense" : "Delete expense"}
        </button>
      </div>
    </section>
  );
}

function QuickCustomerModal({
  form,
  isSaving,
  error,
  disabled,
  onChange,
  onSubmit,
  onClose,
}: {
  form: CustomerForm;
  isSaving: boolean;
  error: string;
  disabled: boolean;
  onChange: (form: CustomerForm) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/40 p-4">
      <div className="w-full max-w-2xl">
        <CustomerCreateForm
          form={form}
          isSaving={isSaving}
          error={error}
          disabled={disabled}
          onChange={onChange}
          onSubmit={onSubmit}
          onCancel={onClose}
        />
      </div>
    </div>
  );
}

function BookingLineItemsEditor({
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

function BookingEntryFormPanel({
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

function BookingEntryList({
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

function HomestayCreateForm({
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

function HomestayEditFormPanel({
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

function RoomListEditor({
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

function CustomerCreateForm({
  form,
  isSaving,
  error,
  disabled,
  onChange,
  onSubmit,
  onCancel,
}: {
  form: CustomerForm;
  isSaving: boolean;
  error: string;
  disabled: boolean;
  onChange: (form: CustomerForm) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">
            Add Customer
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Create a guest profile for bookings and stay history.
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
        <Field label="Full name">
          <input
            value={form.fullName}
            onChange={(event) =>
              onChange({ ...form, fullName: event.target.value })
            }
            className="field-control"
            required
            disabled={disabled}
          />
        </Field>
        <Field label="Phone">
          <input
            value={form.phone}
            onChange={(event) =>
              onChange({ ...form, phone: event.target.value })
            }
            className="field-control"
            required
            disabled={disabled}
          />
        </Field>
        <Field label="Email">
          <input
            type="email"
            value={form.email}
            onChange={(event) =>
              onChange({ ...form, email: event.target.value })
            }
            className="field-control"
            disabled={disabled}
          />
        </Field>
        <Field label="City">
          <input
            value={form.city}
            onChange={(event) =>
              onChange({ ...form, city: event.target.value })
            }
            className="field-control"
            disabled={disabled}
          />
        </Field>
        <div className="lg:col-span-2">
          <Field label="Preferences">
            <input
              value={form.preferences}
              onChange={(event) =>
                onChange({ ...form, preferences: event.target.value })
              }
              className="field-control"
              disabled={disabled}
            />
          </Field>
        </div>
        <div className="lg:col-span-3">
          <button
            type="submit"
            disabled={disabled || isSaving}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <Plus className="h-4 w-4" />
            {isSaving ? "Adding customer" : "Add Customer"}
          </button>
          {disabled && (
            <p className="mt-2 text-sm text-slate-500">
              Sign in to Supabase before adding customers.
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

function CustomerEditFormPanel({
  form,
  isSaving,
  error,
  disabled,
  onChange,
  onSubmit,
}: {
  form: CustomerEditForm;
  isSaving: boolean;
  error: string;
  disabled: boolean;
  onChange: (form: CustomerEditForm) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const canSubmit = Boolean(
    form.customerId && form.fullName && form.phone && !isSaving,
  );

  return (
    <section className="min-w-0 bg-white">
      <h2 className="text-base font-semibold text-slate-950">Edit Customer</h2>
      <p className="mt-1 text-sm text-slate-500">
        Update contact details and guest preferences.
      </p>

      <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={onSubmit}>
        <Field label="Full name">
          <input
            value={form.fullName}
            onChange={(event) =>
              onChange({ ...form, fullName: event.target.value })
            }
            className="field-control"
            required
            disabled={disabled}
          />
        </Field>
        <Field label="Phone">
          <input
            value={form.phone}
            onChange={(event) =>
              onChange({ ...form, phone: event.target.value })
            }
            className="field-control"
            required
            disabled={disabled}
          />
        </Field>
        <Field label="Email">
          <input
            type="email"
            value={form.email}
            onChange={(event) =>
              onChange({ ...form, email: event.target.value })
            }
            className="field-control"
            disabled={disabled}
          />
        </Field>
        <Field label="City">
          <input
            value={form.city}
            onChange={(event) =>
              onChange({ ...form, city: event.target.value })
            }
            className="field-control"
            disabled={disabled}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Preferences">
            <input
              value={form.preferences}
              onChange={(event) =>
                onChange({ ...form, preferences: event.target.value })
              }
              className="field-control"
              disabled={disabled}
            />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={disabled || !canSubmit}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-slate-950 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <Pencil className="h-4 w-4" />
            {isSaving ? "Saving changes" : "Update Customer"}
          </button>
          {disabled && (
            <p className="mt-2 text-sm text-slate-500">
              Sign in to Supabase before editing customers.
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

function HomestayGrid({
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

function HomestayCard({
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

function CustomerTable({
  query,
  customers,
  onEditCustomer,
}: {
  query: string;
  customers: DashboardData["customers"];
  onEditCustomer: (customer: DashboardData["customers"][number]) => void;
}) {
  const [customerSearch, setCustomerSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 8;
  const cityOptions = useMemo(() => {
    return Array.from(
      new Set(
        customers
          .map((customer) => customer.city.trim())
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b)),
      ),
    );
  }, [customers]);
  const visibleCustomers = useMemo(() => {
    const globalTerm = query.trim().toLowerCase();
    const localTerm = customerSearch.trim().toLowerCase();

    return customers
      .filter((customer) => {
        const haystack =
          `${customer.name} ${customer.phone} ${customer.email} ${customer.city} ${customer.preference}`.toLowerCase();
        const matchesGlobal = !globalTerm || haystack.includes(globalTerm);
        const matchesLocal = !localTerm || haystack.includes(localTerm);
        const matchesCity =
          cityFilter === "all" || customer.city === cityFilter;

        return matchesGlobal && matchesLocal && matchesCity;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [cityFilter, customerSearch, customers, query]);
  const totalPages = Math.max(1, Math.ceil(visibleCustomers.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const paginatedCustomers = visibleCustomers.slice(
    pageStart,
    pageStart + pageSize,
  );

  return (
    <section className="min-w-0 rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-200 p-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">
            Customers
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Full guest list with contact details, stay history, and preferences.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,260px)_180px]">
          <label className="relative min-w-0">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Filter customers
            </span>
            <Search className="pointer-events-none absolute left-3 top-[34px] h-4 w-4 text-slate-400" />
            <input
              value={customerSearch}
              onChange={(event) => {
                setCustomerSearch(event.target.value);
                setPage(1);
              }}
              className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              placeholder="Name, phone, email"
            />
          </label>
          <Field label="City">
            <select
              value={cityFilter}
              onChange={(event) => {
                setCityFilter(event.target.value);
                setPage(1);
              }}
              className="field-control"
            >
              <option value="all">All cities</option>
              {cityOptions.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      <div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-3 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <p>
          Showing {visibleCustomers.length === 0 ? 0 : pageStart + 1}-
          {Math.min(pageStart + pageSize, visibleCustomers.length)} of{" "}
          {visibleCustomers.length} customers
        </p>
        {(customerSearch || cityFilter !== "all") && (
          <button
            type="button"
            onClick={() => {
              setCustomerSearch("");
              setCityFilter("all");
              setPage(1);
            }}
            className="inline-flex h-8 items-center justify-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
          >
            <Filter className="h-4 w-4" />
            Clear filters
          </button>
        )}
      </div>

      <div className="divide-y divide-slate-100 md:hidden">
        {visibleCustomers.length === 0 && (
          <EmptyState message="No customers matched the current search." />
        )}
        {paginatedCustomers.map((customer) => (
          <article key={customer.id} className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-950">
                  {customer.name}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {customer.phone || "No phone"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onEditCustomer(customer)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-slate-200 text-slate-700 transition hover:border-slate-300"
                aria-label={`Edit ${customer.name}`}
              >
                <Pencil className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-2 text-sm text-slate-500">
              <p>{customer.email || "No email"}</p>
              <p>{customer.city || "No city"}</p>
              <p>{customer.preference || "No preferences recorded"}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Stays" value={String(customer.stays)} />
              <Stat
                label="Lifetime value"
                value={inr.format(customer.lifetimeValue)}
              />
            </div>
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Customer</th>
              <th className="px-4 py-3 font-semibold">Contact</th>
              <th className="px-4 py-3 font-semibold">City</th>
              <th className="px-4 py-3 font-semibold">Preferences</th>
              <th className="px-4 py-3 text-right font-semibold">Stays</th>
              <th className="px-4 py-3 text-right font-semibold">Lifetime</th>
              <th className="px-4 py-3 text-right font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibleCustomers.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <EmptyState message="No customers matched the current filters." />
                </td>
              </tr>
            )}
            {paginatedCustomers.map((customer) => (
              <tr key={customer.id} className="hover:bg-slate-50">
                <td className="px-4 py-4">
                  <p className="font-semibold text-slate-950">
                    {customer.name}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Last stay: {formatDate(customer.lastStay)}
                  </p>
                </td>
                <td className="px-4 py-4">
                  <p className="font-medium text-slate-900">
                    {customer.phone || "No phone"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {customer.email || "No email"}
                  </p>
                </td>
                <td className="px-4 py-4 text-slate-600">
                  {customer.city || "Unassigned"}
                </td>
                <td className="max-w-xs px-4 py-4">
                  <p className="truncate text-slate-600">
                    {customer.preference || "No preferences recorded"}
                  </p>
                </td>
                <td className="px-4 py-4 text-right font-semibold text-slate-950">
                  {customer.stays}
                </td>
                <td className="px-4 py-4 text-right font-semibold text-slate-950">
                  {inr.format(customer.lifetimeValue)}
                </td>
                <td className="px-4 py-4 text-right">
                  <button
                    type="button"
                    onClick={() => onEditCustomer(customer)}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
                  >
                    <Pencil className="h-4 w-4" />
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">
          Page {currentPage} of {totalPages}
        </p>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={currentPage === 1}
            className="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:text-slate-300"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() =>
              setPage((current) => Math.min(totalPages, current + 1))
            }
            disabled={currentPage === totalPages}
            className="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:text-slate-300"
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}

function StaffPanel({
  form,
  staffMembers,
  salaryPayments,
  salaryMonth,
  isSaving,
  saveError,
  salaryError,
  updatingSalaryStaffId,
  disabled,
  onChange,
  onSubmit,
  onEditStaff,
  onSalaryMonthChange,
  onMarkPaid,
  onMarkUnpaid,
}: {
  form: StaffForm;
  staffMembers: StaffMember[];
  salaryPayments: DashboardData["staffSalaryPayments"];
  salaryMonth: string;
  isSaving: boolean;
  saveError: string;
  salaryError: string;
  updatingSalaryStaffId: string;
  disabled: boolean;
  onChange: (form: StaffForm) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onEditStaff: (staff: StaffMember) => void;
  onSalaryMonthChange: (month: string) => void;
  onMarkPaid: (staff: StaffMember) => void;
  onMarkUnpaid: (payment: StaffSalaryPayment) => void;
}) {
  const [staffSearch, setStaffSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const selectedSalaryMonth = salaryMonthDate(salaryMonth);
  const visibleStaff = useMemo(() => {
    const term = staffSearch.trim().toLowerCase();

    return staffMembers
      .filter((staff) => {
        const haystack =
          `${staff.name} ${staff.mobileNumber} ${staff.email} ${staff.aadharNumber} ${staff.panNumber} ${staff.employeeType}`.toLowerCase();
        const matchesSearch = !term || haystack.includes(term);
        const matchesType =
          typeFilter === "all" || staff.employeeType === typeFilter;

        return matchesSearch && matchesType;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [staffMembers, staffSearch, typeFilter]);
  const activeStaffCount = staffMembers.filter((staff) => staff.isActive).length;
  const paidStaffIds = new Set(
    salaryPayments
      .filter((payment) => payment.salaryMonth === selectedSalaryMonth)
      .map((payment) => payment.staffId),
  );
  const paidCount = staffMembers.filter((staff) =>
    paidStaffIds.has(staff.id),
  ).length;
  const salaryDue = staffMembers
    .filter((staff) => !paidStaffIds.has(staff.id))
    .reduce(
      (total, staff) =>
        total + staff.monthlySalary + staff.monthlyIncentive,
      0,
    );
  const typeOptions = Array.from(
    new Set([...employeeTypes, ...staffMembers.map((staff) => staff.employeeType)]),
  ).filter(Boolean);

  return (
    <section className="grid min-w-0 gap-5 2xl:grid-cols-[420px_minmax(0,1fr)]">
      <StaffCreateForm
        form={form}
        isSaving={isSaving}
        error={saveError}
        disabled={disabled}
        onChange={onChange}
        onSubmit={onSubmit}
      />

      <div className="min-w-0 rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950">
              Staff
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Team details and salary status for the selected month.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,220px)_180px_180px]">
            <label className="relative min-w-0">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Search staff
              </span>
              <Search className="pointer-events-none absolute left-3 top-[34px] h-4 w-4 text-slate-400" />
              <input
                value={staffSearch}
                onChange={(event) => setStaffSearch(event.target.value)}
                className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                placeholder="Name, mobile, email, ID"
              />
            </label>
            <Field label="Type">
              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
                className="field-control"
              >
                <option value="all">All types</option>
                {typeOptions.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Salary month">
              <input
                type="month"
                value={salaryMonth}
                onChange={(event) => onSalaryMonthChange(event.target.value)}
                className="field-control"
              />
            </Field>
          </div>
        </div>

        <div className="grid gap-3 border-b border-slate-100 p-4 md:grid-cols-3">
          <Stat label="Active staff" value={String(activeStaffCount)} />
          <Stat
            label={`${formatMonthLabel(salaryMonth)} paid`}
            value={`${paidCount}/${staffMembers.length}`}
          />
          <Stat label="Salary due" value={inr.format(salaryDue)} />
        </div>

        {salaryError && (
          <p className="border-b border-slate-100 p-4 text-sm font-medium text-red-700">
            {salaryError}
          </p>
        )}

        <div className="divide-y divide-slate-100">
          {visibleStaff.length === 0 && (
            <EmptyState message="No staff matched the current filters." />
          )}
          {visibleStaff.map((staff) => {
            const payment = salaryPayments.find(
              (item) =>
                item.staffId === staff.id &&
                item.salaryMonth === selectedSalaryMonth,
            );
            const isPaid = Boolean(payment);
            const isUpdating = updatingSalaryStaffId === staff.id;

            return (
              <article
                key={staff.id}
                className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_190px_210px] xl:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-950">
                      {staff.name}
                    </p>
                    <span
                      className={`rounded-md border px-2 py-1 text-xs font-semibold ${
                        staff.isActive
                          ? "border-teal-200 bg-teal-50 text-teal-700"
                          : "border-slate-200 bg-slate-50 text-slate-500"
                      }`}
                    >
                      {staff.isActive ? "active" : "inactive"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {staff.employeeType} - {staff.mobileNumber || "No mobile"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {staff.email || "No email"} - Joined {staff.dateOfJoining ? formatDate(staff.dateOfJoining) : "Not recorded"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Emergency: {staff.emergencyContact || "Not recorded"}
                  </p>
                </div>

                <div className="grid gap-1 text-sm text-slate-600">
                  <p>Aadhar: {staff.aadharNumber || "Not recorded"}</p>
                  <p>PAN: {staff.panNumber || "Not recorded"}</p>
                  <p>
                    Days worked:{" "}
                    {payment ? String(payment.daysWorked) : "Not marked"}
                  </p>
                  <p>
                    Default incentive: {inr.format(staff.monthlyIncentive)}
                  </p>
                </div>

                <div>
                  <p className="text-sm font-semibold text-slate-950">
                    {inr.format(payment?.amount ?? staff.monthlySalary)}
                  </p>
                  <span
                    className={`mt-2 inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${
                      isPaid
                        ? "border-teal-200 bg-teal-50 text-teal-700"
                        : "border-amber-200 bg-amber-50 text-amber-700"
                    }`}
                  >
                    {isPaid ? "Paid" : "Unpaid"}
                  </span>
                  {payment && (
                    <div className="mt-1 space-y-0.5 text-xs text-slate-500">
                      <p>Paid on {formatDate(payment.paidOn)}</p>
                      <p>
                        {payment.paymentMethod === "split"
                          ? `Cash ${inr.format(payment.cashAmount)} / Bank ${inr.format(payment.bankAmount)}`
                          : `${payment.paymentMethod === "cash" ? "Cash" : "Bank"} payment`}
                      </p>
                      {payment.advanceAmount > 0 && (
                        <p>Advance {inr.format(payment.advanceAmount)}</p>
                      )}
                      <p>
                        Incentive {inr.format(payment.incentiveAmount)}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap justify-start gap-2 xl:justify-end">
                  <button
                    type="button"
                    onClick={() => onEditStaff(staff)}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
                  >
                    <Pencil className="h-4 w-4" />
                    Edit
                  </button>
                  {isPaid ? (
                    <>
                      <button
                        type="button"
                        onClick={() => onMarkPaid(staff)}
                        disabled={disabled || isUpdating}
                        className="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:text-slate-300"
                      >
                        Edit pay
                      </button>
                      <button
                        type="button"
                        onClick={() => payment && onMarkUnpaid(payment)}
                        disabled={disabled || isUpdating}
                        className="inline-flex h-9 items-center justify-center rounded-md border border-amber-200 px-3 text-sm font-semibold text-amber-700 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:text-amber-300"
                      >
                        {isUpdating ? "Saving" : "Mark unpaid"}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onMarkPaid(staff)}
                      disabled={disabled || isUpdating}
                      className="inline-flex h-9 items-center justify-center rounded-md bg-teal-700 px-3 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      {isUpdating ? "Saving" : "Mark paid"}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function StaffCreateForm({
  form,
  isSaving,
  error,
  disabled,
  onChange,
  onSubmit,
}: {
  form: StaffForm;
  isSaving: boolean;
  error: string;
  disabled: boolean;
  onChange: (form: StaffForm) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold text-slate-950">Add staff</h2>
      <p className="mt-1 text-sm text-slate-500">
        Record employee contact, joining, payroll, and identity details.
      </p>
      <form className="mt-5 space-y-4" onSubmit={onSubmit}>
        <StaffFormFields form={form} disabled={disabled} onChange={onChange} />
        <button
          type="submit"
          disabled={
            disabled || isSaving || !form.name.trim() || !form.mobileNumber.trim()
          }
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-slate-950 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <Plus className="h-4 w-4" />
          {isSaving ? "Saving staff" : "Add staff"}
        </button>
        {disabled && (
          <p className="text-sm text-slate-500">Sign in before adding staff.</p>
        )}
        {error && <p className="text-sm font-medium text-red-700">{error}</p>}
      </form>
    </section>
  );
}

function StaffEditFormPanel({
  form,
  isSaving,
  error,
  disabled,
  onChange,
  onSubmit,
}: {
  form: StaffEditForm;
  isSaving: boolean;
  error: string;
  disabled: boolean;
  onChange: (form: StaffEditForm) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section className="min-w-0 bg-white">
      <h2 className="text-base font-semibold text-slate-950">Edit Staff</h2>
      <p className="mt-1 text-sm text-slate-500">
        Update staff contact, joining, payroll, identity, and status details.
      </p>
      <form className="mt-5 space-y-4" onSubmit={onSubmit}>
        <StaffFormFields
          form={form}
          disabled={disabled}
          onChange={(nextForm) => onChange({ ...form, ...nextForm })}
        />
        <label className="flex h-10 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(event) =>
              onChange({ ...form, isActive: event.target.checked })
            }
            disabled={disabled}
            className="h-4 w-4 rounded border-slate-300 text-teal-700"
          />
          Active employee
        </label>
        <button
          type="submit"
          disabled={
            disabled || isSaving || !form.name.trim() || !form.mobileNumber.trim()
          }
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-slate-950 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <Pencil className="h-4 w-4" />
          {isSaving ? "Saving staff" : "Update staff"}
        </button>
        {error && <p className="text-sm font-medium text-red-700">{error}</p>}
      </form>
    </section>
  );
}

function StaffSalaryPaymentPanel({
  form,
  isSaving,
  error,
  disabled,
  onChange,
  onSubmit,
}: {
  form: StaffSalaryPaymentForm;
  isSaving: boolean;
  error: string;
  disabled: boolean;
  onChange: (form: StaffSalaryPaymentForm) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const grossPay = form.baseAmount + form.incentiveAmount;
  const paidTotal = form.advanceAmount + form.cashAmount + form.bankAmount;
  const balance = grossPay - paidTotal;
  const isBalanced = Math.abs(balance) <= 0.01;

  return (
    <section className="min-w-0 bg-white">
      <h2 className="text-base font-semibold text-slate-950">
        Mark salary paid
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        Record work days, incentives, advance, and cash or bank payment for {form.staffName}.
      </p>
      <form className="mt-5 space-y-4" onSubmit={onSubmit}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Salary month">
            <input
              type="month"
              value={form.salaryMonth.slice(0, 7)}
              onChange={(event) =>
                onChange({
                  ...form,
                  salaryMonth: salaryMonthDate(event.target.value),
                })
              }
              className="field-control"
              disabled={disabled || isSaving}
              required
            />
          </Field>
          <Field label="Days worked">
            <input
              type="number"
              min="0"
              value={form.daysWorked}
              onChange={(event) =>
                onChange({ ...form, daysWorked: Number(event.target.value) })
              }
              className="field-control"
              disabled={disabled || isSaving}
              required
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Base salary">
            <input
              type="number"
              min="0"
              value={form.baseAmount}
              onChange={(event) =>
                onChange(
                  applyStaffPaymentMethod(
                    {
                      ...form,
                      baseAmount: Number(event.target.value),
                    },
                    form.paymentMethod,
                  ),
                )
              }
              className="field-control"
              disabled={disabled || isSaving}
              required
            />
          </Field>
          <Field label="Incentives">
            <input
              type="number"
              min="0"
              value={form.incentiveAmount}
              onChange={(event) =>
                onChange(
                  applyStaffPaymentMethod(
                    {
                      ...form,
                      incentiveAmount: Number(event.target.value),
                    },
                    form.paymentMethod,
                  ),
                )
              }
              className="field-control"
              disabled={disabled || isSaving}
              required
            />
          </Field>
          <Field label="Advance already paid">
            <input
              type="number"
              min="0"
              value={form.advanceAmount}
              onChange={(event) =>
                onChange(
                  applyStaffPaymentMethod(
                    {
                      ...form,
                      advanceAmount: Number(event.target.value),
                    },
                    form.paymentMethod,
                  ),
                )
              }
              className="field-control"
              disabled={disabled || isSaving}
              required
            />
          </Field>
        </div>

        <fieldset>
          <legend className="mb-1 text-xs font-semibold uppercase text-slate-500">
            Payment type
          </legend>
          <div className="grid grid-cols-3 rounded-md border border-slate-200 bg-slate-50 p-1">
            {staffPaymentMethods.map((method) => (
              <button
                key={method.value}
                type="button"
                onClick={() =>
                  onChange(applyStaffPaymentMethod(form, method.value))
                }
                disabled={disabled || isSaving}
                className={`h-9 rounded text-sm font-semibold transition ${
                  form.paymentMethod === method.value
                    ? "bg-white text-slate-950 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {method.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Cash paid">
            <input
              type="number"
              min="0"
              value={form.cashAmount}
              onChange={(event) =>
                onChange({ ...form, cashAmount: Number(event.target.value) })
              }
              className="field-control"
              disabled={
                disabled || isSaving || form.paymentMethod === "bank"
              }
              required
            />
          </Field>
          <Field label="Bank paid">
            <input
              type="number"
              min="0"
              value={form.bankAmount}
              onChange={(event) =>
                onChange({ ...form, bankAmount: Number(event.target.value) })
              }
              className="field-control"
              disabled={
                disabled || isSaving || form.paymentMethod === "cash"
              }
              required
            />
          </Field>
        </div>

        <div className="grid gap-3 rounded-md bg-slate-50 p-3 sm:grid-cols-3">
          <Stat label="Gross pay" value={inr.format(grossPay)} />
          <Stat label="Total paid" value={inr.format(paidTotal)} />
          <div className="min-w-0 rounded-md bg-white p-3">
            <p className="text-xs font-medium text-slate-500">Balance</p>
            <p
              className={`mt-1 text-sm font-semibold ${
                isBalanced ? "text-teal-700" : "text-red-700"
              }`}
            >
              {inr.format(balance)}
            </p>
          </div>
        </div>

        <Field label="Paid date">
          <input
            type="date"
            value={form.paidOn}
            onChange={(event) =>
              onChange({ ...form, paidOn: event.target.value })
            }
            className="field-control"
            disabled={disabled || isSaving}
            required
          />
        </Field>
        <button
          type="submit"
          disabled={
            disabled ||
            isSaving ||
            !form.staffId ||
            !form.paidOn ||
            form.daysWorked < 0 ||
            form.baseAmount < 0 ||
            form.incentiveAmount < 0 ||
            form.advanceAmount < 0 ||
            form.cashAmount < 0 ||
            form.bankAmount < 0 ||
            !isBalanced
          }
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-slate-950 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <CheckCircle2 className="h-4 w-4" />
          {isSaving ? "Saving payment" : "Save salary payment"}
        </button>
        {error && <p className="text-sm font-medium text-red-700">{error}</p>}
      </form>
    </section>
  );
}

function StaffFormFields({
  form,
  disabled,
  onChange,
}: {
  form: StaffForm;
  disabled: boolean;
  onChange: (form: StaffForm) => void;
}) {
  return (
    <>
      <Field label="Name">
        <input
          value={form.name}
          onChange={(event) => onChange({ ...form, name: event.target.value })}
          className="field-control"
          required
          disabled={disabled}
        />
      </Field>
      <Field label="Mobile number">
        <input
          value={form.mobileNumber}
          onChange={(event) =>
            onChange({ ...form, mobileNumber: event.target.value })
          }
          className="field-control"
          required
          disabled={disabled}
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Email ID">
          <input
            type="email"
            value={form.email}
            onChange={(event) =>
              onChange({ ...form, email: event.target.value })
            }
            className="field-control"
            disabled={disabled}
          />
        </Field>
        <Field label="Date of joining">
          <input
            type="date"
            value={form.dateOfJoining}
            onChange={(event) =>
              onChange({ ...form, dateOfJoining: event.target.value })
            }
            className="field-control"
            disabled={disabled}
          />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Aadhar number">
          <input
            value={form.aadharNumber}
            onChange={(event) =>
              onChange({ ...form, aadharNumber: event.target.value })
            }
            className="field-control"
            disabled={disabled}
          />
        </Field>
        <Field label="PAN number">
          <input
            value={form.panNumber}
            onChange={(event) =>
              onChange({ ...form, panNumber: event.target.value })
            }
            className="field-control"
            disabled={disabled}
          />
        </Field>
      </div>
      <Field label="Emergency contact">
        <input
          value={form.emergencyContact}
          onChange={(event) =>
            onChange({ ...form, emergencyContact: event.target.value })
          }
          className="field-control"
          disabled={disabled}
        />
      </Field>
      <Field label="Employee type">
        <select
          value={form.employeeType}
          onChange={(event) =>
            onChange({ ...form, employeeType: event.target.value })
          }
          className="field-control"
          disabled={disabled}
        >
          {employeeTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Monthly salary">
          <input
            type="number"
            min="0"
            value={form.monthlySalary}
            onChange={(event) =>
              onChange({ ...form, monthlySalary: Number(event.target.value) })
            }
            className="field-control"
            disabled={disabled}
          />
        </Field>
        <Field label="Default incentive">
          <input
            type="number"
            min="0"
            value={form.monthlyIncentive}
            onChange={(event) =>
              onChange({
                ...form,
                monthlyIncentive: Number(event.target.value),
              })
            }
            className="field-control"
            disabled={disabled}
          />
        </Field>
      </div>
    </>
  );
}

function CommonExpensesPanel({
  form,
  homestays,
  expenses,
  totalExpenses,
  totalCount,
  page,
  pageSize,
  isHistoryLoading,
  historyError,
  isSaving,
  saveError,
  deleteError,
  disabled,
  editingExpenseId,
  deletingExpenseId,
  onChange,
  onSubmit,
  onEdit,
  onCancelEdit,
  onDelete,
  onPageChange,
}: {
  form: CommonExpenseForm;
  homestays: Homestay[];
  expenses: AccountEntry[];
  totalExpenses: number;
  totalCount: number;
  page: number;
  pageSize: number;
  isHistoryLoading: boolean;
  historyError: string;
  isSaving: boolean;
  saveError: string;
  deleteError: string;
  disabled: boolean;
  editingExpenseId: string;
  deletingExpenseId: string;
  onChange: (form: CommonExpenseForm) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onEdit: (expense: AccountEntry) => void;
  onCancelEdit: () => void;
  onDelete: (expense: AccountEntry) => void;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const firstItem = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastItem = Math.min(totalCount, page * pageSize);
  const canSubmit = Boolean(
    form.homestayId &&
      form.category &&
      form.label &&
      form.entryDate &&
      form.amount > 0 &&
      !isSaving,
  );

  return (
    <section className="grid min-w-0 gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-slate-950">
          Common expenses
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Record rent, maid salary, utilities, supplies, and recurring property costs.
        </p>

        <form className="mt-5 space-y-4" onSubmit={onSubmit}>
          <Field label="Homestay">
            <select
              value={form.homestayId}
              onChange={(event) =>
                onChange({ ...form, homestayId: event.target.value })
              }
              className="field-control"
              disabled={disabled || homestays.length === 0}
              required
            >
              <option value="">Select homestay</option>
              {homestays.map((homestay) => (
                <option key={homestay.id} value={homestay.id}>
                  {homestay.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Category">
            <select
              value={form.category}
              onChange={(event) =>
                onChange({
                  ...form,
                  category: event.target.value,
                  label: defaultCommonExpenseLabel(event.target.value),
                })
              }
              className="field-control"
              disabled={disabled}
            >
              {commonExpenseCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Label">
            <input
              value={form.label}
              onChange={(event) =>
                onChange({ ...form, label: event.target.value })
              }
              className="field-control"
              required
              disabled={disabled}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Date">
              <input
                type="date"
                value={form.entryDate}
                onChange={(event) =>
                  onChange({ ...form, entryDate: event.target.value })
                }
                className="field-control"
                required
                disabled={disabled}
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
                required
                disabled={disabled}
              />
            </Field>
          </div>
          <label className="flex h-10 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={form.isCleared}
              onChange={(event) =>
                onChange({ ...form, isCleared: event.target.checked })
              }
              disabled={disabled}
              className="h-4 w-4 rounded border-slate-300 text-teal-700"
            />
            Paid / cleared
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="submit"
              disabled={disabled || !canSubmit}
              className={`inline-flex h-10 items-center justify-center gap-2 rounded-md text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-slate-300 ${
                editingExpenseId
                  ? "bg-teal-700 hover:bg-teal-800"
                  : "bg-slate-950 hover:bg-slate-800"
              } ${editingExpenseId ? "" : "sm:col-span-2"}`}
            >
              {editingExpenseId ? (
                <Pencil className="h-4 w-4" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {isSaving
                ? "Saving expense"
                : editingExpenseId
                  ? "Update expense"
                  : "Add expense"}
            </button>
            {editingExpenseId && (
              <button
                type="button"
                onClick={onCancelEdit}
                disabled={disabled || isSaving}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white text-sm font-semibold text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:text-slate-300"
              >
                <X className="h-4 w-4" />
                Cancel
              </button>
            )}
          </div>
          {disabled && (
            <p className="text-sm text-slate-500">
              Sign in before adding common expenses.
            </p>
          )}
          {saveError && (
            <p className="text-sm font-medium text-red-700">{saveError}</p>
          )}
          {deleteError && (
            <p className="text-sm font-medium text-red-700">{deleteError}</p>
          )}
        </form>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-950">
              Expense history
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              These entries are included in Accounts expense totals.
            </p>
          </div>
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">
            {inr.format(totalExpenses)}
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          {historyError && (
            <p className="p-4 text-sm font-medium text-red-700">
              {historyError}
            </p>
          )}
          {isHistoryLoading && (
            <p className="p-4 text-sm text-slate-500">
              Loading expense history.
            </p>
          )}
          {!isHistoryLoading && !historyError && expenses.length === 0 && (
            <EmptyState message="No common expenses found for the selected homestay." />
          )}
          {!isHistoryLoading && !historyError && expenses.map((expense) => {
            const homestay = homestays.find(
              (item) => item.id === expense.homestayId,
            );

            return (
              <div
                key={expense.id}
                className={`grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_110px_120px_170px] md:items-center ${
                  editingExpenseId === expense.id ? "bg-teal-50/60" : ""
                }`}
              >
                <div>
                  <p className="font-medium text-slate-950">
                    {expense.label}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {homestay?.name ?? "Homestay"} - {expense.category}
                  </p>
                </div>
                <span className="text-sm text-slate-500">
                  {formatDate(expense.date)}
                </span>
                <span className="text-right text-sm font-semibold text-red-700">
                  -{inr.format(expense.amount)}
                </span>
                <div className="flex flex-wrap justify-start gap-2 md:justify-end">
                  <button
                    type="button"
                    onClick={() => onEdit(expense)}
                    disabled={disabled || isSaving}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:text-slate-300"
                  >
                    <Pencil className="h-4 w-4" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(expense)}
                    disabled={
                      disabled ||
                      isSaving ||
                      deletingExpenseId === expense.id
                    }
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-red-100 bg-white px-3 text-sm font-semibold text-red-700 transition hover:border-red-200 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-red-300"
                  >
                    <Trash2 className="h-4 w-4" />
                    {deletingExpenseId === expense.id ? "Deleting" : "Delete"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex flex-col gap-3 border-t border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            {totalCount === 0
              ? "No expenses"
              : `Showing ${firstItem}-${lastItem} of ${totalCount}`}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onPageChange(Math.max(1, page - 1))}
              disabled={page <= 1 || isHistoryLoading}
              className="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:text-slate-300"
            >
              Previous
            </button>
            <span className="min-w-20 text-center text-sm font-semibold text-slate-700">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => onPageChange(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages || isHistoryLoading}
              className="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:text-slate-300"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function AccountsPanel({
  accounts,
  homestays,
  staffMembers,
  salaryPayments,
  totalRevenue,
  totalExpenses,
}: {
  accounts: AccountEntry[];
  homestays: Homestay[];
  staffMembers: StaffMember[];
  salaryPayments: DashboardData["staffSalaryPayments"];
  totalRevenue: number;
  totalExpenses: number;
}) {
  const transactions = [
    ...accounts.map((entry) => {
      const homestay = homestays.find(
        (item) => item.id === entry.homestayId,
      );

      return {
        id: `account-${entry.id}`,
        label: entry.label,
        detail: `${homestay?.name ?? "Unknown homestay"} - ${entry.category}`,
        date: entry.date,
        amount: entry.amount,
        type: entry.type,
      };
    }),
    ...salaryPayments.map((payment) => {
      const staff = staffMembers.find((item) => item.id === payment.staffId);

      return {
        id: `salary-${payment.id}`,
        label: `${staff?.name ?? "Staff member"} salary`,
        detail: formatSalaryPaymentBreakdown(payment),
        date: payment.paidOn,
        amount: payment.amount,
        type: "expense" as const,
      };
    }),
  ].sort((first, second) => second.date.localeCompare(first.date));

  return (
    <section className="grid min-w-0 gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-slate-950">
          Accounts module
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Track payouts, pending invoices, and property-level expenses.
        </p>

        <div className="mt-5 space-y-3">
          <AccountSummary
            label="Total revenue"
            value={totalRevenue}
            tone="income"
          />
          <AccountSummary
            label="Expenses"
            value={totalExpenses}
            tone="expense"
          />
          <AccountSummary
            label="Net position"
            value={totalRevenue - totalExpenses}
            tone="net"
          />
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4">
          <h3 className="text-base font-semibold text-slate-950">
            Recent transactions
          </h3>
        </div>
        <div className="divide-y divide-slate-100">
          {transactions.length === 0 && (
            <EmptyState message="No transactions matched the current filters." />
          )}
          {transactions.map((transaction) => (
            <div
              key={transaction.id}
              className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_150px_140px] md:items-center"
            >
              <div>
                <p className="font-medium text-slate-950">
                  {transaction.label}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {transaction.detail}
                </p>
              </div>
              <span className="text-sm text-slate-500">
                {formatDate(transaction.date)}
              </span>
              <span
                className={`text-right text-sm font-semibold ${transaction.type === "income" ? "text-teal-700" : "text-red-700"}`}
              >
                {transaction.type === "income" ? "+" : "-"}
                {inr.format(transaction.amount)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function AccountSummary({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "income" | "expense" | "net";
}) {
  const styles = {
    income: "bg-teal-50 text-teal-800",
    expense: "bg-red-50 text-red-800",
    net: "bg-slate-100 text-slate-950",
  };

  return (
    <div className={`rounded-md p-3 ${styles[tone]}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-75">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold tracking-normal">
        {inr.format(value)}
      </p>
    </div>
  );
}

function StatusPanel({
  title,
  message,
  tone = "info",
}: {
  title: string;
  message: string;
  tone?: "info" | "error";
}) {
  return (
    <section
      className={`rounded-lg border p-4 shadow-sm ${
        tone === "error"
          ? "border-red-200 bg-red-50 text-red-900"
          : "border-slate-200 bg-white text-slate-900"
      }`}
    >
      <h2 className="text-base font-semibold">{title}</h2>
      <p
        className={`mt-1 text-sm ${tone === "error" ? "text-red-700" : "text-slate-500"}`}
      >
        {message}
      </p>
    </section>
  );
}

function SidebarAuthCard({
  isConfigured,
  email,
  role,
  onSignOut,
}: {
  isConfigured: boolean;
  email: string;
  role: UserRole;
  onSignOut: () => void;
}) {
  return (
    <section className="mt-4 rounded-md border border-slate-800 bg-slate-900 p-4">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400">
        <ShieldCheck className="h-4 w-4" />
        Sign in
      </div>

      {email ? (
        <div className="mt-3 space-y-3">
          <div>
            <p className="truncate text-sm font-semibold text-white">{email}</p>
            <p className="mt-1 text-xs text-slate-400">{role}</p>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-slate-700 px-3 text-sm font-semibold text-slate-200 transition hover:border-slate-500"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <p className="text-xs leading-5 text-slate-400">
            {isConfigured
              ? "Use Admin or Manager access."
              : "Configure Supabase before signing in."}
          </p>
          <Link
            href="/sign-in"
            className="inline-flex h-9 w-full items-center justify-center rounded-md bg-teal-400 px-3 text-sm font-semibold text-slate-950 transition hover:bg-teal-300"
          >
            Open sign-in page
          </Link>
        </div>
      )}
    </section>
  );
}

function EmptyState({ message }: { message: string }) {
  return <p className="p-4 text-sm text-slate-500">{message}</p>;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md bg-slate-50 p-3">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 truncate text-sm font-semibold text-slate-950">
        {value}
      </dd>
    </div>
  );
}

function formatDate(value: string) {
  if (!value) {
    return "No date";
  }

  return dateFormatter.format(new Date(`${value}T00:00:00`));
}

function formatDateRangeLabel(from: string, to: string) {
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

function formatSalaryPaymentBreakdown(payment: StaffSalaryPayment) {
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

function salaryMonthDate(month: string) {
  return month ? `${month}-01` : `${todayMonth()}-01`;
}

function applyStaffPaymentMethod(
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

function isDateInRange(value: string, from: string, to: string) {
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

function doesStayOverlapRange(
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

function todayIso() {
  return toLocalIsoDate(new Date());
}

function todayMonth() {
  return todayIso().slice(0, 7);
}

function startOfMonthIso(date: Date) {
  return toLocalIsoDate(new Date(date.getFullYear(), date.getMonth(), 1));
}

function endOfMonthIso(date: Date) {
  return toLocalIsoDate(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

function addDaysIso(date: Date, days: number) {
  const nextDate = new Date(date);

  nextDate.setDate(nextDate.getDate() + days);

  return toLocalIsoDate(nextDate);
}

function shiftMonth(month: string, amount: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  const nextDate = new Date(year, monthNumber - 1 + amount, 1);

  return toLocalIsoDate(nextDate).slice(0, 7);
}

function formatMonthLabel(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);

  return new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, monthNumber - 1, 1));
}

function buildCalendarDays(month: string) {
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

function toLocalIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function isBookingOnCalendarDay(booking: Booking, day: string) {
  const checkOutDisplayDay =
    booking.checkOut > booking.checkIn
      ? addDaysIso(new Date(`${booking.checkOut}T00:00:00`), -1)
      : booking.checkOut;

  return booking.checkIn <= day && checkOutDisplayDay >= day;
}

function resolveUserRole(role: unknown): UserRole {
  return role === "Manager" ? "Manager" : "Admin";
}

function readStoredRole(): UserRole | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const role = window.localStorage.getItem(roleStorageKey);

  return role === "Admin" || role === "Manager" ? role : undefined;
}

function forgetStoredRole() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(roleStorageKey);
}

function getBookingEntries(entries: AccountEntry[], bookingId: string) {
  return entries.filter((entry) => entry.bookingId === bookingId);
}

function getEntryNet(entries: AccountEntry[]) {
  return entries.reduce((total, entry) => {
    return total + (entry.type === "income" ? entry.amount : -entry.amount);
  }, 0);
}

function defaultBookingEntryLabel(category: string) {
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

function defaultCommonExpenseLabel(category: string) {
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

function ensureBookingFormDefaults(
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

function ensureBookingEntryFormDefaults(
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

function ensureCommonExpenseFormDefaults(
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

function createBlankRoomForm(defaultRate = 0): HomestayRoomForm {
  return {
    name: "",
    capacity: 2,
    nightlyRate: defaultRate,
  };
}

function createBlankStaffForm(): StaffForm {
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

function normalizeHomestayRoomForms(
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
