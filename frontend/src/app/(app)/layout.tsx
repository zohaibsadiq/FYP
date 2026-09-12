"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { MobileNav } from "@/components/layout/mobile-nav";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { useCurrentUser } from "@/hooks/use-auth";
import { tokens } from "@/lib/tokens";

// Access control lives on the server, where every endpoint requires a valid
// token. The redirect below only keeps signed-out visitors off an empty shell.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isError } = useCurrentUser();

  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!tokens.isLoggedIn()) {
      router.replace("/login");
      return;
    }
    setChecked(true);
  }, [router]);

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
        {/* pb-20 clears the fixed MobileNav. */}
        <main className="flex-1 overflow-y-auto p-4 pb-20 lg:p-8 lg:pb-8">{children}</main>
      </div>

      <MobileNav />
    </div>
  );
}
