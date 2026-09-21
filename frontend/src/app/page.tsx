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

const PILLARS = [
  {
    icon: MapPin,
    title: "Find it fast",
    body: "Save the room, the cupboard and the shelf each item sits on. Look it up and walk straight to it.",
  },
  {
    icon: CloudSun,
    title: "Know before you dress",
    body: "Today's temperature, rain and wind for your city, in one line you can read at a glance.",
  },
  {
    icon: Sparkles,
    title: "What you actually wear",
    body: "Every wearing is logged, so you can see what earns its place and what has sat untouched for months.",
  },
  {
    icon: Scan,
    title: "See it on you",
    body: "Put an outfit on your own full-body photo before you get dressed.",
  },
];

const FLOW = [
  { step: "01", label: "Add a photo", detail: "One card per item" },
  { step: "02", label: "Say where it lives", detail: "Room, cupboard, shelf" },
  { step: "03", label: "Pick the day", detail: "Weather and plans included" },
  { step: "04", label: "Get an outfit", detail: "Shown on your photo" },
];

export default function LandingPage() {
  return (
    <main className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[32rem] w-[64rem] -translate-x-1/2 rounded-full bg-primary/15 blur-[120px]"
      />

      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Shirt className="size-5" />
          </span>
          <span className="text-lg font-semibold tracking-tight">Closette</span>
        </div>
        {/* Base UI has no asChild, so links take buttonVariants() directly. */}
        <nav className="flex items-center gap-2">
          <Link href="/login" className={cn(buttonVariants({ variant: "ghost" }), "h-9 px-4")}>
            Sign in
          </Link>
          <Link href="/register" className={cn(buttonVariants(), "h-9 px-4")}>
            Get started
          </Link>
        </nav>
      </header>

      <section className="relative mx-auto max-w-4xl px-6 pt-16 pb-20 text-center sm:pt-24">
        <h1 className="text-balance text-4xl font-semibold leading-[1.1] tracking-tight sm:text-6xl">
          Everything you own,
          <span className="block text-primary">easy to find.</span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
          Closette holds a list of your clothes and the spot each one is kept in. It checks the
          weather before it offers an outfit. It passes over what you wore this week. See the
          outfit on your own photo first.
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

      <section className="relative border-t border-border bg-muted/30 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <CalendarDays className="size-4" />
            Every morning
          </div>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
            Four steps, start to finish.
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

      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 text-sm text-muted-foreground sm:flex-row">
          <span>Closette</span>
          <Link href="/register" className="hover:text-foreground">
            Create your closet
          </Link>
        </div>
      </footer>
    </main>
  );
}
