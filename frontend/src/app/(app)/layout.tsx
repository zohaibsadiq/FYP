"use client";

import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { Loader2 } from "lucide-react";

import { MobileNav } from "@/components/layout/mobile-nav";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { useCurrentUser } from "@/hooks/use-auth";
import { tokens } from "@/lib/tokens";

// The real door is on the server: every API address refuses a request without
// a valid token. The redirect below only stops a signed-out visitor seeing an
// empty page frame with nothing in it.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isError } = useCurrentUser();

  // These pages are built before the browser gets them, and the token lives
  // in the browser, so it can only be read once the browser is running the
  // page. Listening for changes, rather than reading once, also signs this tab
  // out when another tab signs out.
  const signedIn = useSyncExternalStore(tokens.subscribe, tokens.isLoggedIn, () => false);

  useEffect(() => {
    if (!signedIn) router.replace("/login");
  }, [signedIn, router]);

  useEffect(() => {
    if (isError) {
      tokens.clear();
      router.replace("/login");
    }
  }, [isError, router]);

  if (!signedIn) {
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
        {/* pb-20 clears the fixed MobileNav. */}
        <main className="flex-1 overflow-y-auto p-4 pb-20 lg:p-8 lg:pb-8">{children}</main>
      </div>

      <MobileNav />
    </div>
  );
}
