"use server";

import { createClient } from "@supabase/supabase-js";

import { getAuthenticatedAccess } from "@/lib/auth-server";
import { hasCapability } from "@/lib/authorization";

export type InviteResult =
  | { ok: true; alreadyRegistered: boolean }
  | { ok: false; error: string };

/**
 * Sends a Supabase Auth invite email so a new team member can set their password.
 * Needs SUPABASE_SERVICE_ROLE_KEY on the server (never exposed to the browser). The role and
 * property assignment are saved afterwards by the admin's own session through
 * public.add_team_member_by_email(), so the database still decides who may grant access.
 */
export async function inviteTeamMember(email: string, displayName: string): Promise<InviteResult> {
  const caller = await getAuthenticatedAccess();

  if (!caller || caller.access.source !== "database" || !hasCapability(caller.access, "settings.manage")) {
    return { ok: false, error: "Only admins can invite team members." };
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!serviceRoleKey || !supabaseUrl) {
    return {
      ok: false,
      error: "Invites are not configured on this server. Invite the user from the Supabase dashboard instead.",
    };
  }

  const normalizedEmail = email.trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return { ok: false, error: "Enter a valid email address." };
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await admin.auth.admin.inviteUserByEmail(normalizedEmail, {
    data: displayName.trim() ? { full_name: displayName.trim() } : undefined,
  });

  if (error) {
    if (/already (been )?registered|already exists/i.test(error.message)) {
      return { ok: true, alreadyRegistered: true };
    }

    return { ok: false, error: error.message };
  }

  return { ok: true, alreadyRegistered: false };
}
