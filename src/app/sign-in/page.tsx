"use client";

import { ArrowRight, Eye, EyeOff, KeyRound, LoaderCircle, ShieldCheck, CalendarDays, UsersRound, WalletCards } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { Brand } from "@/components/brand";
import { defaultRouteForRole, resolveUserRole } from "@/lib/authorization";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.replace(defaultRouteForRole(resolveUserRole(data.session.user.app_metadata?.role)));
      }
    });
  }, [router]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      setError("Sign-in is not available yet. Please contact your administrator.");
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError(signInError.message);
        return;
      }
      router.replace(defaultRouteForRole(resolveUserRole(data.user.app_metadata?.role)));
      router.refresh();
    } catch {
      setError("We couldn’t connect. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="sign-in-page">
      <section className="hospitality-story" aria-label="Welcome to StayLedger">
        <Image src="/images/alpine-retreat.jpg" alt="A peaceful lakeside retreat beneath forested mountains" fill preload sizes="(min-width: 1100px) 56vw, (min-width: 760px) 48vw, 100vw" className="retreat-image" />
        <div className="story-shade" />
        <div className="story-brand"><Brand light /></div>
        <div className="story-copy">
          <span className="eyebrow story-eyebrow"><span /> A LITTLE MORE ROOM TO BREATHE</span>
          <h1>Great stays.<br />Happy guests.<br /><em>Peace of mind.</em></h1>
          <p>Behind every memorable stay is a little order.<br className="desktop-break" /> Bring your properties, people, and accounts together.</p>
        </div>
        <div className="story-footer">
          <span><CalendarDays size={16} /> Seamless bookings</span>
          <span><UsersRound size={16} /> Happier guests</span>
          <span><WalletCards size={16} /> Clearer accounts</span>
        </div>
      </section>
      <section className="sign-in-workspace" aria-labelledby="sign-in-title">
        <div className="workspace-top"><span className="eyebrow">YOUR HOSPITALITY WORKSPACE</span><ShieldCheck size={17} aria-hidden="true" /></div>
        <div className="mobile-brand"><Brand /></div>
        <div className="sign-in-content">
          <div className="welcome-icon"><KeyRound size={23} strokeWidth={1.5} /></div>
          <p className="eyebrow form-eyebrow">GOOD TO HAVE YOU HERE</p>
          <h2 id="sign-in-title">Welcome back.</h2>
          <p className="sign-in-intro">A new day of thoughtful hosting starts here.<br />Sign in to your StayLedger workspace.</p>
          <form className="sign-in-form" onSubmit={signIn} aria-busy={isLoading}>
            <label htmlFor="email">Email address</label>
            <input id="email" name="email" type="email" autoComplete="username" placeholder="you@yourhomestay.com" value={email} onChange={(event) => setEmail(event.target.value)} className="field-control" required disabled={!isSupabaseConfigured || isLoading} aria-describedby={error ? "sign-in-error" : undefined} />
            <label htmlFor="password">Password</label>
            <div className="password-field">
              <input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} className="field-control" required disabled={!isSupabaseConfigured || isLoading} aria-describedby={error ? "sign-in-error" : undefined} />
              <button type="button" className="password-toggle" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)} disabled={!isSupabaseConfigured || isLoading}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
            </div>
            {error && <p id="sign-in-error" className="sign-in-error" role="alert">{error}</p>}
            {!isSupabaseConfigured && <p className="sign-in-error" role="status">Sign-in is not available yet. Please contact your administrator.</p>}
            <button type="submit" className="sign-in-submit" disabled={!isSupabaseConfigured || isLoading}>
              {isLoading ? <><LoaderCircle size={18} className="animate-spin" /> Signing in…</> : <>Sign in to workspace <ArrowRight size={18} /></>}
            </button>
          </form>
          <div className="team-access"><span className="access-line" /><span>MADE FOR YOUR TEAM</span><span className="access-line" /></div>
          <p className="access-note"><ShieldCheck size={15} /> Secure access for admins and managers</p>
          <details className="sign-in-help">
            <summary>Need a hand signing in?</summary>
            <p>Contact your property administrator to request an account or reset your password. Use the email address assigned to your team account.</p>
          </details>
        </div>
        <footer className="workspace-footer"><span>Less admin. More hospitality.</span><span>StayLedger © {new Date().getFullYear()}</span></footer>
      </section>
    </main>
  );
}
