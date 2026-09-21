"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Shirt } from "lucide-react";
import { toast } from "sonner";

import { BorrowDialog } from "@/components/friends/borrow-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useFriendCloset, useFriends } from "@/hooks/use-friends";
import { getErrorMessage } from "@/lib/api";
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

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link
          href="/friends"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to my friends
        </Link>

        <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
          {friend ? `What ${friend.nickname} can lend` : "What they can lend"}
        </h1>
        <p className="mt-2 text-muted-foreground">
          Ask for anything here. They can say yes or no, and nothing is charged.
        </p>
      </div>

      {isError ? (
        <p
          role="alert"
          className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm"
        >
          {getErrorMessage(error, "Their things could not be loaded just now.")}
        </p>
      ) : isPending ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton key={index} className="aspect-[3/4] rounded-xl" />
          ))}
        </div>
      ) : (items ?? []).length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <Shirt className="mx-auto size-8 text-muted-foreground" aria-hidden />
          <p className="mt-3 font-medium">Nothing to lend right now</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            They have not left anything switched on for lending, or it is all out already.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {(items ?? []).map((item) => (
            <li key={item.id}>
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
    <article className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card">
      <div className="relative aspect-square bg-muted/40">
        {item.display_image_url ? (
          <Image
            src={item.display_image_url}
            alt=""
            fill
            sizes="(min-width: 1024px) 25vw, 50vw"
            className="object-contain p-2"
          />
        ) : (
          <span className="flex h-full items-center justify-center">
            <Shirt className="size-8 text-muted-foreground" aria-hidden />
          </span>
        )}
        {!free ? (
          <Badge variant="secondary" className="absolute left-2 top-2">
            {item.availability}
          </Badge>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-3">
        <p className="truncate font-medium">{item.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {[item.brand, item.size, item.primary_color_name].filter(Boolean).join(" · ") ||
            item.category_name}
        </p>

        <Button
          type="button"
          onClick={() => onAsk(item)}
          disabled={!free}
          className="mt-3 h-11 w-full"
        >
          {free ? "Ask to borrow" : item.availability}
        </Button>
      </div>
    </article>
  );
}
