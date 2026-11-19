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
  | "kitchen.manage"
  | "housekeeping.view"
  | "maintenance.view";

export type OrganisationSummary = {
  id: string;
  name: string;
  slug: string;
  status: "active" | "suspended";
  /** Welcomely guest-experience add-on (entitlement only; no features yet). */
  welcomelyEnabled: boolean;
};

/** Why a signed-in user has no role: not in any organisation, paused, or organisation suspended. */
export type NoAccessReason = "no_membership" | "paused" | "suspended" | "unavailable";

export type AccessProfile = {
  role: UserRole | null;
  /**
   * "database": loaded from get_my_access(). "unavailable": access could not be loaded, so the
   * user gets no role at all (fails closed; there is no JWT fallback any more).
   */
  source: "database" | "unavailable";
  /** Signed-in auth user id. */
  userId: string;
  /** Legacy owner_id of the organisation (still written on new rows for older columns). */
  ownerId: string;
  displayName: string;
  /** The organisation the user works in; null when they have no active membership. */
  org: OrganisationSummary | null;
  isMember: boolean;
  isOwner: boolean;
  /** Set when role is null. */
  noAccessReason: NoAccessReason | null;
  /** True when the user sees every property of the workspace (Admin, Office Executive). */
  allProperties: boolean;
  homestayIds: string[];
  canViewPricing: boolean;
  canEnterExpenses: boolean;
  /** Caretaker kitchen flag, or implied by role (Admin / Office Executive / Property Manager). */
  canManageKitchen: boolean;
  /** Accessible homestays where the Welcomely add-on is on for the organisation and the homestay. */
  welcomelyHomestayIds: string[];
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

/** Capability map. Keep in sync with public.has_capability() in the roles migration. */
export function hasCapability(access: AccessProfile, capability: Capability): boolean {
  const role = access.role;

  if (!role) return false;

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
    case "kitchen.manage":
      return isOffice || isManager || (isCaretaker && access.canManageKitchen);
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

  return hasCapability(access, moduleCapability[module]);
}

export function defaultRouteForAccess(access: AccessProfile): string {
  if (!access.role) return "/unauthorized";
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

/**
 * Profile for a signed-in user whose access could not be loaded (or who has no membership).
 * Fails closed: no role, no properties. JWT app_metadata is deliberately ignored.
 */
export function noAccessProfile(
  userId: string | undefined,
  reason: NoAccessReason = "unavailable",
): AccessProfile {
  return {
    role: null,
    source: reason === "unavailable" ? "unavailable" : "database",
    userId: userId ?? "",
    ownerId: "",
    displayName: "",
    org: null,
    isMember: false,
    isOwner: false,
    noAccessReason: reason,
    allProperties: false,
    homestayIds: [],
    canViewPricing: false,
    canEnterExpenses: false,
    canManageKitchen: false,
    welcomelyHomestayIds: [],
  };
}

type AccessRpcResult = {
  role: DatabaseRole | null;
  user_id: string | null;
  owner_id: string | null;
  display_name: string | null;
  is_member?: boolean;
  is_active?: boolean;
  is_owner?: boolean;
  org_status?: "active" | "suspended" | null;
  org?: {
    id: string;
    name: string;
    slug: string;
    status: "active" | "suspended";
    welcomely_enabled: boolean;
  } | null;
  all_properties: boolean;
  homestay_ids: string[] | null;
  welcomely_homestay_ids?: string[] | null;
  can_view_pricing: boolean;
  can_enter_expenses: boolean;
  can_manage_kitchen?: boolean;
};

function noAccessReasonFor(result: AccessRpcResult): NoAccessReason {
  if (!result.is_member) return "no_membership";
  if (result.org_status === "suspended") return "suspended";
  return "paused";
}

export function accessFromRpc(result: AccessRpcResult, fallbackUserId = ""): AccessProfile {
  const role = result.role ? databaseRoleToUserRole[result.role] ?? null : null;
  // Older databases (before the organisations migration) have no "org": treat as no access.
  const org = result.org
    ? {
        id: result.org.id,
        name: result.org.name,
        slug: result.org.slug,
        status: result.org.status,
        welcomelyEnabled: Boolean(result.org.welcomely_enabled),
      }
    : null;

  if (!role || !org) {
    // A role without an organisation means the database predates the organisations migration.
    const reason: NoAccessReason = role && !org ? "unavailable" : noAccessReasonFor(result);

    return {
      ...noAccessProfile(result.user_id ?? fallbackUserId, reason),
      displayName: result.display_name ?? "",
      isMember: Boolean(result.is_member),
    };
  }

  return {
    role,
    source: "database",
    userId: result.user_id ?? fallbackUserId,
    ownerId: result.owner_id ?? "",
    displayName: result.display_name ?? "",
    org,
    isMember: true,
    isOwner: Boolean(result.is_owner),
    noAccessReason: null,
    allProperties: Boolean(result.all_properties),
    homestayIds: result.homestay_ids ?? [],
    canViewPricing: Boolean(result.can_view_pricing),
    canEnterExpenses: Boolean(result.can_enter_expenses),
    canManageKitchen: Boolean(result.can_manage_kitchen),
    welcomelyHomestayIds: result.welcomely_homestay_ids ?? [],
  };
}
