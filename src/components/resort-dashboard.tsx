"use client";

import Link from "next/link";
import {
  Building2,
  CalendarDays,
  CalendarCheck,
  ChevronDown,
  Home,
  IdCard,
  Menu,
  Plus,
  ReceiptText,
  Search,
  UsersRound,
  WalletCards,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Brand } from "@/components/brand";
import {
  canAccessModule,
  resolveDataOwnerId,
  resolveUserRole,
  type UserRole,
} from "@/lib/authorization";
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
  DashboardData,
  Homestay,
  ModuleKey,
  NavItem,
  StaffMember,
  StaffSalaryPayment,
} from "@/lib/types";

import { AccountsPanel } from "./dashboard/accounts";
import {
  BookingTable,
  QuickBookingForm,
  BookingEditFormPanel,
  BookingEntryFormPanel,
} from "./dashboard/bookings";
import { BookingsCalendarView } from "./dashboard/calendar";
import {
  QuickCustomerModal,
  CustomerCreateForm,
  CustomerEditFormPanel,
  CustomerTable,
} from "./dashboard/customers";
import {
  DeleteExpenseConfirm,
  CommonExpensesPanel,
} from "./dashboard/expenses";
import {
  HomestayCreateForm,
  HomestayEditFormPanel,
  HomestayGrid,
} from "./dashboard/homestays";
import { MetricGrid, OverviewFocus } from "./dashboard/overview";
import {
  StaffPanel,
  StaffEditFormPanel,
  StaffSalaryPaymentPanel,
} from "./dashboard/payroll";
import {
  inr,
  expenseHistoryPageSize,
  type BookingForm,
  type BookingEditForm,
  type HomestayForm,
  type HomestayEditForm,
  type CustomerForm,
  type CustomerEditForm,
  type StaffForm,
  type StaffEditForm,
  type StaffSalaryPaymentForm,
  type BookingEntryForm,
  type CommonExpenseForm,
} from "./dashboard/shared";
import {
  DateFilterBar,
  DashboardModal,
  StatusPanel,
  SidebarAuthCard,
} from "./dashboard/ui";
import {
  salaryMonthDate,
  isDateInRange,
  doesStayOverlapRange,
  todayIso,
  todayMonth,
  startOfMonthIso,
  endOfMonthIso,
  addDaysIso,
  getBookingEntries,
  defaultBookingEntryLabel,
  defaultCommonExpenseLabel,
  ensureBookingFormDefaults,
  ensureBookingEntryFormDefaults,
  ensureCommonExpenseFormDefaults,
  createBlankRoomForm,
  createBlankStaffForm,
  normalizeHomestayRoomForms,
} from "./dashboard/utils";

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
  const [activeRole, setActiveRole] = useState<UserRole>("Manager");
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
  const visibleNavItems = navItems.filter((item) =>
    canAccessModule(activeRole, item.key),
  );

  useEffect(() => {
    if (!supabase) {
      return;
    }

    supabase.auth.getSession().then(({ data: sessionData }) => {
      setSessionEmail(sessionData.session?.user.email ?? "");
      setUserId(
        resolveDataOwnerId(
          sessionData.session?.user.id,
          sessionData.session?.user.app_metadata?.owner_id,
        ),
      );
      setActiveRole(
        resolveUserRole(sessionData.session?.user.app_metadata?.role),
      );
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionEmail(session?.user.email ?? "");
      setUserId(
        resolveDataOwnerId(
          session?.user.id,
          session?.user.app_metadata?.owner_id,
        ),
      );
      setActiveRole(
        resolveUserRole(session?.user.app_metadata?.role),
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
    setData(emptyDashboardData);
    window.location.assign("/sign-in");
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
    <div className="dashboard-shell min-h-screen bg-white text-slate-950">
      <div className="flex min-h-screen">
        {isMobileNavOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              aria-label="Close navigation"
              className="absolute inset-0 bg-slate-950/50"
              onClick={() => setIsMobileNavOpen(false)}
            />
            <aside className="dashboard-sidebar relative flex h-full w-80 max-w-[86vw] flex-col overflow-y-auto overscroll-contain bg-slate-950 px-4 py-5 text-white shadow-2xl">
              <div className="mb-6 flex items-center justify-between gap-3 px-2">
                <Brand light />
                <button
                  type="button"
                  aria-label="Close navigation"
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-white/10 text-slate-300 transition hover:bg-white/10 hover:text-white"
                  onClick={() => setIsMobileNavOpen(false)}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <p className="nav-caption">YOUR WORKSPACE</p>
              <nav className="dashboard-nav space-y-1" aria-label="Main navigation">
                {visibleNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeModule === item.key;

                  return (
                    <Link
                      key={item.key}
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
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

              {activeRole === "Admin" && (
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
              )}

              <SidebarAuthCard
                isConfigured={isSupabaseConfigured}
                email={sessionEmail}
                role={activeRole}
                onSignOut={signOut}
              />
            </aside>
          </div>
        )}

        <aside className="dashboard-sidebar fixed inset-y-0 left-0 z-30 hidden h-dvh w-72 overflow-y-auto overscroll-contain border-r border-slate-200 bg-slate-950 px-4 py-5 text-white lg:block">
          <Brand light />
          <p className="nav-caption">YOUR WORKSPACE</p>
          <nav className="dashboard-nav space-y-1" aria-label="Main navigation">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeModule === item.key;

              return (
                <Link
                  key={item.key}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
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

          <div className="sidebar-note"><p>A place for every stay.</p><span>A little order. A lot more possibility.</span></div>
          <SidebarAuthCard
            isConfigured={isSupabaseConfigured}
            email={sessionEmail}
            role={activeRole}
            onSignOut={signOut}
          />
        </aside>

        <main className="flex min-w-0 flex-1 flex-col bg-slate-50 lg:ml-72">
          <header className="dashboard-header sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur md:px-6">
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
                  StayLedger / Workspace
                </p>
                <h1 className="dashboard-heading truncate text-2xl text-slate-950">
                  {navItems.find((item) => item.key === activeModule)?.label}
                </h1>
              </div>
            </div>

            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="hidden lg:block">
                <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
                  StayLedger / Workspace
                </p>
                <h1 className="dashboard-heading mt-2 text-3xl text-slate-950 md:text-4xl">
                  {navItems.find((item) => item.key === activeModule)?.label}
                </h1>
              </div>

              <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-end">
                <label className="relative min-w-0 lg:w-64">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    aria-label="Search bookings or guests"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                    placeholder="Search bookings or guests"
                  />
                </label>

                <label className="relative">
                  <select
                    aria-label="Filter by homestay"
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

                {activeRole === "Admin" && (
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
                )}

                <div className="hidden items-center gap-3 lg:flex lg:flex-wrap lg:justify-end">
                  {activeRole === "Admin" && (
                    <>
                      <button
                        type="button"
                        onClick={openQuickBookingModal}
                        className="inline-flex h-10 min-w-36 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800"
                      >
                        <Plus className="h-4 w-4" />
                        New booking
                      </button>
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
                    </>
                  )}

                </div>
              </div>
            </div>
          </header>

          <div className="dashboard-content min-w-0 space-y-5 p-4 md:p-6">
            {activeModule === "overview" && (
              <section className="dashboard-intro">
                <div><span className="eyebrow">THE BIG PICTURE</span><h2>A little order. A better day.</h2><p>Your stays, your guests, and your business — all feeling a little more at home.</p></div>
                <Building2 aria-hidden="true" />
              </section>
            )}
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
