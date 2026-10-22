"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import axios from "axios";
import { ThemeProvider } from "next-themes";
import { useState } from "react";

import { WakingNotice } from "@/components/layout/waking-notice";
import { Toaster } from "@/components/ui/sonner";

/**
 * A request that never got an answer at all is usually the host starting the
 * server back up, and asking again a moment later works. A refusal is an
 * answer, and asking again just gets refused again.
 */
function gotNoAnswer(error: unknown): boolean {
  return axios.isAxiosError(error) && !error.response;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  // Created inside the component, not once for the whole file. One shared cache
  // would show the previous person's data to the next person who signs in on
  // the same device.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
            // One more try when nothing answered at all, which is what a
            // sleeping server looks like. Saves are left alone on purpose: a
            // save that timed out may have arrived anyway, and sending it
            // twice would add a second copy of whatever it was.
            retry: (failureCount, error) => failureCount < (gotNoAnswer(error) ? 2 : 1),
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        {/* Sits above everything, including the sign-in page, so the knock on
            the server happens while somebody is still typing. */}
        <WakingNotice />
        {children}
        <Toaster position="top-center" richColors />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
