import type { ModuleKey } from "./types";

export type UserRole = "Admin" | "Manager";

const managerModules = new Set<ModuleKey>(["calendar"]);

const pathnameModules: Record<string, ModuleKey> = {
  "/": "overview",
  "/homestays": "homestays",
  "/customers": "customers",
  "/staff": "staff",
  "/bookings": "bookings",
  "/calendar": "calendar",
  "/expenses": "expenses",
  "/accounts": "accounts",
};

export function resolveUserRole(role: unknown): UserRole {
  return typeof role === "string" && role.toLowerCase() === "admin"
    ? "Admin"
    : "Manager";
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

export function canAccessModule(role: UserRole, module: ModuleKey): boolean {
  return role === "Admin" || managerModules.has(module);
}

export function defaultRouteForRole(role: UserRole): string {
  return role === "Manager" ? "/calendar" : "/";
}

export function moduleForPathname(pathname: string): ModuleKey | undefined {
  return pathnameModules[pathname];
}
