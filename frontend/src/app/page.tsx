import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CloudSun,
  MapPin,
  Scan,
  Shirt,
  Sparkles,
} from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Public landing page (/).
 *
 * This is the first thing your supervisor and the defence panel will see, so it
 * states the problem, the solution, and the four pillars of the system in one
 * screen. It is a Server Component - no "use client" - so it is fast and
 * SEO-friendly.
 */

const PILLARS = [
  {
    icon: MapPin,
    title: "Knows where things are",
    body: "Not just what you own, but its exact physical place: Bedroom Closet → Cabinet 2 → Hanger 4.",
  },
  {
    icon: CloudSun,
    title: "Reads the context",
    body: "Live weather, the occasion, and the dress code decide which outfits are even eligible.",
  },
  {
    icon: Sparkles,
    title: "Remembers what you wore",
    body: "A freshness score pushes down anything you wore recently, so you never repeat by accident.",
  },
  {
    icon: Scan,
    title: "Shows it on you",
    body: "Generative try-on places the chosen outfit onto your own full-body photo before you commit.",
  },
];

const FLOW = [
  { step: "01", label: "Snap & save", detail: "Background removed automatically" },
  { step: "02", label: "Plan an event", detail: "Weather and dress code pulled in" },
  { step: "03", label: "Get suggestions", detail: "Scored, ranked, never repeated" },
  { step: "04", label: "Try it on", detail: "Generated on your own photo" },
];

export default function LandingPage() {
  return (
    <main className="relative overflow-hidden">
      {/* Soft brand glow in the background */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[32rem] w-[64rem] -translate-x-1/2 rounded-full bg-primary/15 blur-[120px]"
      />

      {/* ---------------- Nav ---------------- */}
      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Shirt className="size-5" />
          </span>
          <span className="text-lg font-semibold tracking-tight">Lumiere</span>
        </div>
        {/* NOTE: this shadcn style is built on Base UI, which has no `asChild`.
            For links we apply buttonVariants() to the <Link> directly - simpler
            and it keeps the correct HTML (an anchor, not a button). */}
        <nav className="flex items-center gap-2">
          <Link href="/login" className={cn(buttonVariants({ variant: "ghost" }), "h-9 px-4")}>
            Sign in
          </Link>
          <Link href="/register" className={cn(buttonVariants(), "h-9 px-4")}>
            Get started
          </Link>
        </nav>
      </header>

      {/* ---------------- Hero ---------------- */}
      <section className="relative mx-auto max-w-4xl px-6 pt-16 pb-20 text-center sm:pt-24">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-medium text-muted-foreground">
          <Sparkles className="size-3.5 text-primary" />
          Final Year Project · Computer Vision + Generative AI
        </span>

        <h1 className="mt-7 text-balance text-4xl font-semibold leading-[1.1] tracking-tight sm:text-6xl">
          Your whole wardrobe,
          <span className="block text-primary">aware of its context.</span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
          Most wardrobe apps are a photo album with tags. Lumiere tracks where each
          item physically lives, scores outfits against the weather and the
          occasion, remembers what you already wore in front of whom, and renders
          the result on your own photo before you get dressed.
        </p>

        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/register"
            className={cn(buttonVariants(), "h-11 w-full gap-2 px-6 text-base sm:w-auto")}
          >
            Create your closet
            <ArrowRight className="size-4" />
          </Link>
          <Link
            href="/login"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "h-11 w-full px-6 text-base sm:w-auto",
            )}
          >
            I already have an account
          </Link>
        </div>
      </section>

      {/* ---------------- Four pillars ---------------- */}
      <section className="relative mx-auto max-w-6xl px-6 pb-20">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PILLARS.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="group rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/40"
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="size-5" />
              </span>
              <h3 className="mt-4 font-semibold tracking-tight">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- How it works ---------------- */}
      <section className="relative border-t border-border bg-muted/30 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <CalendarDays className="size-4" />
            The daily loop
          </div>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
            Four steps, every morning.
          </h2>

          <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FLOW.map(({ step, label, detail }) => (
              <li key={step} className="relative">
                <span className="font-mono text-sm text-primary">{step}</span>
                <h3 className="mt-2 font-semibold tracking-tight">{label}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------------- Footer ---------------- */}
      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 text-sm text-muted-foreground sm:flex-row">
          <span>Lumiere — Smart Wardrobe Management System</span>
          <span className="font-mono text-xs">Built with Next.js + Django</span>
        </div>
      </footer>
    </main>
  );
}
