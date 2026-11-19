"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";

import { supabase } from "@/lib/supabase";

export function SignOutButton({ className }: { className?: string }) {
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function signOut() {
    setIsSigningOut(true);
    await supabase?.auth.signOut();
    window.location.assign("/sign-in");
  }

  return (
    <button type="button" onClick={signOut} disabled={isSigningOut} className={className}>
      <LogOut className="h-4 w-4" aria-hidden="true" />
      {isSigningOut ? "Signing out…" : "Sign out"}
    </button>
  );
}
