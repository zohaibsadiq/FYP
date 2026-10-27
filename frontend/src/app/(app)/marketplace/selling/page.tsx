"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Check, Store, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { EnquiryCard } from "@/components/market/enquiry-card";
import { SellDialog } from "@/components/market/sell-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GarmentPicture } from "@/components/wardrobe/garment-picture";
import {
  useAnswerEnquiry,
  useMarkSold,
  useMyEnquiries,
  useMyListings,
  useReceivedEnquiries,
  useWithdrawEnquiry,
  useWithdrawListing,
} from "@/hooks/use-market";
import { getErrorMessage } from "@/lib/api";
import { money } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { Enquiry, MyListing } from "@/types/market";

export default function SellingPage() {
  const [selling, setSelling] = useState(false);

  const { data: listings, isPending: listingsLoading } = useMyListings();
  const { data: received, isPending: receivedLoading } = useReceivedEnquiries();
  const { data: sent, isPending: sentLoading } = useMyEnquiries();

  const answer = useAnswerEnquiry();
  const withdrawEnquiry = useWithdrawEnquiry();

  const waiting = (received ?? []).filter((one) => one.status === "SENT");

  function complain(error: unknown) {
    toast.error(getErrorMessage(error, "That did not work. Try again."));
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link
          href="/marketplace"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to everything for sale
        </Link>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              My selling and requests
            </h1>
            <p className="mt-2 text-muted-foreground">
              What you have up for sale, who has asked for it, and what you have asked
              other people for.
            </p>
          </div>

          <Button type="button" onClick={() => setSelling(true)} className="h-11 px-5">
            Sell something
          </Button>
        </div>
      </div>

      <Tabs defaultValue="requests">
        <TabsList className="w-full">
          <TabsTrigger value="requests" className="flex-1 gap-2">
            Requests for me
            {waiting.length > 0 ? (
              <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                {waiting.length}
              </span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="listings" className="flex-1">
            Things I am selling
          </TabsTrigger>
          <TabsTrigger value="asked" className="flex-1">
            Things I asked for
          </TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="mt-4 space-y-3 duration-200 animate-in fade-in slide-in-from-bottom-1">
          {receivedLoading ? (
            <Loading />
          ) : (received ?? []).length === 0 ? (
            <Empty
              title="Nobody has asked yet"
              detail="When somebody wants something you are selling, it appears here."
            />
          ) : (
            (received ?? []).map((enquiry) => (
              <EnquiryCard
                key={enquiry.id}
                enquiry={enquiry}
                side="seller"
                busy={answer.isPending}
                onAccept={(one) =>
                  answer.mutate(
                    { id: one.id, answer: "accept" },
                    {
                      onSuccess: () => toast.success("Agreed. You can both see each other now."),
                      onError: complain,
                    },
                  )
                }
                onDecline={(one) =>
                  answer.mutate(
                    { id: one.id, answer: "decline" },
                    { onSuccess: () => toast.success("Declined."), onError: complain })
                }
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="listings" className="mt-4 space-y-3 duration-200 animate-in fade-in slide-in-from-bottom-1">
          {listingsLoading ? (
            <Loading />
          ) : (listings ?? []).length === 0 ? (
            <Empty
              title="You are not selling anything"
              detail="Anything in your closet can go up in a few taps."
              action={
                <Button type="button" onClick={() => setSelling(true)} className="mt-4 h-11">
                  Sell something
                </Button>
              }
            />
          ) : (
            (listings ?? []).map((listing) => (
              <MyListingRow key={listing.id} listing={listing} onProblem={complain} />
            ))
          )}
        </TabsContent>

        <TabsContent value="asked" className="mt-4 space-y-3 duration-200 animate-in fade-in slide-in-from-bottom-1">
          {sentLoading ? (
            <Loading />
          ) : (sent ?? []).length === 0 ? (
            <Empty
              title="You have not asked for anything"
              detail="Find something you like and tap Ask to buy."
              action={
                <Link
                  href="/marketplace"
                  className={cn(buttonVariants({ variant: "outline" }), "mt-4 h-11")}
                >
                  Have a look
                </Link>
              }
            />
          ) : (
            (sent ?? []).map((enquiry: Enquiry) => (
              <EnquiryCard
                key={enquiry.id}
                enquiry={enquiry}
                side="buyer"
                busy={withdrawEnquiry.isPending}
                onWithdraw={(one) =>
                  withdrawEnquiry.mutate(one.id, {
                    onSuccess: () => toast.success("Request withdrawn."),
                    onError: complain,
                  })
                }
              />
            ))
          )}
        </TabsContent>
      </Tabs>

      <SellDialog open={selling} onOpenChange={setSelling} />
    </div>
  );
}

function MyListingRow({
  listing,
  onProblem,
}: {
  listing: MyListing;
  onProblem: (error: unknown) => void;
}) {
  const sold = useMarkSold();
  const withdraw = useWithdrawListing();
  const open = listing.status === "ACTIVE" || listing.status === "RESERVED";

  return (
    <article className="rounded-xl border border-border p-3">
      <div className="flex gap-3">
        <span className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
          <GarmentPicture src={listing.item.display_image_url} sizes="64px" className="p-1" iconClassName="size-5" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2">
            <span className="truncate font-medium">{listing.item.name}</span>
            <Badge variant={listing.status === "ACTIVE" ? "default" : "secondary"}>
              {listing.status_label}
            </Badge>
          </p>
          <p className="text-sm tabular-nums">
            {money(listing.asking_price, listing.currency)}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {listing.condition_label}
            {listing.city ? ` - ${listing.city}` : ""}
            {listing.enquiry_count > 0
              ? ` - ${listing.enquiry_count} ${listing.enquiry_count === 1 ? "person has" : "people have"} asked`
              : " - nobody has asked yet"}
          </p>
        </div>
      </div>

      {open ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() =>
              sold.mutate(listing.id, {
                onSuccess: () => toast.success("Marked sold. It has left your closet."),
                onError: onProblem,
              })
            }
            disabled={sold.isPending}
            className="h-11 flex-1 gap-2"
          >
            <Check className="size-4" aria-hidden />
            Sold
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              withdraw.mutate(listing.id, {
                onSuccess: () => toast.success("Taken down. It is back in your closet."),
                onError: onProblem,
              })
            }
            disabled={withdraw.isPending}
            className="h-11 flex-1 gap-2"
          >
            <Undo2 className="size-4" aria-hidden />
            Take it down
          </Button>
        </div>
      ) : null}
    </article>
  );
}

function Loading() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <Skeleton key={index} className="h-24 w-full rounded-xl" />
      ))}
    </div>
  );
}

function Empty({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border p-10 text-center">
      <Store className="mx-auto size-8 text-muted-foreground" aria-hidden />
      <p className="mt-3 font-medium">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{detail}</p>
      {action}
    </div>
  );
}
