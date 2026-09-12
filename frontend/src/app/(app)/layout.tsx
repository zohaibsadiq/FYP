"use client";

/**
 * Shell for every logged-in page, and the security gate for the frontend.
 *
 * IMPORTANT to understand (an examiner may ask):
 * This guard is for convenience, not security. A determined person can bypass
 * any frontend check. The real protection is in Django, where every endpoint
 * requires a valid JWT (we set IsAuthenticated as the default permission in
 * settings.py). This guard simply saves the user from seeing an empty, broken
 * page when they are not signed in.
 */

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { MobileNav } from "@/components/layout/mobile-nav";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { useCurrentUser } from "@/hooks/use-auth";
import { tokens } from "@/lib/tokens";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isError } = useCurrentUser();

  // We cannot read localStorage while rendering on the server, so we check it
  // after the component mounts in the browser.
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!tokens.isLoggedIn()) {
      router.replace("/login");
      return;
    }
    setChecked(true);
  }, [router]);

  // The token exists but Django rejected it (expired, or the user was deleted)
  useEffect(() => {
    if (isError) {
      tokens.clear();
      router.replace("/login");
    }
  }, [isError, router]);

  if (!checked) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        {/* pb-20 on mobile leaves room for the fixed bottom nav bar */}
        <main className="flex-1 overflow-y-auto p-4 pb-20 lg:p-8 lg:pb-8">{children}</main>
      </div>

      <MobileNav />
    </div>
  );
}
