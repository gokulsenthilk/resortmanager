import { redirect } from "next/navigation";
import { cache } from "react";

import {
  accessFromRpc,
  canAccessModule,
  isMissingFunctionError,
  legacyAccessFromClaims,
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
 * Loads the signed-in user's role and property scope from public.get_my_access().
 * Falls back to the JWT app_metadata role while the roles migration is not applied.
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
    const legacy = legacyAccessFromClaims(user.id, user.app_metadata);
    const { data: accessData, error: accessError } = await supabase.rpc("get_my_access");

    if (accessError) {
      if (!isMissingFunctionError(accessError)) {
        console.error("get_my_access failed; using legacy role", accessError.message);
      }

      return { userId: user.id, email: user.email ?? "", access: legacy };
    }

    return {
      userId: user.id,
      email: user.email ?? "",
      access: accessFromRpc(accessData, legacy.ownerId, user.id),
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
