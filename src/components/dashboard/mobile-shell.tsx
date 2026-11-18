"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  CalendarCheck,
  ChevronRight,
  LayoutGrid,
  LogOut,
  Plus,
  ReceiptText,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { roleLabels, type UserRole } from "@/lib/authorization";
import type { ModuleKey, NavItem } from "@/lib/types";
import { BottomSheet } from "@/components/ui/bottom-sheet";

/** Modules that earn a permanent spot in the phone tab bar, in thumb-priority order. */
const primaryTabOrder: ModuleKey[] = ["overview", "bookings", "calendar", "customers"];
const maxPrimaryTabs = 4;

export function splitMobileNav(items: NavItem[]) {
  const ordered = [
    ...primaryTabOrder
      .map((key) => items.find((item) => item.key === key))
      .filter((item): item is NavItem => Boolean(item)),
    ...items.filter((item) => !primaryTabOrder.includes(item.key)),
  ];

  return {
    primary: ordered.slice(0, maxPrimaryTabs),
    overflow: ordered.slice(maxPrimaryTabs),
  };
}

/**
 * Sheets keep a history entry so the phone back button closes them. Wait for that entry to be
 * popped before navigating, otherwise the pop would undo the navigation.
 */
export function afterSheetCloses(action: () => void) {
  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    window.removeEventListener("popstate", run);
    window.setTimeout(action, 0);
  };
  window.addEventListener("popstate", run);
  window.setTimeout(run, 380);
}

export function MobileTabBar({
  items,
  activeModule,
  isMoreActive,
  onNavigate,
  onMoreClick,
}: {
  items: NavItem[];
  activeModule: ModuleKey;
  isMoreActive: boolean;
  onNavigate: (key: ModuleKey) => void;
  onMoreClick: () => void;
}) {
  const { primary } = splitMobileNav(items);

  return (
    <nav
      aria-label="Primary"
      className="mobile-tabbar fixed inset-x-0 bottom-0 z-40 lg:hidden"
    >
      <div
        className="mx-auto grid max-w-xl"
        style={{ gridTemplateColumns: `repeat(${primary.length + 1}, minmax(0, 1fr))` }}
      >
        {primary.map((item) => {
          const Icon = item.icon;
          const isActive = activeModule === item.key;

          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              onClick={() => onNavigate(item.key)}
              className="mobile-tab"
            >
              <span className="mobile-tab-icon">
                <Icon aria-hidden="true" />
              </span>
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={onMoreClick}
          data-active={isMoreActive ? "true" : undefined}
          aria-haspopup="dialog"
          className="mobile-tab"
        >
          <span className="mobile-tab-icon">
            <LayoutGrid aria-hidden="true" />
          </span>
          <span>More</span>
        </button>
      </div>
    </nav>
  );
}

export function MobileMoreSheet({
  open,
  items,
  activeModule,
  email,
  role,
  isConfigured,
  onClose,
  onNavigate,
  onSignOut,
}: {
  open: boolean;
  items: NavItem[];
  activeModule: ModuleKey;
  email: string;
  role: UserRole;
  isConfigured: boolean;
  onClose: () => void;
  onNavigate: (key: ModuleKey) => void;
  onSignOut: () => void;
}) {
  const router = useRouter();
  const { overflow } = splitMobileNav(items);

  return (
    <BottomSheet open={open} onClose={onClose} title="More" testId="mobile-more">
      {overflow.length > 0 && (
        <>
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Your workspace
          </p>
          <div className="grid grid-cols-2 gap-3">
            {overflow.map((item) => {
              const Icon = item.icon;
              const isActive = activeModule === item.key;

              return (
                <Link
                  key={item.key}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  onClick={(event) => {
                    event.preventDefault();
                    onNavigate(item.key);
                    onClose();
                    afterSheetCloses(() => router.push(item.href));
                  }}
                  className={`flex min-h-[88px] flex-col justify-between rounded-2xl border p-4 transition active:scale-[0.98] ${
                    isActive
                      ? "border-teal-300 bg-teal-50 text-slate-950"
                      : "border-slate-200 bg-slate-50 text-slate-900 hover:border-slate-300"
                  }`}
                >
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-teal-700 shadow-sm">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="mt-3 text-[15px] font-semibold">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </>
      )}

      <section className={`${overflow.length > 0 ? "mt-6" : ""} rounded-2xl bg-slate-950 p-4 text-white`}>
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          Your account
        </div>
        {email ? (
          <>
            <p className="mt-3 truncate text-[15px] font-semibold">{email}</p>
            <p className="mt-0.5 text-sm text-slate-300">{roleLabels[role]}</p>
            <button
              type="button"
              onClick={() => {
                onClose();
                afterSheetCloses(onSignOut);
              }}
              className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/15 text-[15px] font-semibold text-white transition hover:bg-white/10"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Sign out
            </button>
          </>
        ) : (
          <>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              {isConfigured
                ? "Use Admin or Manager access."
                : "Configure Supabase before signing in."}
            </p>
            <Link
              href="/sign-in"
              onClick={(event) => {
                event.preventDefault();
                onClose();
                afterSheetCloses(() => router.push("/sign-in"));
              }}
              className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-xl bg-teal-400 text-[15px] font-semibold text-slate-950"
            >
              Open sign-in page
            </Link>
          </>
        )}
      </section>
      <p className="mt-5 text-center font-[family-name:var(--font-editorial)] text-base italic text-slate-500">
        A place for every stay.
      </p>
    </BottomSheet>
  );
}

export function MobileQuickAddSheet({
  open,
  onClose,
  onNewBooking,
  onBookingEntry,
  onAddHomestay,
  onAddCustomer,
}: {
  open: boolean;
  onClose: () => void;
  /** Omit a handler to hide that action for the current role. */
  onNewBooking?: () => void;
  onBookingEntry?: () => void;
  onAddHomestay?: () => void;
  onAddCustomer?: () => void;
}) {
  const allActions = [
    {
      label: "New booking",
      description: "Walk-in, phone or direct enquiry",
      icon: CalendarCheck,
      onSelect: onNewBooking,
      primary: true,
    },
    {
      label: "Income / expense",
      description: "Extras, refunds or costs on a booking",
      icon: ReceiptText,
      onSelect: onBookingEntry,
    },
    {
      label: "Add homestay",
      description: "A new property with its rooms",
      icon: Building2,
      onSelect: onAddHomestay,
    },
    {
      label: "Add customer",
      description: "Save a guest's contact details",
      icon: UsersRound,
      onSelect: onAddCustomer,
    },
  ];
  const actions = allActions.flatMap((action) =>
    action.onSelect ? [{ ...action, onSelect: action.onSelect }] : [],
  );

  return (
    <BottomSheet open={open} onClose={onClose} title="Quick add" testId="mobile-quick-add">
      <ul className="space-y-2">
        {actions.map((action) => {
          const Icon = action.icon;

          return (
            <li key={action.label}>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  afterSheetCloses(action.onSelect);
                }}
                className={`flex min-h-16 w-full items-center gap-4 rounded-2xl border px-4 py-3 text-left transition active:scale-[0.99] ${
                  action.primary
                    ? "border-teal-700 bg-teal-700 text-white"
                    : "border-slate-200 bg-white text-slate-900 hover:border-slate-300"
                }`}
              >
                <span
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
                    action.primary ? "bg-white/15" : "bg-teal-50 text-teal-700"
                  }`}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold">{action.label}</span>
                  <span
                    className={`mt-0.5 block truncate text-sm ${
                      action.primary ? "text-teal-50/90" : "text-slate-500"
                    }`}
                  >
                    {action.description}
                  </span>
                </span>
                <ChevronRight
                  className={`h-5 w-5 shrink-0 ${action.primary ? "text-white/80" : "text-slate-400"}`}
                  aria-hidden="true"
                />
              </button>
            </li>
          );
        })}
      </ul>
    </BottomSheet>
  );
}

export function MobileFab({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Quick add"
      aria-haspopup="dialog"
      className="mobile-fab fixed right-4 z-30 grid h-14 w-14 place-items-center rounded-2xl bg-teal-700 text-white transition hover:bg-teal-800 active:scale-95 lg:hidden"
    >
      <Plus className="h-6 w-6" aria-hidden="true" />
    </button>
  );
}
