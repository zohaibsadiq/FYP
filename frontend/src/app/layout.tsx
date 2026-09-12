import type { Metadata } from "next";
import { Outfit, JetBrains_Mono } from "next/font/google";

import { AppProviders } from "@/providers/app-providers";
import "./globals.css";

/**
 * "Outfit" is a real Google font - the name is a happy coincidence for a
 * wardrobe app. It is geometric and modern, which reads as more designed than
 * the default system font.
 */
const outfit = Outfit({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const mono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Lumiere — Smart Wardrobe",
    template: "%s · Lumiere",
  },
  description:
    "A context-aware smart wardrobe: track what you own and where it is stored, " +
    "get outfit suggestions from weather and events, and try clothes on virtually.",
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
