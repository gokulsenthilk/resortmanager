import { databaseRoleToUserRole, userRoleToDatabaseRole, type DatabaseRole, type UserRole } from "./authorization";
import { supabase } from "./supabase";

export type TeamMember = {
  userId: string;
  role: UserRole;
  displayName: string;
  email: string;
  staffMemberId: string;
  canViewPricing: boolean;
  canEnterExpenses: boolean;
  /** Caretaker only: may run the kitchen board (Welcomely add-on). */
  canManageKitchen: boolean;
  /** Organisation owner: their access cannot be changed from Team & access. */
  isOwner: boolean;
  isActive: boolean;
  homestayIds: string[];
};

export type StaffAllocation = Record<string, string[]>;

export type TeamData = {
  members: TeamMember[];
  staffAllocation: StaffAllocation;
};

export type TeamMemberInput = {
  role: UserRole;
  displayName: string;
  homestayIds: string[];
  canViewPricing: boolean;
  canEnterExpenses: boolean;
  canManageKitchen: boolean;
  isActive: boolean;
  staffMemberId: string;
};

type TeamMemberRow = {
  user_id: string;
  role: DatabaseRole;
  display_name: string | null;
  email: string | null;
  staff_member_id: string | null;
  can_view_pricing: boolean;
  can_enter_expenses: boolean;
  can_manage_kitchen: boolean;
  is_owner: boolean;
  is_active: boolean;
};

function client() {
  if (!supabase) {
    throw new Error("Supabase environment variables are not configured.");
  }

  return supabase;
}

/** Readable message for the errors raised by the team RPCs. */
export function teamErrorMessage(error: { message: string; code?: string }): string {
  if (["PGRST202", "PGRST205", "42883", "42P01"].includes(error.code ?? "")) {
    return "The roles migration has not been applied to this Supabase project yet. Run supabase/migrations/20261118180000_roles_property_access.sql first.";
  }

  if (error.code === "42703") {
    return "The organisations migration has not been applied to this Supabase project yet. Run supabase/migrations/20261119210000_organisations.sql first.";
  }

  return error.message;
}

export async function fetchTeamData(): Promise<TeamData> {
  const db = client();
  const [membersResult, assignmentsResult, allocationResult] = await Promise.all([
    db
      .from("team_members")
      .select("user_id,role,display_name,email,staff_member_id,can_view_pricing,can_enter_expenses,can_manage_kitchen,is_owner,is_active")
      .order("display_name", { ascending: true }),
    db.from("team_member_homestays").select("user_id,homestay_id"),
    db.from("staff_member_homestays").select("staff_id,homestay_id"),
  ]);
  const error = membersResult.error ?? assignmentsResult.error ?? allocationResult.error;

  if (error) {
    throw new Error(teamErrorMessage(error));
  }

  const assignments = (assignmentsResult.data ?? []) as { user_id: string; homestay_id: string }[];
  const members = ((membersResult.data ?? []) as TeamMemberRow[]).map((row) => ({
    userId: row.user_id,
    role: databaseRoleToUserRole[row.role],
    displayName: row.display_name ?? "",
    email: row.email ?? "",
    staffMemberId: row.staff_member_id ?? "",
    canViewPricing: row.can_view_pricing,
    canEnterExpenses: row.can_enter_expenses,
    canManageKitchen: row.can_manage_kitchen,
    isOwner: row.is_owner,
    isActive: row.is_active,
    homestayIds: assignments.filter((item) => item.user_id === row.user_id).map((item) => item.homestay_id),
  }));
  const staffAllocation: StaffAllocation = {};

  ((allocationResult.data ?? []) as { staff_id: string; homestay_id: string }[]).forEach((row) => {
    staffAllocation[row.staff_id] = [...(staffAllocation[row.staff_id] ?? []), row.homestay_id];
  });

  return { members, staffAllocation };
}

function rpcArgs(input: TeamMemberInput) {
  const scoped = input.role === "PropertyManager" || input.role === "Caretaker";

  return {
    new_role: userRoleToDatabaseRole[input.role],
    new_display_name: input.displayName.trim() || null,
    new_homestay_ids: scoped ? input.homestayIds : [],
    new_can_view_pricing: input.role === "PropertyManager" && input.canViewPricing,
    new_can_enter_expenses: input.role === "Caretaker" && input.canEnterExpenses,
    new_can_manage_kitchen: input.role === "Caretaker" && input.canManageKitchen,
  };
}

/** Adds an existing Supabase Auth user (by email) to the workspace. Admin only (enforced in SQL). */
export async function addTeamMemberByEmail(email: string, input: TeamMemberInput): Promise<string> {
  const { data, error } = await client().rpc("add_team_member_by_email", {
    member_email: email.trim(),
    ...rpcArgs(input),
  });

  if (error) {
    if (error.code === "P0002") {
      throw new Error(
        `No account exists for ${email.trim()} yet. Invite them from Supabase → Authentication → Users → "Invite user", then add them here.`,
      );
    }

    throw new Error(teamErrorMessage(error));
  }

  return data as string;
}

export async function updateTeamMember(userId: string, input: TeamMemberInput): Promise<void> {
  const { error } = await client().rpc("set_team_member_access", {
    target_user_id: userId,
    ...rpcArgs(input),
    new_is_active: input.isActive,
    new_staff_member_id: input.staffMemberId || null,
  });

  if (error) {
    throw new Error(teamErrorMessage(error));
  }
}

export async function setStaffHomestays(staffId: string, homestayIds: string[]): Promise<void> {
  const { error } = await client().rpc("set_staff_homestays", {
    target_staff_id: staffId,
    new_homestay_ids: homestayIds,
  });

  if (error) {
    throw new Error(teamErrorMessage(error));
  }
}
