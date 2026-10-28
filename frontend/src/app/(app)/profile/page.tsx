"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Camera,
  Check,
  Eye,
  EyeOff,
  MapPin,
  Phone,
  Shirt,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser, useUpdateProfile } from "@/hooks/use-auth";
import { getErrorMessage, getFieldErrors } from "@/lib/api";
import { cn } from "@/lib/utils";
import { SHOPPING_FOR, SHOPPING_FOR_LABELS, type ShoppingFor, type User } from "@/types";

/** "Ayesha Khan" becomes "AK" for the big circle at the top. */
function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

/**
 * The few things about a person the app actually needs.
 *
 * The phone number is here because Buy and Sell hands it to one person when a
 * sale is agreed, and there was previously nowhere to type it in. The reason
 * it is asked for sits next to the box, because a field asking for a phone
 * number with no explanation is a field people rightly refuse.
 */
export default function ProfilePage() {
  const { data: me, isPending } = useCurrentUser();
  const update = useUpdateProfile();

  const [draft, setDraft] = useState<{
    full_name?: string;
    city?: string;
    phone?: string;
    shopping_for?: ShoppingFor;
  }>({});
  const [problem, setProblem] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  if (isPending || !me) {
    return (
      <div className="mx-auto max-w-4xl space-y-6" aria-busy>
        <Skeleton className="h-9 w-40" />
        <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <Skeleton className="h-72 rounded-3xl" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </div>
    );
  }

  const value = <K extends keyof typeof draft>(key: K, fallback: string) =>
    (draft[key] as string | undefined) ?? fallback;

  const chosen = draft.shopping_for ?? me.shopping_for;

  function save() {
    setProblem("");
    setFieldErrors({});
    update.mutate(draft, {
      onSuccess: () => {
        setDraft({});
        toast.success("Saved.");
      },
      onError: (error) => {
        setFieldErrors(getFieldErrors(error));
        setProblem(getErrorMessage(error, "That did not save. Try again."));
      },
    });
  }

  const unsaved = Object.keys(draft).length > 0;

  return (
    <div className="relative mx-auto max-w-4xl space-y-6">
      <div aria-hidden className="pointer-events-none absolute -top-24 right-0 -z-10 h-72 w-full overflow-hidden">
        <div className="animate-drift absolute -top-10 right-10 size-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="animate-drift absolute left-1/3 top-6 size-56 rounded-full bg-chart-4/15 blur-3xl [animation-delay:-8s]" />
      </div>

      <header className="animate-in fade-in slide-in-from-bottom-2 duration-500">
        <p className="text-sm font-medium text-primary">Your account</p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          My details
        </h1>
        <p className="mt-2 max-w-prose text-muted-foreground">
          Used for the weather where you are, and for arranging a sale.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <div>
          <div className="lg:sticky lg:top-6">
            <IdentityCard me={me} />
          </div>
        </div>

        <div className="space-y-5">
          <Panel icon={UserRound} title="About you">
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="profile-name">Your name</Label>
                <Input
                  id="profile-name"
                  value={value("full_name", me.full_name)}
                  onChange={(event) => setDraft({ ...draft, full_name: event.target.value })}
                  aria-invalid={Boolean(fieldErrors.full_name)}
                />
                <p className="text-xs text-muted-foreground">
                  Shown to anybody who sees something you are selling.
                </p>
                {fieldErrors.full_name ? (
                  <p className="text-xs text-destructive">{fieldErrors.full_name}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="profile-email">Email</Label>
                <Input id="profile-email" value={me.email} disabled />
                <p className="text-xs text-muted-foreground">
                  This is how you sign in, so it cannot be changed here.
                </p>
              </div>
            </div>
          </Panel>

          <Panel icon={MapPin} title="Where you are and how to reach you">
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="profile-city">City</Label>
                <Input
                  id="profile-city"
                  value={value("city", me.city)}
                  onChange={(event) => setDraft({ ...draft, city: event.target.value })}
                  placeholder="Lahore"
                  aria-invalid={Boolean(fieldErrors.city)}
                />
                <p className="text-xs text-muted-foreground">
                  Gets your weather, and lets people find things for sale near them.
                </p>
                {fieldErrors.city ? (
                  <p className="text-xs text-destructive">{fieldErrors.city}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="profile-phone">Phone number</Label>
                <Input
                  id="profile-phone"
                  type="tel"
                  inputMode="tel"
                  value={value("phone", me.phone)}
                  onChange={(event) => setDraft({ ...draft, phone: event.target.value })}
                  placeholder="0300 1234567"
                  aria-invalid={Boolean(fieldErrors.phone)}
                />
                <p className="flex items-start gap-2 rounded-xl bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  <Phone className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
                  <span>
                    Never shown on a listing and never searchable. It is given to one person only,
                    at the moment you agree to buy or sell something with them.
                  </span>
                </p>
                {fieldErrors.phone ? (
                  <p className="text-xs text-destructive">{fieldErrors.phone}</p>
                ) : null}
              </div>
            </div>
          </Panel>

          <Panel icon={Shirt} title="What you see first">
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Whose clothes do you want to see?</legend>
              <p className="text-xs text-muted-foreground">
                Only decides what each page opens on. You can switch to anything else at any
                time.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {SHOPPING_FOR.map((option) => {
                  const on = chosen === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setDraft({ ...draft, shopping_for: option })}
                      aria-pressed={on}
                      className={cn(
                        "flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-all duration-200",
                        "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                        on
                          ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/20"
                          : "border-border bg-card hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5",
                      )}
                    >
                      {on ? <Check className="size-4 shrink-0" aria-hidden /> : null}
                      {SHOPPING_FOR_LABELS[option]}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </Panel>

          {problem ? (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm"
            >
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
              {problem}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              onClick={save}
              disabled={!unsaved || update.isPending}
              className={cn("h-12 w-full sm:w-auto sm:px-8", unsaved && "shadow-lg shadow-primary/20")}
            >
              {update.isPending ? "Saving..." : unsaved ? "Save changes" : "Nothing to save"}
            </Button>
            {unsaved ? (
              <p className="text-sm text-muted-foreground" aria-live="polite">
                You have changes that are not saved yet.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Who this account is, at a glance, with the switches that live on other pages. */
function IdentityCard({ me }: { me: User }) {
  const since = new Date(me.date_joined).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });

  return (
    <aside className="animate-in fade-in zoom-in-95 overflow-hidden rounded-3xl border border-border bg-card duration-500">
      <div className="bg-gradient-to-br from-primary/15 via-card to-chart-4/15 px-5 pb-5 pt-6 text-center">
        <span
          aria-hidden
          className="mx-auto flex size-20 items-center justify-center rounded-full bg-gradient-to-br from-primary to-chart-1 font-display text-2xl font-semibold text-primary-foreground shadow-lg shadow-primary/30"
        >
          {initials(me.display_name) || "?"}
        </span>
        <p className="mt-4 font-display text-xl font-semibold tracking-tight">
          {me.full_name || me.display_name}
        </p>
        <p className="mt-1 truncate text-sm text-muted-foreground">{me.email}</p>
        <p className="mt-2 text-xs text-muted-foreground">With My Closette since {since}</p>
      </div>

      <ul className="divide-y divide-border">
        <Fact icon={MapPin}>
          {me.city ? `${me.city}${me.country_code ? `, ${me.country_code}` : ""}` : "No city saved yet"}
        </Fact>
        <Fact icon={Shirt}>Shows {SHOPPING_FOR_LABELS[me.shopping_for].toLowerCase()} first</Fact>
        <Fact icon={me.shares_closet ? Eye : EyeOff} href="/friends">
          {me.shares_closet ? "Friends can see what you lend" : "Closet hidden from friends"}
        </Fact>
        <Fact icon={Camera} href="/try-on">
          {me.has_body_photo ? "Try-on photo saved" : "No try-on photo yet"}
        </Fact>
      </ul>
    </aside>
  );
}

/** One line of the identity card. With a link, it goes to the page that changes it. */
function Fact({
  icon: Icon,
  href,
  children,
}: {
  icon: typeof MapPin;
  href?: string;
  children: React.ReactNode;
}) {
  const inner = (
    <>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {href ? <span className="text-xs font-medium text-primary">Change</span> : null}
    </>
  );

  return (
    <li className="text-sm">
      {href ? (
        <Link href={href} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50">
          {inner}
        </Link>
      ) : (
        <span className="flex items-center gap-3 px-4 py-3">{inner}</span>
      )}
    </li>
  );
}

/** One box of the form, with a small icon and a title. */
function Panel({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof MapPin;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="animate-in fade-in slide-in-from-bottom-2 rounded-2xl border border-border bg-card p-5 duration-500 sm:p-6">
      <h2 className="mb-5 flex items-center gap-3 font-display text-lg font-semibold tracking-tight">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="size-4" aria-hidden />
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}
