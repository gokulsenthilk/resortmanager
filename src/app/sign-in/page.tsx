"use client";

import { BedDouble, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { defaultRouteForRole, resolveUserRole } from "@/lib/authorization";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.replace(
          defaultRouteForRole(
            resolveUserRole(data.session.user.app_metadata?.role),
          ),
        );
      }
    });
  }, [router]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase) {
      setError("Supabase environment variables are not configured.");
      return;
    }

    setIsLoading(true);
    setError("");

    const { data, error: signInError } = await supabase.auth.signInWithPassword(
      { email, password },
    );

    if (signInError) {
      setError(signInError.message);
      setIsLoading(false);
      return;
    }

    router.replace(
      defaultRouteForRole(resolveUserRole(data.user.app_metadata?.role)),
    );
    router.refresh();
  }

  return (
    <main className="grid min-h-screen bg-slate-50 text-slate-950 lg:grid-cols-[minmax(0,1fr)_520px]">
      <section className="hidden bg-slate-950 p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-lg bg-teal-400 text-slate-950">
              <BedDouble className="h-5 w-5" />
            </div>
            <div>
              <p className="text-base font-semibold">StayLedger</p>
              <p className="text-sm text-slate-400">Homestay operations</p>
            </div>
          </div>

          <div className="mt-20 max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-300">
              Secure team access
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-normal">
              Sign in to manage stays, guests, and accounts.
            </h1>
            <p className="mt-5 text-base leading-7 text-slate-300">
              Your access is determined by the role assigned to your Supabase
              account.
            </p>
          </div>
        </div>

        <p className="text-sm text-slate-500">
          Route access and database policies enforce the same role permissions.
        </p>
      </section>

      <section className="flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid h-11 w-11 place-items-center rounded-lg bg-teal-100 text-teal-800">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <h2 className="mt-5 text-2xl font-semibold tracking-normal text-slate-950">
            Sign in
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Use your assigned Admin or Manager account.
          </p>

          <form className="mt-6 space-y-4" onSubmit={signIn}>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Email
              </span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="field-control"
                required
                disabled={!isSupabaseConfigured || isLoading}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Password
              </span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="field-control"
                required
                disabled={!isSupabaseConfigured || isLoading}
              />
            </label>

            <button
              type="submit"
              disabled={!isSupabaseConfigured || isLoading}
              className="inline-flex h-10 w-full items-center justify-center rounded-md bg-slate-950 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isLoading ? "Signing in" : "Sign in"}
            </button>
          </form>

          {!isSupabaseConfigured && (
            <p className="mt-4 text-sm font-medium text-red-700">
              Supabase environment variables are not configured.
            </p>
          )}
          {error && (
            <p className="mt-4 text-sm font-medium text-red-700">{error}</p>
          )}
        </div>
      </section>
    </main>
  );
}
