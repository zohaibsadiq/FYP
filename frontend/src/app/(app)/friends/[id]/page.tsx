"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, HandHeart, Shirt } from "lucide-react";
import { toast } from "sonner";

import { BorrowDialog } from "@/components/friends/borrow-dialog";
import { Initials } from "@/components/friends/initials";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { GarmentPicture } from "@/components/wardrobe/garment-picture";
import { useFriendCloset, useFriends } from "@/hooks/use-friends";
import { getErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { GarmentToBorrow } from "@/types/friends";

/**
 * One friend's shelf.
 *
 * Everything here came from a serializer written for friends only, so there is
 * nothing to show about price, wear count or where a thing is kept - the page
 * could not display them if it wanted to.
 */
export default function FriendClosetPage() {
  const params = useParams<{ id: string }>();
  const friendId = Number(params.id);

  const [asking, setAsking] = useState<GarmentToBorrow | null>(null);

  const { data: friends } = useFriends();
  const friend = (friends ?? []).find((one) => one.id === friendId);
  const { data: items, isPending, isError, error } = useFriendCloset(friendId);

  const free = (items ?? []).filter((item) => item.availability === "Free").length;

  return (
    <div className="relative mx-auto max-w-5xl space-y-6">
      <div aria-hidden className="pointer-events-none absolute -top-24 right-0 -z-10 h-72 w-full overflow-hidden">
        <div className="animate-drift absolute -top-10 right-10 size-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="animate-drift absolute left-1/3 top-6 size-56 rounded-full bg-chart-2/10 blur-3xl [animation-delay:-8s]" />
      </div>

      <div>
        <Link href="/friends" className={cn(buttonVariants({ variant: "ghost" }), "-ml-2 gap-2")}>
          <ArrowLeft className="size-4" aria-hidden />
          Back to my friends
        </Link>

        <header className="animate-in fade-in slide-in-from-bottom-2 mt-3 flex flex-wrap items-center gap-4 duration-500">
          {friend ? (
            <Initials name={friend.nickname} id={friend.person.id} className="size-14 text-lg" />
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-primary">A friend&apos;s closet</p>
            <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              {friend ? `What ${friend.nickname} can lend` : "What they can lend"}
            </h1>
            <p className="mt-2 max-w-prose text-muted-foreground">
              Ask for anything here. They can say yes or no, and nothing is charged.
            </p>
          </div>
        </header>
      </div>

      {!isPending && !isError ? (
        <p className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm duration-500 [animation-delay:60ms]">
          <HandHeart className="size-4 shrink-0 text-primary" aria-hidden />
          <span>
            <span className="font-medium">
              {free} {free === 1 ? "thing" : "things"} free to borrow right now.
            </span>{" "}
            <span className="text-muted-foreground">
              Tap Ask to borrow, pick the days, and they get your request.
            </span>
          </span>
        </p>
      ) : null}

      {isError ? (
        <p
          role="alert"
          className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm"
        >
          {getErrorMessage(error, "Their things could not be loaded just now.")}
        </p>
      ) : isPending ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4" aria-busy>
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton key={index} className="aspect-3/5 rounded-2xl" />
          ))}
        </div>
      ) : (items ?? []).length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Shirt className="size-6" aria-hidden />
          </span>
          <p className="mt-3 font-medium">Nothing to lend right now</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            They have not left anything switched on for lending, or it is all out already.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {(items ?? []).map((item, index) => (
            <li
              key={item.id}
              className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500"
              style={{ animationDelay: `${Math.min(index, 7) * 40}ms` }}
            >
              <BorrowCard item={item} onAsk={setAsking} />
            </li>
          ))}
        </ul>
      )}

      <BorrowDialog
        item={asking}
        friendName={friend?.nickname ?? "your friend"}
        onClose={() => setAsking(null)}
        onSent={() => {
          setAsking(null);
          toast.success("Asked. You will see their answer on the friends page.");
        }}
      />
    </div>
  );
}

function BorrowCard({
  item,
  onAsk,
}: {
  item: GarmentToBorrow;
  onAsk: (item: GarmentToBorrow) => void;
}) {
  const free = item.availability === "Free";

  return (
    <article
      className={cn(
        "group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all duration-300",
        free && "hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10",
        !free && "opacity-80",
      )}
    >
      <div className="relative aspect-4/5 overflow-hidden bg-gradient-to-b from-muted/80 to-muted/20">
        <div className="absolute inset-0 transition-transform duration-500 ease-out group-hover:scale-105">
          <GarmentPicture
            src={item.display_image_url}
            sizes="(min-width: 1024px) 25vw, 50vw"
            className={cn("p-4", !free && "opacity-60")}
          />
        </div>
        {!free ? (
          <Badge variant="secondary" className="absolute left-2 top-2 bg-card/90 shadow-sm backdrop-blur">
            {item.availability}
          </Badge>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-3.5">
        <p className="truncate text-sm font-semibold">{item.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {[item.brand, item.size, item.primary_color_name].filter(Boolean).join(", ") ||
            item.category_name}
        </p>

        <Button
          type="button"
          onClick={() => onAsk(item)}
          disabled={!free}
          className={cn("mt-3 h-10 w-full rounded-xl", free && "shadow-md shadow-primary/20")}
        >
          {free ? "Ask to borrow" : item.availability}
        </Button>
      </div>
    </article>
  );
}
