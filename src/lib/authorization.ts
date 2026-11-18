import type { ModuleKey } from "./types";

/**
 * Roles from the Homely Holidays CRM spec (section 5, "Role-Based Access").
 * The database (public.team_members + RLS) is the source of truth; this file mirrors
 * public.has_capability() so the UI only offers what the database will allow.
 */
export type UserRole = "Admin" | "OfficeExecutive" | "PropertyManager" | "Caretaker";

export type DatabaseRole =
  | "admin"
  | "office_executive"
  | "property_manager"
  | "caretaker";

export type Capability =
  | "properties.all"
  | "properties.manage"
  | "bookings.view"
  | "bookings.manage"
  | "bookings.delete"
  | "bookings.pricing"
  | "guests.view"
  | "guests.manage"
  | "revenue.view"
  | "expenses.enter"
  | "expenses.manage"
  | "staff.view_team"
  | "staff.manage"
  | "staff.salary"
  | "financials.full"
  | "financials.limited"
  | "settings.manage"
  | "housekeeping.view"
  | "maintenance.view";

export type AccessProfile = {
  role: UserRole | null;
  /** "database": loaded from get_my_access(). "legacy": roles migration not applied yet. */
  source: "database" | "legacy";
  ownerId: string;
  displayName: string;
  /** True when the user sees every property of the workspace (Admin, Office Executive). */
  allProperties: boolean;
  homestayIds: string[];
  canViewPricing: boolean;
  canEnterExpenses: boolean;
};

export const roleLabels: Record<UserRole, string> = {
  Admin: "Admin",
  OfficeExecutive: "Office Executive",
  PropertyManager: "Property Manager",
  Caretaker: "Caretaker",
};

export const roleDescriptions: Record<UserRole, string> = {
  Admin: "Everything, including team access and payroll.",
  OfficeExecutive: "All properties, bookings, guests and revenue. No payroll or team settings.",
  PropertyManager: "Assigned properties: bookings, guests, expenses and their team.",
  Caretaker: "Assigned properties: view stays and guest contact. Expenses if allowed.",
};

export const databaseRoleToUserRole: Record<DatabaseRole, UserRole> = {
  admin: "Admin",
  office_executive: "OfficeExecutive",
  property_manager: "PropertyManager",
  caretaker: "Caretaker",
};

export const userRoleToDatabaseRole: Record<UserRole, DatabaseRole> = {
  Admin: "admin",
  OfficeExecutive: "office_executive",
  PropertyManager: "property_manager",
  Caretaker: "caretaker",
};

const pathnameModules: Record<string, ModuleKey> = {
  "/": "overview",
  "/homestays": "homestays",
  "/customers": "customers",
  "/staff": "staff",
  "/bookings": "bookings",
  "/calendar": "calendar",
  "/expenses": "expenses",
  "/accounts": "accounts",
  "/team": "team",
};

/** Maps a JWT app_metadata.role (or team role) to a UserRole. Legacy "manager" -> Property Manager. */
export function resolveUserRole(role: unknown): UserRole {
  const value = typeof role === "string" ? role.trim().toLowerCase() : "";

  if (value === "admin") return "Admin";
  if (value === "office_executive" || value === "office executive") return "OfficeExecutive";
  if (value === "caretaker") return "Caretaker";

  return "PropertyManager";
}

export function resolveDataOwnerId(
  userId: string | undefined,
  configuredOwnerId: unknown,
): string {
  if (
    typeof configuredOwnerId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      configuredOwnerId,
    )
  ) {
    return configuredOwnerId;
  }

  return userId ?? "";
}

/** Capability map. Keep in sync with public.has_capability() in the roles migration. */
export function hasCapability(access: AccessProfile, capability: Capability): boolean {
  const role = access.role;

  if (!role) return false;

  // Before the roles migration is applied the database still enforces the old two-role model,
  // so non-admin users keep their previous calendar-only experience.
  if (access.source === "legacy" && role !== "Admin") {
    return capability === "bookings.view";
  }

  const isAdmin = role === "Admin";
  const isOffice = isAdmin || role === "OfficeExecutive";
  const isManager = role === "PropertyManager";
  const isCaretaker = role === "Caretaker";

  switch (capability) {
    case "properties.all":
    case "properties.manage":
    case "bookings.delete":
    case "revenue.view":
    case "staff.manage":
    case "financials.limited":
      return isOffice;
    case "bookings.manage":
    case "guests.view":
    case "guests.manage":
    case "expenses.manage":
    case "staff.view_team":
      return isOffice || isManager;
    case "bookings.pricing":
      return isOffice || (isManager && access.canViewPricing);
    case "expenses.enter":
      return isOffice || isManager || (isCaretaker && access.canEnterExpenses);
    case "staff.salary":
    case "financials.full":
    case "settings.manage":
      return isAdmin;
    case "bookings.view":
    case "housekeeping.view":
    case "maintenance.view":
      return true;
    default:
      return false;
  }
}

const moduleCapability: Record<ModuleKey, Capability> = {
  // The overview is an office / manager dashboard; caretakers start on the calendar.
  overview: "guests.view",
  homestays: "bookings.view",
  customers: "guests.view",
  staff: "staff.view_team",
  bookings: "bookings.view",
  calendar: "bookings.view",
  expenses: "expenses.enter",
  accounts: "revenue.view",
  team: "settings.manage",
};

export function canAccessModule(access: AccessProfile, module: ModuleKey): boolean {
  if (!access.role) return false;

  if (access.source === "legacy" && access.role !== "Admin") {
    return module === "calendar";
  }

  return hasCapability(access, moduleCapability[module]);
}

export function defaultRouteForAccess(access: AccessProfile): string {
  if (canAccessModule(access, "overview")) return "/";
  return "/calendar";
}

/** Best guess from the JWT alone (used right after sign-in, before the server loads access). */
export function defaultRouteForRole(role: UserRole): string {
  return role === "Admin" || role === "OfficeExecutive" ? "/" : "/calendar";
}

export function moduleForPathname(pathname: string): ModuleKey | undefined {
  return pathnameModules[pathname];
}

/** Access derived from JWT claims only (roles migration not applied, or RPC unavailable). */
export function legacyAccessFromClaims(
  userId: string | undefined,
  appMetadata: Record<string, unknown> | undefined,
): AccessProfile {
  const role = resolveUserRole(appMetadata?.role);

  return {
    role,
    source: "legacy",
    ownerId: resolveDataOwnerId(userId, appMetadata?.owner_id),
    displayName: "",
    allProperties: true,
    homestayIds: [],
    canViewPricing: role === "Admin",
    canEnterExpenses: role === "Admin",
  };
}

type AccessRpcResult = {
  role: DatabaseRole | null;
  owner_id: string | null;
  display_name: string | null;
  all_properties: boolean;
  homestay_ids: string[] | null;
  can_view_pricing: boolean;
  can_enter_expenses: boolean;
};

export function accessFromRpc(result: AccessRpcResult, fallbackOwnerId: string): AccessProfile {
  return {
    role: result.role ? databaseRoleToUserRole[result.role] ?? null : null,
    source: "database",
    ownerId: result.owner_id ?? fallbackOwnerId,
    displayName: result.display_name ?? "",
    allProperties: Boolean(result.all_properties),
    homestayIds: result.homestay_ids ?? [],
    canViewPricing: Boolean(result.can_view_pricing),
    canEnterExpenses: Boolean(result.can_enter_expenses),
  };
}

/** PostgREST / Postgres error codes meaning "the RPC does not exist" (migration not applied). */
export function isMissingFunctionError(error: { code?: string } | null | undefined): boolean {
  return error?.code === "PGRST202" || error?.code === "42883";
}
