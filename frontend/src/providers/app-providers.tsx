"use client";

/**
 * Wraps the whole app in the things every page needs:
 *   - React Query  (data fetching + caching)
 *   - next-themes  (light / dark mode)
 *   - Sonner       (toast notifications)
 *
 * This lives in ONE file so layout.tsx stays clean.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useState } from "react";

import { Toaster } from "@/components/ui/sonner";

export function AppProviders({ children }: { children: React.ReactNode }) {
  // useState (not a module-level const) so each browser tab gets its own cache
  // and the server does not share one client between users.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 min - do not refetch on every tab focus
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        {children}
        <Toaster position="top-center" richColors />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
