"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

/**
 * OnboardingGuard — redirects new users who haven't completed onboarding
 * to the onboarding wizard. Skips the check if already on the onboarding page.
 */
export function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { push } = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);
  const skipGuard = pathname === "/dashboard/onboarding" || pathname === "/dashboard/profile";

  useEffect(() => {
    if (skipGuard) return;

    async function checkOnboarding() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setChecked(true); return; }

        const { data: profile } = await supabase
          .from("profiles")
          .select("name, phone")
          .eq("id", user.id)
          .single();

        // Align with /dashboard/onboarding guard: need display name + phone (PDPA contact)
        const needsOnboarding =
          !profile || !profile.name?.trim() || !profile.phone?.trim();

        if (needsOnboarding) {
          push("/dashboard/onboarding");
          return;
        }
      } catch {
        // Silently fail — don't block the user
      }
      setChecked(true);
    }

    checkOnboarding();
  }, [skipGuard, push]);

  if (skipGuard) {
    return <>{children}</>;
  }

  if (!checked) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-r-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}
