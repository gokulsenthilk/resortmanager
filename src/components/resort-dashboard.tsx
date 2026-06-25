"use client";

import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  BedDouble,
  Bell,
  Building2,
  CalendarCheck,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Filter,
  Home,
  LogOut,
  MapPin,
  Menu,
  Plus,
  ReceiptText,
  Search,
  ShieldCheck,
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
  fetchDashboardData,
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
  {
    key: "bookings",
    label: "Bookings",
    href: "/bookings",
    icon: CalendarCheck,
  },
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

type HomestayForm = {
  name: string;
  location: string;
  managerName: string;
  units: number;
  nightlyRate: number;
  roomName: string;
};

type CustomerForm = {
  fullName: string;
  phone: string;
  email: string;
  city: string;
  preferences: string;
};

type BookingEntryForm = {
  bookingId: string;
  type: "income" | "expense";
  category: string;
  label: string;
  amount: number;
  isCleared: boolean;
};

type UserRole = "Admin" | "Manager";

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

const emptyDashboardData: DashboardData = {
  homestays: [],
  rooms: [],
  customers: [],
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
  const [data, setData] = useState<DashboardData>(emptyDashboardData);
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
  const [showHomestayForm, setShowHomestayForm] = useState(false);
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [showQuickCustomerModal, setShowQuickCustomerModal] = useState(false);
  const [homestaySaveError, setHomestaySaveError] = useState("");
  const [customerSaveError, setCustomerSaveError] = useState("");
  const [bookingEntrySaveError, setBookingEntrySaveError] = useState("");
  const [isHomestaySaving, setIsHomestaySaving] = useState(false);
  const [isCustomerSaving, setIsCustomerSaving] = useState(false);
  const [isBookingEntrySaving, setIsBookingEntrySaving] = useState(false);
  const [homestayForm, setHomestayForm] = useState<HomestayForm>({
    name: "",
    location: "",
    managerName: "",
    units: 1,
    nightlyRate: 0,
    roomName: "",
  });
  const [customerForm, setCustomerForm] = useState<CustomerForm>({
    fullName: "",
    phone: "",
    email: "",
    city: "",
    preferences: "",
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
  const [bookingEntryForm, setBookingEntryForm] = useState<BookingEntryForm>({
    bookingId: "",
    type: "income",
    category: "Decoration",
    label: "Decoration package",
    amount: 0,
    isCleared: false,
  });
  const {
    homestays,
    rooms,
    customers,
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
        resolveUserRole(sessionData.session?.user.user_metadata?.role),
      );
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionEmail(session?.user.email ?? "");
      setUserId(session?.user.id ?? "");
      setActiveRole(resolveUserRole(session?.user.user_metadata?.role));
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

  const formRooms = useMemo(() => {
    return rooms.filter((room) => room.homestayId === bookingForm.homestayId);
  }, [bookingForm.homestayId, rooms]);

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
      received,
      pending,
      occupancy: totalUnits > 0 ? Math.round((occupied / totalUnits) * 100) : 0,
    };
  }, [accountEntries, homestays, selectedHomestayId, visibleBookings]);

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

  async function addHomestay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!userId) {
      setHomestaySaveError("Sign in before adding a homestay.");
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
        units: homestayForm.units,
        nightlyRate: homestayForm.nightlyRate,
        roomName: homestayForm.roomName,
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
        roomName: "",
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

  async function signOut() {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
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
            <aside className="relative flex h-full w-80 max-w-[86vw] flex-col bg-slate-950 px-4 py-5 text-white shadow-2xl">
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

        <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-slate-950 px-4 py-5 text-white lg:block">
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

        <main className="flex min-w-0 flex-1 flex-col bg-slate-50">
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

              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
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
                      setSelectedHomestayId(event.target.value)
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

                <div className="hidden items-center gap-3 lg:flex">
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
              accounts={visibleAccounts}
            />

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

            {activeModule === "homestays" && (
              <HomestayGrid
                selectedHomestayId={selectedHomestayId}
                homestays={homestays}
                bookings={bookingList}
              />
            )}

            {activeModule === "customers" && (
              <CustomerTable query={query} customers={customers} />
            )}

            {activeModule === "accounts" && (
              <AccountsPanel accounts={visibleAccounts} homestays={homestays} />
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
    </div>
  );
}

function MetricGrid({
  metrics,
  bookings: visibleBookings,
  accounts,
}: {
  metrics: {
    bookedRevenue: number;
    totalRevenue: number;
    bookingExtraIncome: number;
    bookingExtraExpense: number;
    received: number;
    pending: number;
    occupancy: number;
  };
  bookings: Booking[];
  accounts: AccountEntry[];
}) {
  const expenses = accounts
    .filter((entry) => entry.type === "expense")
    .reduce((total, entry) => total + entry.amount, 0);

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
        value={inr.format(expenses)}
        detail="Housekeeping and repairs"
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
  onDateFromChange,
  onDateToChange,
  onClear,
}: {
  dateFrom: string;
  dateTo: string;
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
          <p className="mt-1 text-sm text-slate-500">
            Filters bookings by stay dates and accounts by entry date.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-[170px_170px_auto]">
          <Field label="From">
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => onDateFromChange(event.target.value)}
              className="field-control"
            />
          </Field>
          <Field label="To">
            <input
              type="date"
              value={dateTo}
              onChange={(event) => onDateToChange(event.target.value)}
              className="field-control"
            />
          </Field>
          <button
            type="button"
            onClick={onClear}
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

function BookingTable({
  bookings: visibleBookings,
  customers,
  homestays,
  accountEntries,
}: {
  bookings: Booking[];
  customers: DashboardData["customers"];
  homestays: Homestay[];
  accountEntries: AccountEntry[];
}) {
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
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700 transition hover:border-slate-300"
        >
          <Filter className="h-4 w-4" />
          Filter
        </button>
      </div>

      {visibleBookings.length === 0 && (
        <EmptyState message="No bookings matched the current homestay and search filters." />
      )}

      <div className="divide-y divide-slate-100 md:hidden">
        {visibleBookings.map((booking) => {
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
                  <p className="font-semibold text-slate-950">{booking.id}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {customer?.name}
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
                  {booking.channel} - {booking.guests} guests
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
            </article>
          );
        })}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Booking</th>
              <th className="px-4 py-3 font-semibold">Guest</th>
              <th className="px-4 py-3 font-semibold">Stay</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibleBookings.map((booking) => {
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
                    <p className="font-semibold text-slate-950">{booking.id}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {booking.channel}
                    </p>
                  </td>
                  <td className="px-4 py-4">
                    <p className="font-medium text-slate-900">
                      {customer?.name}
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
            Create a property and an optional first active room.
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
        <Field label="Units">
          <input
            type="number"
            min="1"
            value={form.units}
            onChange={(event) =>
              onChange({ ...form, units: Number(event.target.value) })
            }
            className="field-control"
            required
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
        <Field label="First room">
          <input
            value={form.roomName}
            onChange={(event) =>
              onChange({ ...form, roomName: event.target.value })
            }
            className="field-control"
            disabled={disabled}
          />
        </Field>
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

function HomestayGrid({
  selectedHomestayId,
  homestays,
  bookings,
}: {
  selectedHomestayId: string;
  homestays: Homestay[];
  bookings: Booking[];
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
          bookings={bookings}
        />
      ))}
    </section>
  );
}

function HomestayCard({
  homestay,
  bookings,
}: {
  homestay: Homestay;
  bookings: Booking[];
}) {
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
        <span
          className={`rounded-md border px-2 py-1 text-xs font-semibold ${
            homestay.status === "active"
              ? "border-teal-200 bg-teal-50 text-teal-700"
              : "border-amber-200 bg-amber-50 text-amber-700"
          }`}
        >
          {homestay.status}
        </span>
      </div>

      <dl className="mt-5 grid grid-cols-3 gap-3">
        <Stat label="Units" value={String(homestay.units)} />
        <Stat label="Rate" value={inr.format(homestay.nightlyRate)} />
        <Stat label="Revenue" value={inr.format(revenue)} />
      </dl>

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
}: {
  query: string;
  customers: DashboardData["customers"];
}) {
  const visibleCustomers = customers.filter((customer) =>
    `${customer.name} ${customer.phone} ${customer.email} ${customer.city}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );

  return (
    <section className="min-w-0 rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-4">
        <h2 className="text-base font-semibold text-slate-950">
          Customer module
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Guest profiles, stay history, contact details, and preferences.
        </p>
      </div>

      <div className="grid divide-y divide-slate-100">
        {visibleCustomers.length === 0 && (
          <EmptyState message="No customers matched the current search." />
        )}
        {visibleCustomers.map((customer) => (
          <div
            key={customer.id}
            className="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_140px_180px] md:items-center"
          >
            <div>
              <p className="font-semibold text-slate-950">{customer.name}</p>
              <p className="mt-1 text-sm text-slate-500">
                {customer.phone} - {customer.email}
              </p>
              <p className="mt-2 text-xs font-medium text-slate-500">
                {customer.preference}
              </p>
            </div>
            <Stat label="Stays" value={String(customer.stays)} />
            <Stat
              label="Lifetime value"
              value={inr.format(customer.lifetimeValue)}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

function AccountsPanel({
  accounts,
  homestays,
}: {
  accounts: AccountEntry[];
  homestays: Homestay[];
}) {
  const income = accounts
    .filter((entry) => entry.type === "income")
    .reduce((total, entry) => total + entry.amount, 0);
  const expense = accounts
    .filter((entry) => entry.type === "expense")
    .reduce((total, entry) => total + entry.amount, 0);

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
          <AccountSummary label="Income" value={income} tone="income" />
          <AccountSummary label="Expenses" value={expense} tone="expense" />
          <AccountSummary
            label="Net position"
            value={income - expense}
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
          {accounts.length === 0 && (
            <EmptyState message="No account entries matched the current homestay filter." />
          )}
          {accounts.map((entry) => {
            const homestay = homestays.find(
              (item) => item.id === entry.homestayId,
            );

            return (
              <div
                key={entry.id}
                className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_150px_140px] md:items-center"
              >
                <div>
                  <p className="font-medium text-slate-950">{entry.label}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {homestay?.name} - {entry.category}
                  </p>
                </div>
                <span className="text-sm text-slate-500">
                  {formatDate(entry.date)}
                </span>
                <span
                  className={`text-right text-sm font-semibold ${entry.type === "income" ? "text-teal-700" : "text-red-700"}`}
                >
                  {entry.type === "income" ? "+" : "-"}
                  {inr.format(entry.amount)}
                </span>
              </div>
            );
          })}
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
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(date: Date, days: number) {
  const nextDate = new Date(date);

  nextDate.setDate(nextDate.getDate() + days);

  return nextDate.toISOString().slice(0, 10);
}

function resolveUserRole(role: unknown): UserRole {
  return role === "Manager" ? "Manager" : "Admin";
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
