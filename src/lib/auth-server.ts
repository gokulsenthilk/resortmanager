import { redirect } from "next/navigation";

import {
  canAccessModule,
  resolveUserRole,
  type UserRole,
} from "./authorization";
import { createServerSupabaseClient } from "./supabase-server";
import type { ModuleKey } from "./types";

export async function requireAuthenticatedRole(): Promise<UserRole> {
  const supabase = await createServerSupabaseClient();

  if (!supabase) {
    redirect("/sign-in");
  }

  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    redirect("/sign-in");
  }

  return resolveUserRole(data.user.app_metadata?.role);
}

export async function requireModuleAccess(module: ModuleKey) {
  const role = await requireAuthenticatedRole();

  if (!canAccessModule(role, module)) {
    redirect("/unauthorized");
  }

  return role;
}
