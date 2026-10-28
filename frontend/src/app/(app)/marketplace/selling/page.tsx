"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  Bell,
  Check,
  Handshake,
  MessageCircle,
  Plus,
  Send,
  Store,
  Tag,
  Undo2,
} from "lucide-react";
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

// The three things a seller does here, in the order they happen.
const HOW_TO_SELL = [
  {
    icon: Tag,
    title: "Put something up",
    body: "Pick it from your closet. Its photo and details come with it; you only add a price and how worn it is.",
  },
  {
    icon: MessageCircle,
    title: "Answer the people who ask",
    body: "Each request gets a yes or a no from you. Nothing is agreed until you say so.",
  },
  {
    icon: Handshake,
    title: "Meet, hand it over, mark it sold",
    body: "After a yes you both see each other's details. Pay each other directly, then tap Sold.",
  },
];

// On a phone the tabs scroll sideways inside their pill; on a wider screen
// they share the width.
const TAB_CLASS =
  "h-10 shrink-0 gap-2 rounded-full px-4 text-sm sm:flex-1 data-active:bg-primary data-active:text-primary-foreground data-active:shadow-md data-active:shadow-primary/20";

export default function SellingPage() {
  const [selling, setSelling] = useState(false);

  const { data: listings, isPending: listingsLoading } = useMyListings();
  const { data: received, isPending: receivedLoading } = useReceivedEnquiries();
  const { data: sent, isPending: sentLoading } = useMyEnquiries();

  const answer = useAnswerEnquiry();
  const withdrawEnquiry = useWithdrawEnquiry();

  const waiting = (received ?? []).filter((one) => one.status === "SENT");
  const open = (listings ?? []).filter(
    (one) => one.status === "ACTIVE" || one.status === "RESERVED",
  );

  function complain(error: unknown) {
    toast.error(getErrorMessage(error, "That did not work. Try again."));
  }

  return (
    <div className="relative mx-auto max-w-4xl space-y-6">
      <div aria-hidden className="pointer-events-none absolute -top-24 right-0 -z-10 h-72 w-full overflow-hidden">
        <div className="animate-drift absolute -top-10 right-10 size-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="animate-drift absolute left-1/3 top-6 size-56 rounded-full bg-chart-3/10 blur-3xl [animation-delay:-8s]" />
      </div>

      <div>
        <Link
          href="/marketplace"
          className={cn(buttonVariants({ variant: "ghost" }), "-ml-2 gap-2")}
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to everything for sale
        </Link>

        <header className="animate-in fade-in slide-in-from-bottom-2 mt-3 flex flex-wrap items-end justify-between gap-4 duration-500">
          <div>
            <p className="text-sm font-medium text-primary">Your corner of the market</p>
            <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              My selling and requests
            </h1>
            <p className="mt-2 max-w-prose text-muted-foreground">
              What you have up for sale, who has asked for it, and what you have asked
              other people for.
            </p>
          </div>

          <Button
            type="button"
            onClick={() => setSelling(true)}
            className="h-11 gap-2 px-5 shadow-lg shadow-primary/20 transition-transform hover:-translate-y-0.5"
          >
            <Plus className="size-5" aria-hidden />
            Sell something
          </Button>
        </header>
      </div>

      <section
        aria-labelledby="how-selling-heading"
        className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-chart-3/10 p-5 duration-500 [animation-delay:60ms] sm:p-6"
      >
        <p className="text-sm font-medium text-primary">How selling works</p>
        <h2 id="how-selling-heading" className="mt-1 font-display text-xl font-semibold tracking-tight sm:text-2xl">
          Three steps, and the money stays between you and the buyer.
        </h2>

        <ol className="mt-4 grid gap-3 sm:grid-cols-3">
          {HOW_TO_SELL.map(({ icon: Icon, title, body }, index) => (
            <li key={title} className="flex gap-3 rounded-2xl border border-border/70 bg-card/80 p-4 backdrop-blur">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon className="size-4" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block font-mono text-[0.7rem] text-muted-foreground">Step {index + 1}</span>
                <span className="block text-sm font-medium">{title}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{body}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      {!receivedLoading && !listingsLoading && !sentLoading ? (
        <div className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both flex flex-wrap gap-2 duration-500 [animation-delay:120ms]">
          <Stat icon={Bell} strong={waiting.length > 0}>
            {waiting.length} {waiting.length === 1 ? "request waits" : "requests wait"} for your answer
          </Stat>
          <Stat icon={Tag}>
            {open.length} up for sale
          </Stat>
          <Stat icon={Send}>
            {(sent ?? []).length} {(sent ?? []).length === 1 ? "request" : "requests"} sent by you
          </Stat>
        </div>
      ) : null}

      <Tabs
        defaultValue="requests"
        className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500 [animation-delay:180ms]"
      >
        <TabsList className="w-full justify-start overflow-x-auto overflow-y-hidden rounded-full border border-border bg-muted/50 p-1 [scrollbar-width:none] group-data-horizontal/tabs:h-auto [&::-webkit-scrollbar]:hidden">
          <TabsTrigger value="requests" className={TAB_CLASS}>
            Requests for me
            {waiting.length > 0 ? (
              <span className="rounded-full bg-card px-2 py-0.5 text-xs text-foreground">
                {waiting.length}
              </span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="listings" className={TAB_CLASS}>
            Things I am selling
          </TabsTrigger>
          <TabsTrigger value="asked" className={TAB_CLASS}>
            Things I asked for
          </TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="mt-4 space-y-3 duration-200 animate-in fade-in slide-in-from-bottom-1">
          <Hint>
            People who want something of yours appear here. Say yes to one and you both see
            each other&apos;s details.
          </Hint>
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
          <Hint>
            Everything you have put up. Tap Sold once it has changed hands, or take it down to
            keep it.
          </Hint>
          {listingsLoading ? (
            <Loading />
          ) : (listings ?? []).length === 0 ? (
            <Empty
              title="You are not selling anything"
              detail="Anything in your closet can go up in a few taps."
              action={
                <Button
                  type="button"
                  onClick={() => setSelling(true)}
                  className="mt-4 h-11 rounded-full px-5 shadow-lg shadow-primary/20"
                >
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
          <Hint>
            Things you asked other people for. Once a seller says yes, their details appear on
            the card.
          </Hint>
          {sentLoading ? (
            <Loading />
          ) : (sent ?? []).length === 0 ? (
            <Empty
              title="You have not asked for anything"
              detail="Find something you like and tap Ask to buy."
              action={
                <Link
                  href="/marketplace"
                  className={cn(buttonVariants({ variant: "outline" }), "mt-4 h-11 rounded-full px-5")}
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

/** One small number under the heading. */
function Stat({
  icon: Icon,
  strong,
  children,
}: {
  icon: typeof Tag;
  strong?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm",
        strong
          ? "border-primary bg-primary font-medium text-primary-foreground shadow-md shadow-primary/20"
          : "border-border bg-card text-muted-foreground",
      )}
    >
      <Icon className={cn("size-4", !strong && "text-primary")} aria-hidden />
      {children}
    </span>
  );
}

/** One line of plain help at the top of a tab. */
function Hint({ children }: { children: React.ReactNode }) {
  return <p className="px-1 text-sm text-muted-foreground">{children}</p>;
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
    <article className="rounded-2xl border border-border bg-card p-4">
      <div className="flex gap-4">
        <span className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-b from-muted/80 to-muted/20">
          <GarmentPicture src={listing.item.display_image_url} sizes="64px" className="p-1" iconClassName="size-5" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2">
            <span className="truncate font-medium">{listing.item.name}</span>
            <Badge variant={listing.status === "ACTIVE" ? "default" : "secondary"}>
              {listing.status_label}
            </Badge>
          </p>
          <p className="font-display text-lg font-semibold tabular-nums tracking-tight">
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
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() =>
              sold.mutate(listing.id, {
                onSuccess: () => toast.success("Marked sold. It has left your closet."),
                onError: onProblem,
              })
            }
            disabled={sold.isPending}
            className="h-11 flex-1 gap-2 shadow-md shadow-primary/20"
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
    <div className="space-y-3" aria-busy>
      {Array.from({ length: 3 }).map((_, index) => (
        <Skeleton key={index} className="h-28 w-full rounded-2xl" />
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
    <div className="rounded-2xl border border-dashed border-border p-10 text-center">
      <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Store className="size-6" aria-hidden />
      </span>
      <p className="mt-3 font-medium">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{detail}</p>
      {action}
    </div>
  );
}
