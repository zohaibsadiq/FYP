"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Ban,
  Clock,
  Eye,
  EyeOff,
  HandHeart,
  KeyRound,
  Pencil,
  Send,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { AddFriendDialog } from "@/components/friends/add-friend-dialog";
import { Initials } from "@/components/friends/initials";
import { LoanCard } from "@/components/friends/loan-card";
import { RequestCard } from "@/components/friends/request-card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useAnswerFriendRequest,
  useAnswerLoan,
  useCircleStats,
  useFriendRequests,
  useFriends,
  useLoans,
  useRemoveFriend,
  useUpdateFriend,
} from "@/hooks/use-friends";
import { useCurrentUser, useUpdateProfile } from "@/hooks/use-auth";
import { getErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Friend, Loan } from "@/types/friends";

// The three things that happen here, in the order they happen.
const HOW_IT_WORKS = [
  {
    icon: KeyRound,
    title: "Swap codes",
    body: "Tap Add a friend. Give them your code or type theirs. Nobody can find you by name.",
  },
  {
    icon: Eye,
    title: "Open your closet",
    body: "Turn on sharing below. Friends see only the name, brand, size and colour of each thing.",
  },
  {
    icon: HandHeart,
    title: "Ask and lend",
    body: "Open a friend, tap Ask to borrow and pick the days. They say yes or no. Nothing is charged.",
  },
];

// On a phone the four tabs scroll sideways inside their pill; on a wider
// screen they share the width.
const TAB_CLASS =
  "h-10 shrink-0 gap-2 rounded-full px-4 text-sm sm:flex-1 data-active:bg-primary data-active:text-primary-foreground data-active:shadow-md data-active:shadow-primary/20";

export default function FriendsPage() {
  const [adding, setAdding] = useState(false);

  const { data: me } = useCurrentUser();
  const { data: friends, isPending: friendsLoading } = useFriends();
  const { data: requests } = useFriendRequests();
  const { data: loans, isPending: loansLoading } = useLoans();
  const { data: stats } = useCircleStats();

  const answerRequest = useAnswerFriendRequest();
  const answerLoan = useAnswerLoan();
  const updateProfile = useUpdateProfile();

  const waiting = requests ?? [];
  const takenNames = (friends ?? []).map((friend) => friend.nickname);

  const asksForMe = (loans ?? []).filter(
    (loan) => loan.lender.id === me?.id && loan.status === "ASKED",
  );
  const lentOut = (loans ?? []).filter(
    (loan) => loan.lender.id === me?.id && loan.status === "AGREED",
  );
  const iAsked = (loans ?? []).filter(
    (loan) => loan.borrower.id === me?.id && loan.status !== "RETURNED",
  );

  function complain(error: unknown) {
    toast.error(getErrorMessage(error, "That did not work. Try again."));
  }

  function answer(loan: Loan, what: "agree" | "decline" | "returned" | "cancel", said: string) {
    answerLoan.mutate(
      { id: loan.id, answer: what },
      { onSuccess: () => toast.success(said), onError: complain },
    );
  }

  return (
    <div className="relative mx-auto max-w-4xl space-y-6">
      <div aria-hidden className="pointer-events-none absolute -top-24 right-0 -z-10 h-72 w-full overflow-hidden">
        <div className="animate-drift absolute -top-10 right-10 size-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="animate-drift absolute left-1/3 top-6 size-56 rounded-full bg-chart-2/10 blur-3xl [animation-delay:-8s]" />
      </div>

      <header className="animate-in fade-in slide-in-from-bottom-2 flex flex-wrap items-end justify-between gap-4 duration-500">
        <div>
          <p className="text-sm font-medium text-primary">Your circle</p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Borrow from Friends
          </h1>
          <p className="mt-2 max-w-prose text-muted-foreground">
            Swap a code with somebody you know, then borrow from each other instead of
            buying something for one evening.
          </p>
        </div>

        <Button
          type="button"
          onClick={() => setAdding(true)}
          className="h-11 gap-2 px-5 shadow-lg shadow-primary/20 transition-transform hover:-translate-y-0.5"
        >
          <UserPlus className="size-4" aria-hidden />
          Add a friend
        </Button>
      </header>

      <section
        aria-labelledby="how-heading"
        className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-chart-2/10 p-5 duration-500 [animation-delay:60ms] sm:p-6"
      >
        <p className="text-sm font-medium text-primary">How it works</p>
        <h2 id="how-heading" className="mt-1 font-display text-xl font-semibold tracking-tight sm:text-2xl">
          Three steps, and only people you let in can see anything.
        </h2>

        <ol className="mt-4 grid gap-3 sm:grid-cols-3">
          {HOW_IT_WORKS.map(({ icon: Icon, title, body }, index) => (
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

      {stats && stats.overdue > 0 ? (
        <p className="flex items-start gap-2 rounded-2xl border border-chart-4/50 bg-chart-4/10 p-4 text-sm">
          <Clock className="mt-0.5 size-4 shrink-0 text-amber-700" aria-hidden />
          <span>
            You are late giving back {stats.overdue}{" "}
            {stats.overdue === 1 ? "thing" : "things"}. Have a look under Things I borrowed.
          </span>
        </p>
      ) : null}

      <div className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500 [animation-delay:120ms]">
        <SharingSwitch
          on={Boolean(me?.shares_closet)}
          busy={updateProfile.isPending}
          onChange={(next) =>
            updateProfile.mutate(
              { shares_closet: next },
              {
                onSuccess: () =>
                  toast.success(
                    next
                      ? "Your friends can see what you are happy to lend."
                      : "Your closet is private again.",
                  ),
                onError: complain,
              },
            )
          }
        />
      </div>

      {stats ? (
        <div className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both flex flex-wrap gap-2 duration-500 [animation-delay:160ms]">
          <Stat icon={Users}>
            {stats.friends} {stats.friends === 1 ? "friend" : "friends"}
          </Stat>
          <Stat icon={HandHeart} strong={stats.asks_waiting_on_me > 0}>
            {stats.asks_waiting_on_me} {stats.asks_waiting_on_me === 1 ? "ask waits" : "asks wait"} for your answer
          </Stat>
          <Stat icon={Send}>
            {stats.lent_out} lent out
          </Stat>
          <Stat icon={Clock}>
            {stats.borrowed} borrowed
          </Stat>
        </div>
      ) : null}

      {waiting.length > 0 ? (
        <section className="animate-in fade-in slide-in-from-bottom-2 space-y-3 duration-500">
          <h2 className="font-display text-xl font-semibold tracking-tight">
            {waiting.length} {waiting.length === 1 ? "person wants" : "people want"} to be
            your friend
          </h2>
          {waiting.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              takenNames={takenNames}
              busy={answerRequest.isPending}
              onAccept={(one, nickname) =>
                answerRequest.mutate(
                  { id: one.id, answer: "accept", nickname },
                  {
                    onSuccess: () => toast.success(`${nickname} is now your friend.`),
                    onError: complain,
                  },
                )
              }
              onDecline={(one) =>
                answerRequest.mutate(
                  { id: one.id, answer: "decline" },
                  { onSuccess: () => toast.success("Declined."), onError: complain },
                )
              }
            />
          ))}
        </section>
      ) : null}

      <Tabs
        defaultValue="friends"
        className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500 [animation-delay:220ms]"
      >
        <TabsList className="w-full justify-start overflow-x-auto overflow-y-hidden rounded-full border border-border bg-muted/50 p-1 [scrollbar-width:none] group-data-horizontal/tabs:h-auto [&::-webkit-scrollbar]:hidden">
          <TabsTrigger value="friends" className={TAB_CLASS}>
            My friends
          </TabsTrigger>
          <TabsTrigger value="asks" className={TAB_CLASS}>
            Asked of me
            {asksForMe.length > 0 ? (
              <span className="rounded-full bg-card px-2 py-0.5 text-xs text-foreground">
                {asksForMe.length}
              </span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="lent" className={TAB_CLASS}>
            Lent out
          </TabsTrigger>
          <TabsTrigger value="borrowed" className={TAB_CLASS}>
            Things I borrowed
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="friends"
          className="mt-4 space-y-3 duration-200 animate-in fade-in slide-in-from-bottom-1"
        >
          <Hint>
            Open a friend to see what they are happy to lend. The name you give each friend is
            only ever seen by you.
          </Hint>
          {friendsLoading ? (
            <Loading />
          ) : (friends ?? []).length === 0 ? (
            <Empty
              title="No friends yet"
              detail="Swap codes with somebody you know. Nobody can find you by name or email, so you decide who is in."
              action={
                <Button
                  type="button"
                  onClick={() => setAdding(true)}
                  className="mt-4 h-11 rounded-full px-5 shadow-lg shadow-primary/20"
                >
                  Add a friend
                </Button>
              }
            />
          ) : (
            (friends ?? []).map((friend) => <FriendRow key={friend.id} friend={friend} />)
          )}
        </TabsContent>

        <TabsContent
          value="asks"
          className="mt-4 space-y-3 duration-200 animate-in fade-in slide-in-from-bottom-1"
        >
          <Hint>
            Friends who want to borrow something of yours. Say yes and it counts as lent out
            until you get it back.
          </Hint>
          {loansLoading ? (
            <Loading />
          ) : asksForMe.length === 0 ? (
            <Empty
              title="Nobody has asked"
              detail="When a friend wants to borrow something of yours, it appears here."
            />
          ) : (
            asksForMe.map((loan) => (
              <LoanCard
                key={loan.id}
                loan={loan}
                side="lender"
                busy={answerLoan.isPending}
                onAgree={(one) => answer(one, "agree", "Agreed. It is marked as lent out.")}
                onDecline={(one) => answer(one, "decline", "Declined.")}
              />
            ))
          )}
        </TabsContent>

        <TabsContent
          value="lent"
          className="mt-4 space-y-3 duration-200 animate-in fade-in slide-in-from-bottom-1"
        >
          <Hint>
            Things of yours that are out with a friend. Tap I got it back once it is home.
          </Hint>
          {lentOut.length === 0 ? (
            <Empty
              title="Nothing is out on loan"
              detail="Anything you agree to lend shows here until you get it back."
            />
          ) : (
            lentOut.map((loan) => (
              <LoanCard
                key={loan.id}
                loan={loan}
                side="lender"
                busy={answerLoan.isPending}
                onReturned={(one) => answer(one, "returned", "Back in your closet.")}
              />
            ))
          )}
        </TabsContent>

        <TabsContent
          value="borrowed"
          className="mt-4 space-y-3 duration-200 animate-in fade-in slide-in-from-bottom-1"
        >
          <Hint>
            What you asked for and what you have on loan. The friend marks it returned once
            they have it back.
          </Hint>
          {iAsked.length === 0 ? (
            <Empty
              title="You have not borrowed anything"
              detail="Open a friend and see what they are happy to lend."
            />
          ) : (
            iAsked.map((loan) => (
              <LoanCard
                key={loan.id}
                loan={loan}
                side="borrower"
                busy={answerLoan.isPending}
                onCancel={(one) => answer(one, "cancel", "Request taken back.")}
              />
            ))
          )}
        </TabsContent>
      </Tabs>

      <AddFriendDialog open={adding} onOpenChange={setAdding} />
    </div>
  );
}

/** One small number under the heading. */
function Stat({
  icon: Icon,
  strong,
  children,
}: {
  icon: typeof Users;
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

/** Gates every friend-facing read of this account's closet. */
function SharingSwitch({
  on,
  busy,
  onChange,
}: {
  on: boolean;
  busy?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-4 rounded-2xl border p-4 transition-colors",
        on ? "border-primary/30 bg-primary/5" : "border-border bg-card",
      )}
    >
      <span
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-xl",
          on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
        )}
      >
        {on ? <Eye className="size-5" aria-hidden /> : <EyeOff className="size-5" aria-hidden />}
      </span>
      <div className="min-w-0 flex-1 basis-56">
        <p className="font-medium">Let my friends see what I can lend</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {on
            ? "They see the name, brand, size and colour. Never what you paid, how often you wore it, or where you keep it."
            : "Off. Your friends see nothing of yours until you turn this on."}
        </p>
      </div>
      <Button
        type="button"
        variant={on ? "outline" : "default"}
        onClick={() => onChange(!on)}
        disabled={busy}
        aria-pressed={on}
        className={cn("h-10 shrink-0 rounded-full px-4", !on && "shadow-md shadow-primary/20")}
      >
        {on ? "Turn it off" : "Turn it on"}
      </Button>
    </div>
  );
}

function FriendRow({ friend }: { friend: Friend }) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(friend.nickname);
  const update = useUpdateFriend();
  const remove = useRemoveFriend();

  function complain(error: unknown) {
    toast.error(getErrorMessage(error, "That did not work. Try again."));
  }

  return (
    <article className="rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/30">
      <div className="flex flex-wrap items-center gap-4">
        <Initials name={friend.nickname} id={friend.person.id} className="size-12 text-base" />

        <div className="min-w-0 flex-1 basis-40">
          <p className="flex flex-wrap items-center gap-2">
            <span className="truncate font-medium">{friend.nickname}</span>
            {friend.blocked ? <Badge variant="secondary">Blocked</Badge> : null}
          </p>
          <p className="truncate text-sm text-muted-foreground">
            {friend.person.display_name}
            {friend.person.city ? `, ${friend.person.city}` : ""}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {friend.blocked
              ? "You see nothing of theirs while they are blocked."
              : friend.shares_closet
                ? `${friend.items_to_borrow} ${friend.items_to_borrow === 1 ? "thing" : "things"} you could borrow`
                : "They have not opened their closet yet"}
          </p>
        </div>

        {friend.shares_closet && !friend.blocked ? (
          <Link
            href={`/friends/${friend.id}`}
            className={cn(
              buttonVariants({ variant: "outline" }),
              "h-10 shrink-0 basis-full gap-2 rounded-full px-4 sm:basis-auto",
            )}
          >
            <HandHeart className="size-4" aria-hidden />
            See what they lend
          </Link>
        ) : null}
      </div>

      {renaming ? (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-label={`What you call ${friend.nickname}`}
            className="min-w-40 flex-1"
          />
          <Button
            type="button"
            onClick={() =>
              update.mutate(
                { id: friend.id, nickname: name.trim() },
                {
                  onSuccess: () => {
                    setRenaming(false);
                    toast.success("Saved.");
                  },
                  onError: complain,
                },
              )
            }
            disabled={update.isPending || !name.trim()}
            className="h-11"
          >
            Save
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setName(friend.nickname);
              setRenaming(false);
            }}
            className="h-11"
          >
            Cancel
          </Button>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-1 border-t border-border pt-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setRenaming(true)}
            className="h-9 gap-2 rounded-full text-muted-foreground hover:text-foreground"
          >
            <Pencil className="size-4" aria-hidden />
            Rename
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              update.mutate(
                { id: friend.id, blocked: !friend.blocked },
                {
                  onSuccess: () =>
                    toast.success(friend.blocked ? "Unblocked." : "Blocked. Nothing is shared either way."),
                  onError: complain,
                },
              )
            }
            disabled={update.isPending}
            className="h-9 gap-2 rounded-full text-muted-foreground hover:text-foreground"
          >
            <Ban className="size-4" aria-hidden />
            {friend.blocked ? "Unblock" : "Block"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              remove.mutate(friend.id, {
                onSuccess: () => toast.success("Removed."),
                onError: complain,
              })
            }
            disabled={remove.isPending}
            className="h-9 gap-2 rounded-full text-destructive hover:text-destructive"
          >
            <Trash2 className="size-4" aria-hidden />
            Remove
          </Button>
        </div>
      )}
    </article>
  );
}

function Loading() {
  return (
    <div className="space-y-3" aria-busy>
      {Array.from({ length: 3 }, (_, index) => (
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
        <Users className="size-6" aria-hidden />
      </span>
      <p className="mt-3 font-medium">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{detail}</p>
      {action}
    </div>
  );
}
