import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Camera,
  CloudSun,
  HandHeart,
  Lock,
  MapPin,
  Scan,
  ShieldCheck,
  Shirt,
  Store,
  Tag,
  Users,
} from "lucide-react";

import { Brand } from "@/components/marketing/brand";
import { ClosetPreview } from "@/components/marketing/closet-preview";
import { Reveal } from "@/components/marketing/reveal";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SHOPS = [
  "Outfitters",
  "Limelight",
  "Gul Ahmed",
  "Bonanza Satrangi",
  "Beechtree",
  "Generation",
  "Junaid Jamshed",
  "Almirah",
];

const FEATURES = [
  {
    icon: Shirt,
    title: "My Clothes",
    body: "Photograph a thing once. The background is cut away, the colour is named, and it joins your closet with its brand, size and price.",
    wide: true,
  },
  {
    icon: MapPin,
    title: "Where Things Are",
    body: "Room, wardrobe, drawer. Look something up and walk straight to it.",
  },
  {
    icon: CloudSun,
    title: "Weather and Plans",
    body: "Today's weather for your city, plain advice on what suits it, and a calendar for the days ahead.",
  },
  {
    icon: Tag,
    title: "Sales",
    body: "What is reduced right now at eight real shops, checked twice a day, with the price history of every product.",
    wide: true,
  },
  {
    icon: Store,
    title: "Buy and Sell",
    body: "Sell what you no longer wear to other members. Contact details are shared only once you say yes.",
  },
  {
    icon: Users,
    title: "Borrow from Friends",
    body: "See what a friend is happy to lend, ask for it with dates, and never lose track of who has what.",
  },
];

const TRY_ON_POINTS = [
  "Pick anything from your closet, or a photo of something in a shop",
  "A picture comes back in two to four minutes",
  "Your photo is yours: delete it and every picture made from it goes too",
];

const STEPS = [
  { icon: Camera, title: "Add a photo", body: "One picture per item. The background disappears on its own." },
  { icon: MapPin, title: "Say where it lives", body: "The room, the wardrobe, the drawer." },
  { icon: CalendarDays, title: "Wear it and plan it", body: "One tap records a wearing. The calendar plans the week." },
  { icon: Scan, title: "See it on you", body: "Try something on your own photo in a few minutes." },
];

const NUMBERS = [
  { value: "8", label: "real shops, read twice a day" },
  { value: "7,500+", label: "products with a price history" },
  { value: "34", label: "kinds of clothing, kurta to khussa" },
  { value: "1 tap", label: "to record what you wore" },
];

const PROMISES = [
  {
    icon: Lock,
    title: "Private until you say otherwise",
    body: "Nothing in your closet is shown to anybody. Friends see only what you switch on.",
  },
  {
    icon: ShieldCheck,
    title: "No phone numbers in the open",
    body: "Buying and lending share contact details only after you accept the other person.",
  },
  {
    icon: HandHeart,
    title: "Your photo, your call",
    body: "A try-on photo is used only to draw clothes on you, and deleting it removes every picture made from it.",
  },
];

const QUESTIONS = [
  {
    q: "Does it cost anything?",
    a: "No. Creating a closet and using every part of it is free.",
  },
  {
    q: "Do I have to photograph everything?",
    a: "No. A photo makes things easier to find, but any item can be added without one and given a photo later.",
  },
  {
    q: "Who can see my clothes?",
    a: "Only you, unless you choose to share your closet with a friend you added by code. There is no search for people.",
  },
  {
    q: "Where do the sale prices come from?",
    a: "From what each shop publishes about its own products. Prices are checked twice a day and every one carries the time it was last checked.",
  },
  {
    q: "Does buying and selling happen inside the app?",
    a: "The app introduces you. You agree the price and hand the thing over in person.",
  },
];

export default function LandingPage() {
  return (
    <main className="relative overflow-x-hidden">
      <Backdrop />

      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5 sm:px-6">
          <Brand />
          <nav aria-label="Page sections" className="hidden items-center gap-1 md:flex">
            {[
              ["#features", "What it does"],
              ["#how", "How it works"],
              ["#privacy", "Privacy"],
              ["#questions", "Questions"],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className={cn(buttonVariants({ variant: "ghost" }), "h-10 px-4")}>
              Sign in
            </Link>
            <Link href="/register" className={cn(buttonVariants(), "h-10 gap-2 px-4")}>
              Get started
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </div>
      </header>

      <section className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10 lg:pb-28 lg:pt-24">
        <div>
          <p className="animate-in fade-in slide-in-from-bottom-2 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-medium text-muted-foreground duration-700">
            <span className="size-1.5 rounded-full bg-chart-3" aria-hidden />
            Made for closets in Pakistan
          </p>

          <h1 className="animate-in fade-in slide-in-from-bottom-3 mt-6 font-display text-[2.6rem] font-semibold leading-[1.05] tracking-tight duration-700 fill-mode-both [animation-delay:80ms] sm:text-6xl lg:text-[4.25rem]">
            Everything you own,
            <span className="block text-primary italic">easy to find.</span>
          </h1>

          <p className="animate-in fade-in slide-in-from-bottom-3 mt-6 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground duration-700 fill-mode-both [animation-delay:160ms] sm:text-lg">
            My Closette keeps a picture of every piece of clothing you own, remembers the drawer it
            is kept in, and counts what you really wear. Around that it watches shop prices,
            lets you sell or lend what sits unworn, and shows a garment on your own photo before
            you decide.
          </p>

          <div className="animate-in fade-in slide-in-from-bottom-3 mt-9 flex flex-col gap-3 duration-700 fill-mode-both [animation-delay:240ms] sm:flex-row">
            <Link
              href="/register"
              className={cn(
                buttonVariants({ size: "lg" }),
                "h-12 gap-2 px-6 text-base shadow-lg shadow-primary/20 transition-transform hover:-translate-y-0.5",
              )}
            >
              Create your closet
              <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link
              href="/login"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-12 px-6 text-base")}
            >
              I already have an account
            </Link>
          </div>

          <p className="animate-in fade-in mt-5 text-sm text-muted-foreground duration-700 fill-mode-both [animation-delay:320ms]">
            Free to use. Nothing is ever posted anywhere on your behalf.
          </p>
        </div>

        <div className="animate-in fade-in zoom-in-95 relative mx-auto w-full max-w-md duration-1000 fill-mode-both [animation-delay:200ms] lg:max-w-none">
          <ClosetPreview />
        </div>
      </section>

      <section aria-label="Shops whose prices are watched" className="border-y border-border/60 bg-card/60 py-5">
        <div className="mx-auto max-w-6xl px-5 sm:px-6">
          <p className="mb-3 text-center text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Watches the prices at
          </p>
          <div className="relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
            <ul className="animate-marquee flex w-max gap-3 hover:[animation-play-state:paused]">
              {[...SHOPS, ...SHOPS].map((shop, index) => (
                <li
                  key={`${shop}-${index}`}
                  aria-hidden={index >= SHOPS.length}
                  className="rounded-full border border-border bg-background px-4 py-2 font-display text-sm font-medium whitespace-nowrap"
                >
                  {shop}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section id="features" className="relative mx-auto max-w-6xl scroll-mt-20 px-5 py-20 sm:px-6 lg:py-28">
        <Reveal>
          <p className="text-sm font-medium text-primary">What it does</p>
          <h2 className="mt-2 max-w-2xl font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            One place for everything that happens to your clothes.
          </h2>
        </Reveal>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, body, wide }, index) => (
            <Reveal key={title} delay={index * 60} className={cn(wide && "lg:col-span-2")}>
              <article className="group h-full rounded-2xl border border-border bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10">
                <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon className="size-5" aria-hidden />
                </span>
                <h3 className="mt-5 font-display text-xl font-semibold tracking-tight">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </article>
            </Reveal>
          ))}

          <Reveal delay={360} className="sm:col-span-2 lg:col-span-4">
            <article className="group relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-[var(--chart-2)]/10 p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10 sm:p-8">
              <div
                aria-hidden
                className="animate-drift absolute -right-24 -top-24 size-72 rounded-full bg-primary/15 blur-3xl"
              />
              <div className="relative grid gap-6 lg:grid-cols-[1.1fr_1fr] lg:items-center">
                <div>
                  <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                    <Scan className="size-5" aria-hidden />
                  </span>
                  <h3 className="mt-5 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
                    Try It On
                  </h3>
                  <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground sm:text-base">
                    See a garment on your own full-length photo before you decide to wear it, buy it or
                    borrow it.
                  </p>
                </div>
                <ul className="space-y-3">
                  {TRY_ON_POINTS.map((point) => (
                    <li key={point} className="flex items-start gap-3 rounded-xl border border-border/70 bg-card/80 px-4 py-3 text-sm backdrop-blur">
                      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Scan className="size-3" aria-hidden />
                      </span>
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          </Reveal>
        </div>
      </section>

      <section id="how" className="relative scroll-mt-20 border-y border-border/60 bg-card/60 py-20 lg:py-28">
        <div className="mx-auto max-w-6xl px-5 sm:px-6">
          <Reveal>
            <p className="text-sm font-medium text-primary">How it works</p>
            <h2 className="mt-2 max-w-2xl font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Four steps, and the first one takes a minute.
            </h2>
          </Reveal>

          <ol className="relative mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div
              aria-hidden
              className="absolute left-6 right-6 top-6 hidden h-px bg-gradient-to-r from-transparent via-border to-transparent lg:block"
            />
            {STEPS.map(({ icon: Icon, title, body }, index) => (
              <Reveal key={title} delay={index * 90}>
                <li className="relative">
                  <span className="relative z-10 flex size-12 items-center justify-center rounded-full border border-border bg-background text-primary shadow-sm">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <p className="mt-4 font-mono text-xs text-muted-foreground">Step {index + 1}</p>
                  <h3 className="mt-1 font-display text-lg font-semibold tracking-tight">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-6">
        <dl className="grid gap-6 rounded-3xl border border-border bg-card p-8 sm:grid-cols-2 lg:grid-cols-4">
          {NUMBERS.map(({ value, label }, index) => (
            <Reveal key={label} delay={index * 60}>
              <div>
                <dt className="order-last mt-1 text-sm text-muted-foreground">{label}</dt>
                <dd className="font-display text-4xl font-semibold tracking-tight text-primary">{value}</dd>
              </div>
            </Reveal>
          ))}
        </dl>
      </section>

      <section id="privacy" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-16 sm:px-6 lg:py-24">
        <Reveal>
          <p className="text-sm font-medium text-primary">Privacy</p>
          <h2 className="mt-2 max-w-2xl font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            A closet is personal. The app treats it that way.
          </h2>
        </Reveal>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {PROMISES.map(({ icon: Icon, title, body }, index) => (
            <Reveal key={title} delay={index * 80}>
              <div className="flex h-full gap-4 rounded-2xl border border-border bg-card p-6">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-chart-2/15 text-chart-2">
                  <Icon className="size-5" aria-hidden />
                </span>
                <div>
                  <h3 className="font-semibold tracking-tight">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="questions" className="mx-auto max-w-3xl scroll-mt-20 px-5 py-16 sm:px-6 lg:py-24">
        <Reveal>
          <p className="text-sm font-medium text-primary">Questions</p>
          <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Things people ask first.
          </h2>
        </Reveal>
        <div className="mt-8 divide-y divide-border rounded-2xl border border-border bg-card">
          {QUESTIONS.map(({ q, a }, index) => (
            <Reveal key={q} delay={index * 50}>
              <details className="group px-6 py-4 open:bg-muted/40">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
                  {q}
                  <span
                    aria-hidden
                    className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="pb-2 pt-3 text-sm leading-relaxed text-muted-foreground">{a}</p>
              </details>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-20 sm:px-6">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-primary px-6 py-14 text-center text-primary-foreground sm:px-12 lg:py-20">
            <div
              aria-hidden
              className="animate-drift absolute -right-20 -top-24 size-80 rounded-full bg-white/15 blur-3xl"
            />
            <div
              aria-hidden
              className="animate-drift absolute -bottom-28 -left-16 size-72 rounded-full bg-chart-5/40 blur-3xl [animation-delay:-9s]"
            />
            <h2 className="relative font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Start with one item.
            </h2>
            <p className="relative mx-auto mt-3 max-w-xl text-pretty text-primary-foreground/85">
              Pick something you wear often, take a photo, and write down the drawer it lives in.
              The rest follows from there.
            </p>
            <div className="relative mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/register"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "h-12 gap-2 bg-white px-6 text-base text-primary hover:bg-white/90",
                )}
              >
                Create your closet
                <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link
                href="/login"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "h-12 border-white/40 bg-transparent px-6 text-base text-primary-foreground hover:bg-white/10 hover:text-primary-foreground",
                )}
              >
                Sign in
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-border/60 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <Brand />
          <nav aria-label="Footer" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <a href="#features" className="hover:text-foreground">What it does</a>
            <a href="#privacy" className="hover:text-foreground">Privacy</a>
            <Link href="/login" className="hover:text-foreground">Sign in</Link>
            <Link href="/register" className="hover:text-foreground">Create your closet</Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}

/** Soft colour behind the top of the page, slowly moving. */
function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[46rem] overflow-hidden">
      <div className="animate-drift absolute -top-32 left-[10%] size-[30rem] rounded-full bg-primary/15 blur-[110px]" />
      <div className="animate-drift absolute right-[5%] top-10 size-[26rem] rounded-full bg-chart-2/20 blur-[110px] [animation-delay:-6s]" />
      <div className="animate-drift absolute left-[45%] top-64 size-[22rem] rounded-full bg-chart-4/20 blur-[110px] [animation-delay:-12s]" />
    </div>
  );
}
