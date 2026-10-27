"use client";

import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { Loader2 } from "lucide-react";

import { isSignedOutAnswer } from "@/lib/api";

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
  const { error } = useCurrentUser();

  // These pages are built before the browser gets them, and the token lives
  // in the browser, so it can only be read once the browser is running the
  // page. Until then the answer is "not known yet" (null), never "no". On a
  // reload, React draws the page once with the not-known answer before it
  // reads the browser's storage, and a "no" at that moment sent every
  // signed-in person back to the sign-in page. Listening for changes, rather
  // than reading once, also signs this tab out when another tab signs out.
  const signedIn = useSyncExternalStore<boolean | null>(
    tokens.subscribe,
    tokens.isLoggedIn,
    () => null,
  );

  useEffect(() => {
    if (signedIn === false) router.replace("/login");
  }, [signedIn, router]);

  // Only "your token is dead" means signed out. A server that is asleep, a
  // slow connection or a bug must not throw somebody out of their account.
  const signedOut = isSignedOutAnswer(error);
  useEffect(() => {
    if (signedOut) {
      tokens.clear();
      router.replace("/login");
    }
  }, [signedOut, router]);

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
