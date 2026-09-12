"use client";

import { CalendarDays, MapPin, Plus, Shirt, WashingMachine } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser } from "@/hooks/use-auth";

const STAT_CARDS = [
  { label: "Items", value: "0", icon: Shirt },
  { label: "In the wash", value: "0", icon: WashingMachine },
  { label: "Storage spots", value: "0", icon: MapPin },
  { label: "Days planned", value: "0", icon: CalendarDays },
];

export default function DashboardPage() {
  const { data: user, isPending } = useCurrentUser();

  return (
    <div className="mx-auto max-w-6xl space-y-8">
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
                ? `Your account is set up for ${user.city}.`
                : "Your account is set up."}
            </p>
          </>
        )}
      </div>

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

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base">Add your first item</CardTitle>
          <CardDescription>
            Pick one thing you wear often. Take a photo of it and write down the shelf or drawer it
            is kept in. Outfit picks start once a few items are in.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-start gap-3">
          <Button disabled aria-describedby="add-item-note">
            <Plus className="size-4" />
            Add an item
          </Button>
          <p id="add-item-note" className="text-sm text-muted-foreground">
            This turns on when the closet opens.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
