import type { Metadata } from "next";
import { Outfit, JetBrains_Mono } from "next/font/google";

import { AppProviders } from "@/providers/app-providers";
import "./globals.css";

// These two names must stay different from the font names in globals.css, or
// the page's font setting ends up pointing at itself and no font loads.
const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

const mono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Closette",
    template: "%s - Closette",
  },
  description:
    "Keep a list of the clothes you own, where each one is stored, and what you wore recently.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${outfit.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
