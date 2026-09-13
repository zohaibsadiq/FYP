"use client";

import Link from "next/link";
import { CalendarCheck, MapPin, Plus, Shirt, WashingMachine } from "lucide-react";

import { ForgottenItems } from "@/components/wardrobe/forgotten-items";
import { ItemCard } from "@/components/wardrobe/item-card";
import { RecentWears } from "@/components/wardrobe/recent-wears";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser } from "@/hooks/use-auth";
import { useGarments, useWardrobeStats } from "@/hooks/use-wardrobe";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const { data: user, isPending: userPending } = useCurrentUser();
  const { data: stats, isPending: statsPending } = useWardrobeStats();
  const { data: recent } = useGarments({ ordering: "-created_at" });

  const isEmpty = !statsPending && (stats?.total ?? 0) === 0;

  const tiles = [
    { label: "Things you own", value: stats?.total, icon: Shirt },
    { label: "In the wash", value: stats?.in_laundry, icon: WashingMachine },
    { label: "Places you keep them", value: stats?.storage_locations, icon: MapPin },
    { label: "Worn this week", value: stats?.worn_this_week, icon: CalendarCheck },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        {userPending ? (
          <>
            <Skeleton className="h-9 w-72" />
            <Skeleton className="mt-3 h-5 w-96" />
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Hello, {user?.display_name}
            </h1>
            <p className="mt-2 text-muted-foreground">
              {isEmpty
                ? "Let us get your clothes into the app."
                : "Here is what is in your closet today."}
            </p>
          </>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                {statsPending ? (
                  <Skeleton className="h-8 w-10" />
                ) : (
                  <p className="text-2xl font-semibold tabular-nums">{value ?? 0}</p>
                )}
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {isEmpty ? (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-base">Start with one item</CardTitle>
            <CardDescription className="max-w-prose">
              Pick something you wear often. Take a photo of it on a plain surface, then write down
              the drawer or shelf you keep it in. Do that a few times and the app can start
              suggesting what to wear.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/closet/add"
              className={cn(buttonVariants({ size: "lg" }), "h-11 gap-2 px-5")}
            >
              <Plus className="size-5" aria-hidden />
              Add my first item
            </Link>
          </CardContent>
        </Card>
      ) : (
        <section>
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-lg font-semibold tracking-tight">Added recently</h2>
            <Link href="/closet" className="text-sm font-medium text-primary hover:underline">
              See all my clothes
            </Link>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {recent?.results.slice(0, 4).map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      )}

      {isEmpty ? null : (
        <>
          <RecentWears />
          <ForgottenItems />
        </>
      )}
    </div>
  );
}
