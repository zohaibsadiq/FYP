"use client";

/**
 * /dashboard
 *
 * Right now this proves the end-to-end chain works:
 *   browser -> JWT token -> Django /api/auth/me/ -> real user data on screen.
 *
 * Each placeholder card below becomes a real feature in a later phase. They are
 * here on purpose: you can see the finished shape of the app from day one, and
 * so can your supervisor.
 */

import {
  CalendarDays,
  CloudSun,
  MapPin,
  Scan,
  Shirt,
  Sparkles,
  WashingMachine,
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser } from "@/hooks/use-auth";

const STAT_CARDS = [
  { label: "Items owned", value: "—", icon: Shirt, phase: 2 },
  { label: "In the wash", value: "—", icon: WashingMachine, phase: 2 },
  { label: "Storage spots", value: "—", icon: MapPin, phase: 2 },
  { label: "Events planned", value: "—", icon: CalendarDays, phase: 3 },
];

const UPCOMING_FEATURES = [
  {
    icon: CloudSun,
    title: "Today's suggestion",
    body: "Once the weather API and the scoring engine are wired up, this card will propose a full outfit for today's forecast.",
    phase: "Phase 3–4",
  },
  {
    icon: Scan,
    title: "Virtual fitting room",
    body: "Pick a combination and see it rendered onto your own full-body photo before you get dressed.",
    phase: "Phase 5",
  },
  {
    icon: Sparkles,
    title: "Steal the look",
    body: "Upload any inspiration photo and the system finds the closest matches already hanging in your closet.",
    phase: "Phase 5",
  },
];

export default function DashboardPage() {
  const { data: user, isPending } = useCurrentUser();

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* ---------------- Greeting ---------------- */}
      <div>
        {isPending ? (
          <>
            <Skeleton className="h-9 w-72" />
            <Skeleton className="mt-3 h-5 w-96" />
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Good to see you, {user?.display_name}.
            </h1>
            <p className="mt-2 text-muted-foreground">
              {user?.city
                ? `Your wardrobe is set up for ${user.city}. Let's start filling it.`
                : "Add your city in settings so we can pull your local weather."}
            </p>
          </>
        )}
      </div>

      {/* ---------------- Quick stats ---------------- */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STAT_CARDS.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="text-2xl font-semibold tabular-nums">{value}</p>
                <p className="truncate text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ---------------- Connection confirmed ---------------- */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-base">Foundation is live</CardTitle>
          <CardDescription>
            This page loaded your real account from the Django API using a JWT
            token, which means authentication, CORS, the database and the frontend
            are all talking to each other correctly.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <Row label="Signed in as" value={user?.email ?? "…"} />
          <Row label="City" value={user?.city || "not set"} />
          <Row label="Body photo for try-on" value={user?.has_body_photo ? "uploaded" : "not yet"} />
          <Row
            label="Member since"
            value={
              user?.date_joined
                ? new Date(user.date_joined).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : "…"
            }
          />
        </CardContent>
      </Card>

      {/* ---------------- What comes next ---------------- */}
      <section>
        <h2 className="text-lg font-semibold tracking-tight">Coming in the next phases</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {UPCOMING_FEATURES.map(({ icon: Icon, title, body, phase }) => (
            <Card key={title} className="border-dashed">
              <CardHeader>
                <span className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                  <Icon className="size-5" />
                </span>
                <CardTitle className="mt-3 text-base">{title}</CardTitle>
                <CardDescription>{body}</CardDescription>
              </CardHeader>
              <CardContent>
                <span className="rounded-md bg-muted px-2 py-1 font-mono text-[11px] text-muted-foreground">
                  {phase}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/60 pb-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate font-medium">{value}</span>
    </div>
  );
}
