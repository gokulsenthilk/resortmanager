import { ShieldX } from "lucide-react";
import Link from "next/link";

import { requireAuthenticatedRole } from "@/lib/auth-server";
import { defaultRouteForRole } from "@/lib/authorization";

export default async function UnauthorizedPage() {
  const role = await requireAuthenticatedRole();

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-4 text-slate-950">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-lg bg-amber-100 text-amber-800">
          <ShieldX className="h-6 w-6" />
        </div>
        <h1 className="mt-5 text-2xl font-semibold">Access restricted</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Your account does not have permission to open this section.
        </p>
        <Link
          href={defaultRouteForRole(role)}
          className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Return to your dashboard
        </Link>
      </section>
    </main>
  );
}
