"use client";

import { Building2, Check, IdCard, MailPlus, Pencil, ShieldCheck, UserPlus } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { inviteTeamMember } from "@/app/team/actions";
import { Picker } from "@/components/ui/picker";
import { roleDescriptions, roleLabels, type UserRole } from "@/lib/authorization";
import {
  addTeamMemberByEmail,
  fetchTeamData,
  setStaffHomestays,
  updateTeamMember,
  type TeamData,
  type TeamMember,
  type TeamMemberInput,
} from "@/lib/team-data";
import type { Homestay, StaffMember } from "@/lib/types";

import { DashboardModal, EmptyState, Field, StatusPanel } from "./ui";

const roleOrder: UserRole[] = ["Admin", "OfficeExecutive", "PropertyManager", "Caretaker"];

const roleBadgeStyles: Record<UserRole, string> = {
  Admin: "border-slate-300 bg-slate-900 text-white",
  OfficeExecutive: "border-sky-200 bg-sky-50 text-sky-800",
  PropertyManager: "border-teal-200 bg-teal-50 text-teal-800",
  Caretaker: "border-amber-200 bg-amber-50 text-amber-800",
};

type MemberForm = TeamMemberInput & { userId: string; email: string; sendInvite: boolean };

const blankForm: MemberForm = {
  userId: "",
  email: "",
  role: "PropertyManager",
  displayName: "",
  homestayIds: [],
  canViewPricing: false,
  canEnterExpenses: false,
  isActive: true,
  staffMemberId: "",
  sendInvite: true,
};

function isScoped(role: UserRole) {
  return role === "PropertyManager" || role === "Caretaker";
}

export function TeamAccessPanel({
  homestays,
  staffMembers,
  canInviteUsers,
  initialData,
  migrationApplied = true,
}: {
  /** False while the roles migration is missing in Supabase (access resolved from the JWT). */
  migrationApplied?: boolean;
  homestays: Homestay[];
  staffMembers: StaffMember[];
  /** True when SUPABASE_SERVICE_ROLE_KEY is set on the server, so invite emails can be sent. */
  canInviteUsers: boolean;
  /** Preloaded data (used by previews and tests); otherwise loaded from Supabase. */
  initialData?: TeamData;
}) {
  const [data, setData] = useState<TeamData>(initialData ?? { members: [], staffAllocation: {} });
  const [isLoading, setIsLoading] = useState(!initialData && migrationApplied);
  const [loadError, setLoadError] = useState("");
  const [form, setForm] = useState<MemberForm | null>(null);
  const [formError, setFormError] = useState("");
  const [formNotice, setFormNotice] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [staffEditing, setStaffEditing] = useState<{ staff: StaffMember; homestayIds: string[] } | null>(null);
  const homestayName = useMemo(
    () => new Map(homestays.map((homestay) => [homestay.id, homestay.name])),
    [homestays],
  );

  const reload = useCallback(async () => {
    try {
      setData(await fetchTeamData());
      setLoadError("");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to load the team.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialData || !migrationApplied) return;
    let active = true;

    fetchTeamData()
      .then((result) => {
        if (active) setData(result);
      })
      .catch((error) => {
        if (active) setLoadError(error instanceof Error ? error.message : "Unable to load the team.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [initialData, migrationApplied]);

  function openNew() {
    setForm({ ...blankForm, sendInvite: canInviteUsers });
    setFormError("");
    setFormNotice("");
  }

  function openEdit(member: TeamMember) {
    setForm({ ...blankForm, ...member, sendInvite: false });
    setFormError("");
    setFormNotice("");
  }

  async function submitMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;

    if (!form.userId && !form.email.trim()) {
      setFormError("Enter the team member's email address.");
      return;
    }

    if (isScoped(form.role) && form.homestayIds.length === 0 && form.isActive) {
      setFormError("Assign at least one property, or switch the member to inactive.");
      return;
    }

    setIsSaving(true);
    setFormError("");

    try {
      if (form.userId) {
        await updateTeamMember(form.userId, form);
      } else {
        if (form.sendInvite && canInviteUsers) {
          const invite = await inviteTeamMember(form.email, form.displayName);
          if (!invite.ok) throw new Error(invite.error);
        }

        await addTeamMemberByEmail(form.email, form);
      }

      await reload();
      setForm(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to save access.");
    } finally {
      setIsSaving(false);
    }
  }

  async function submitStaffAllocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!staffEditing) return;
    setIsSaving(true);
    setFormError("");

    try {
      await setStaffHomestays(staffEditing.staff.id, staffEditing.homestayIds);
      await reload();
      setStaffEditing(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to save the allocation.");
    } finally {
      setIsSaving(false);
    }
  }

  const activeMembers = data.members.filter((member) => member.isActive).length;

  if (!migrationApplied) {
    return (
      <div className="space-y-5" data-testid="team-access">
        <StatusPanel
          title="Roles are not set up in Supabase yet"
          message="Run the roles migration in the Supabase SQL editor (see docs/roles-and-access.md), then reload this page to add Office Executives, Property Managers and Caretakers. Until then everyone except Admins keeps calendar-only access."
        />
      </div>
    );
  }

  return (
    <div className="space-y-5" data-testid="team-access">
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-700">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-slate-950">Team &amp; access</h2>
            <p className="mt-1 text-sm text-slate-500">
              {activeMembers} active {activeMembers === 1 ? "member" : "members"}. Property Managers and Caretakers only see the properties you assign.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800 sm:w-auto lg:h-10 lg:rounded-md"
        >
          <UserPlus className="h-5 w-5" aria-hidden="true" />
          Add team member
        </button>
      </section>

      {isLoading && <StatusPanel title="Loading team" message="Fetching members and property assignments." />}
      {loadError && <StatusPanel title="Team could not be loaded" message={loadError} tone="error" />}

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm" aria-label="Team members">
        <div className="border-b border-slate-200 p-4">
          <h3 className="text-base font-semibold text-slate-950">Members</h3>
        </div>
        {!isLoading && data.members.length === 0 && (
          <EmptyState message="No team members yet. Add your office team, managers and caretakers." />
        )}
        <ul className="divide-y divide-slate-100">
          {data.members.map((member) => (
            <li key={member.userId} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-slate-950">{member.displayName || member.email}</p>
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${roleBadgeStyles[member.role]}`}>
                    {roleLabels[member.role]}
                  </span>
                  {!member.isActive && (
                    <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
                      Paused
                    </span>
                  )}
                </div>
                {member.displayName && <p className="truncate text-sm text-slate-500">{member.email}</p>}
                <div className="flex flex-wrap gap-1.5">
                  {isScoped(member.role) ? (
                    member.homestayIds.length > 0 ? (
                      member.homestayIds.map((id) => (
                        <span key={id} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                          <Building2 className="h-3.5 w-3.5 text-teal-700" aria-hidden="true" />
                          {homestayName.get(id) ?? "Property"}
                        </span>
                      ))
                    ) : (
                      <span className="rounded-lg bg-red-50 px-2 py-1 text-xs font-medium text-red-700">No properties assigned</span>
                    )
                  ) : (
                    <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">All properties</span>
                  )}
                  {member.role === "PropertyManager" && member.canViewPricing && (
                    <span className="rounded-lg bg-teal-50 px-2 py-1 text-xs font-medium text-teal-800">Sees pricing</span>
                  )}
                  {member.role === "Caretaker" && member.canEnterExpenses && (
                    <span className="rounded-lg bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">Records expenses</span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => openEdit(member)}
                className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 lg:h-9"
                aria-label={`Edit access for ${member.displayName || member.email}`}
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
                Edit access
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm" aria-label="Staff allocation">
        <div className="border-b border-slate-200 p-4">
          <h3 className="text-base font-semibold text-slate-950">Staff by property</h3>
          <p className="mt-1 text-sm text-slate-500">Property Managers see the staff allocated to their properties.</p>
        </div>
        {staffMembers.length === 0 && <EmptyState message="No staff records yet." />}
        <ul className="divide-y divide-slate-100">
          {staffMembers.map((staff) => {
            const allocated = data.staffAllocation[staff.id] ?? [];

            return (
              <li key={staff.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-medium text-slate-950">
                    <IdCard className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                    <span className="truncate">{staff.name}</span>
                  </p>
                  <p className="mt-1 truncate text-xs text-slate-500">
                    {allocated.length > 0 ? allocated.map((id) => homestayName.get(id) ?? "Property").join(", ") : "Not allocated"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFormError("");
                    setStaffEditing({ staff, homestayIds: allocated });
                  }}
                  className="inline-flex h-11 shrink-0 items-center rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 lg:h-9"
                >
                  Allocate
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm" aria-label="What each role can do">
        <h3 className="text-base font-semibold text-slate-950">What each role can do</h3>
        <dl className="mt-3 space-y-3">
          {roleOrder.map((role) => (
            <div key={role}>
              <dt className="text-sm font-semibold text-slate-900">{roleLabels[role]}</dt>
              <dd className="text-sm text-slate-500">{roleDescriptions[role]}</dd>
            </div>
          ))}
        </dl>
        {!canInviteUsers && (
          <p className="mt-4 rounded-md bg-slate-50 p-3 text-xs leading-5 text-slate-600">
            To add someone new: invite them in Supabase → Authentication → Users → “Invite user”, then add their email here. Set SUPABASE_SERVICE_ROLE_KEY on the server to send invites from this screen.
          </p>
        )}
      </section>

      {form && (
        <DashboardModal ariaLabel={form.userId ? "Edit team access" : "Add team member"} onClose={() => !isSaving && setForm(null)}>
          <form className="space-y-4 pb-4" onSubmit={submitMember}>
            <div className="pr-12">
              <h2 className="text-base font-semibold text-slate-950">{form.userId ? "Edit access" : "Add team member"}</h2>
              <p className="mt-1 text-sm text-slate-500">
                {form.userId ? form.email : "They sign in with this email. Access applies as soon as you save."}
              </p>
            </div>

            {!form.userId && (
              <Field label="Email">
                <input
                  type="email"
                  required
                  autoComplete="off"
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                  className="field-control"
                  placeholder="name@homelyholidays.in"
                />
              </Field>
            )}

            <Field label="Name">
              <input
                type="text"
                value={form.displayName}
                onChange={(event) => setForm({ ...form, displayName: event.target.value })}
                className="field-control"
                placeholder="Shown in the team list"
              />
            </Field>

            <fieldset>
              <legend className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Role</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {roleOrder.map((role) => {
                  const selected = form.role === role;

                  return (
                    <label
                      key={role}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                        selected ? "border-teal-600 bg-teal-50/60 ring-1 ring-teal-600" : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="role"
                        value={role}
                        checked={selected}
                        onChange={() => setForm({ ...form, role })}
                        className="mt-1 h-4 w-4 accent-teal-700"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-slate-950">{roleLabels[role]}</span>
                        <span className="mt-0.5 block text-xs leading-5 text-slate-500">{roleDescriptions[role]}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Properties</legend>
              {isScoped(form.role) ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {homestays.map((homestay) => {
                    const checked = form.homestayIds.includes(homestay.id);

                    return (
                      <label
                        key={homestay.id}
                        className={`flex h-12 cursor-pointer items-center gap-3 rounded-xl border px-3 text-sm font-medium transition ${
                          checked ? "border-teal-600 bg-teal-50/60 text-teal-900" : "border-slate-200 text-slate-700"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setForm({
                              ...form,
                              homestayIds: checked
                                ? form.homestayIds.filter((id) => id !== homestay.id)
                                : [...form.homestayIds, homestay.id],
                            })
                          }
                          className="h-4 w-4 accent-teal-700"
                        />
                        <span className="truncate">{homestay.name}</span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-600">
                  {roleLabels[form.role]}s see every property.
                </p>
              )}
            </fieldset>

            {form.role === "PropertyManager" && (
              <ToggleRow
                label="Can see booking pricing"
                hint="Amounts, payments and booking extras. Off by default."
                checked={form.canViewPricing}
                onChange={(canViewPricing) => setForm({ ...form, canViewPricing })}
              />
            )}
            {form.role === "Caretaker" && (
              <ToggleRow
                label="Can record expenses"
                hint="Add property expenses for assigned properties. Off by default."
                checked={form.canEnterExpenses}
                onChange={(canEnterExpenses) => setForm({ ...form, canEnterExpenses })}
              />
            )}
            {form.userId && (
              <ToggleRow
                label="Active"
                hint="Paused members can sign in but see nothing."
                checked={form.isActive}
                onChange={(isActive) => setForm({ ...form, isActive })}
              />
            )}
            {form.userId && staffMembers.length > 0 && (
              <Field label="Linked staff record">
                <Picker
                  label="Linked staff record"
                  value={form.staffMemberId}
                  onChange={(staffMemberId) => setForm({ ...form, staffMemberId })}
                  options={[{ value: "", label: "Not linked" }, ...staffMembers.map((staff) => ({ value: staff.id, label: staff.name, sub: staff.employeeType }))]}
                />
              </Field>
            )}
            {!form.userId && canInviteUsers && (
              <ToggleRow
                label="Send invite email"
                hint="Creates their login and emails a link to set a password."
                checked={form.sendInvite}
                onChange={(sendInvite) => setForm({ ...form, sendInvite })}
              />
            )}
            {!form.userId && !canInviteUsers && (
              <p className="flex gap-2 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                <MailPlus className="h-4 w-4 shrink-0" aria-hidden="true" />
                Their account must already exist. Invite them first in Supabase → Authentication → Users → “Invite user”.
              </p>
            )}

            {formError && <p className="text-sm font-medium text-red-700" role="alert">{formError}</p>}
            {formNotice && <p className="text-sm font-medium text-teal-700">{formNotice}</p>}

            <div className="sticky-actions flex gap-2">
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-slate-950 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:bg-slate-300 lg:h-10 lg:rounded-md"
              >
                <Check className="h-4 w-4" aria-hidden="true" />
                {isSaving ? "Saving" : form.userId ? "Save access" : "Add member"}
              </button>
            </div>
          </form>
        </DashboardModal>
      )}

      {staffEditing && (
        <DashboardModal ariaLabel="Allocate staff" onClose={() => !isSaving && setStaffEditing(null)}>
          <form className="space-y-4 pb-4" onSubmit={submitStaffAllocation}>
            <div className="pr-12">
              <h2 className="text-base font-semibold text-slate-950">Allocate {staffEditing.staff.name}</h2>
              <p className="mt-1 text-sm text-slate-500">Choose the properties this person works at.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {homestays.map((homestay) => {
                const checked = staffEditing.homestayIds.includes(homestay.id);

                return (
                  <label
                    key={homestay.id}
                    className={`flex h-12 cursor-pointer items-center gap-3 rounded-xl border px-3 text-sm font-medium ${
                      checked ? "border-teal-600 bg-teal-50/60 text-teal-900" : "border-slate-200 text-slate-700"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setStaffEditing({
                          ...staffEditing,
                          homestayIds: checked
                            ? staffEditing.homestayIds.filter((id) => id !== homestay.id)
                            : [...staffEditing.homestayIds, homestay.id],
                        })
                      }
                      className="h-4 w-4 accent-teal-700"
                    />
                    <span className="truncate">{homestay.name}</span>
                  </label>
                );
              })}
            </div>
            {formError && <p className="text-sm font-medium text-red-700" role="alert">{formError}</p>}
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-slate-950 text-sm font-semibold text-white disabled:bg-slate-300 lg:h-10 lg:rounded-md"
            >
              {isSaving ? "Saving" : "Save allocation"}
            </button>
          </form>
        </DashboardModal>
      )}
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-slate-200 p-3">
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-slate-950">{label}</span>
        <span className="mt-0.5 block text-xs leading-5 text-slate-500">{hint}</span>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-6 w-6 shrink-0 accent-teal-700"
      />
    </label>
  );
}
