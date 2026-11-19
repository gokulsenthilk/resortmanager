import { ShieldX } from "lucide-react";
import Link from "next/link";

import { SignOutButton } from "@/components/sign-out-button";
import { requireAuthenticatedAccess } from "@/lib/auth-server";
import { defaultRouteForAccess, type NoAccessReason } from "@/lib/authorization";

const noAccessCopy: Record<NoAccessReason, { title: string; body: string }> = {
  no_membership: {
    title: "No workspace access",
    body: "This account is not part of any StayLedger organisation yet. Ask your organisation's administrator to add you in Team & access, then sign in again.",
  },
  paused: {
    title: "Access paused",
    body: "Your team access is paused. Ask your administrator to reactivate it.",
  },
  suspended: {
    title: "Organisation paused",
    body: "Your organisation's StayLedger workspace is paused. Contact StayLedger support or your administrator.",
  },
  unavailable: {
    title: "Access could not be loaded",
    body: "We couldn't confirm your access right now, so nothing is shown. Try again in a moment; if it keeps happening, contact your administrator.",
  },
};

export default async function UnauthorizedPage() {
  const { access, email } = await requireAuthenticatedAccess();
  const reason = access.role ? null : access.noAccessReason ?? "unavailable";
  const copy = reason
    ? noAccessCopy[reason]
    : { title: "Access restricted", body: "Your account does not have permission to open this section." };

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-4 text-slate-950">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-lg bg-amber-100 text-amber-800">
          <ShieldX className="h-6 w-6" />
        </div>
        <h1 className="mt-5 text-2xl font-semibold">{copy.title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">{copy.body}</p>
        {reason && email && <p className="mt-3 text-xs text-slate-400">Signed in as {email}</p>}
        <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
          {!reason && (
            <Link
              href={defaultRouteForAccess(access)}
              className="inline-flex h-10 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Return to your dashboard
            </Link>
          )}
          <SignOutButton className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60" />
        </div>
      </section>
    </main>
  );
}
