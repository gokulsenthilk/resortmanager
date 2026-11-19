import { redirect } from "next/navigation";
import { cache } from "react";

import {
  accessFromRpc,
  canAccessModule,
  noAccessProfile,
  type AccessProfile,
} from "./authorization";
import { createServerSupabaseClient } from "./supabase-server";
import type { ModuleKey } from "./types";

export type AuthenticatedAccess = {
  userId: string;
  email: string;
  access: AccessProfile;
};

/**
 * Loads the signed-in user's organisation, role and property scope from public.get_my_access().
 * Fails closed: if access cannot be loaded, or the user has no active membership, the profile
 * has no role (the app shows the "no access" screen). JWT app_metadata is never trusted.
 * Cached per request so layouts, pages and actions share one lookup.
 */
export const getAuthenticatedAccess = cache(
  async (): Promise<AuthenticatedAccess | null> => {
    const supabase = await createServerSupabaseClient();

    if (!supabase) {
      return null;
    }

    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      return null;
    }

    const user = data.user;
    const { data: accessData, error: accessError } = await supabase.rpc("get_my_access");

    if (accessError || !accessData) {
      console.error("get_my_access failed; denying access", accessError?.message ?? "no data");

      return { userId: user.id, email: user.email ?? "", access: noAccessProfile(user.id) };
    }

    return {
      userId: user.id,
      email: user.email ?? "",
      access: accessFromRpc(accessData, user.id),
    };
  },
);

export async function requireAuthenticatedAccess(): Promise<AuthenticatedAccess> {
  const result = await getAuthenticatedAccess();

  if (!result) {
    redirect("/sign-in");
  }

  return result;
}

export async function requireModuleAccess(module: ModuleKey): Promise<AuthenticatedAccess> {
  const result = await requireAuthenticatedAccess();

  if (!canAccessModule(result.access, module)) {
    redirect("/unauthorized");
  }

  return result;
}
