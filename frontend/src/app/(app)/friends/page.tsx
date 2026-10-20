"use client";

import Link from "next/link";
import { useState } from "react";
import { Ban, Clock, Pencil, Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";

import { AddFriendDialog } from "@/components/friends/add-friend-dialog";
import { Initials } from "@/components/friends/initials";
import { LoanCard } from "@/components/friends/loan-card";
import { RequestCard } from "@/components/friends/request-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import type { Friend, Loan } from "@/types/friends";

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
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Borrow from Friends
          </h1>
          <p className="mt-2 text-muted-foreground">
            Swap a code with somebody you know, then borrow from each other instead of
            buying something for one evening.
          </p>
        </div>

        <Button type="button" onClick={() => setAdding(true)} className="h-11 gap-2 px-5">
          <UserPlus className="size-4" aria-hidden />
          Add a friend
        </Button>
      </div>

      {stats && stats.overdue > 0 ? (
        <p className="flex items-start gap-2 rounded-xl border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-100">
          <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
          You are late giving back {stats.overdue}{" "}
          {stats.overdue === 1 ? "thing" : "things"}. Have a look under Things I borrowed.
        </p>
      ) : null}

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

      {waiting.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">
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

      <Tabs defaultValue="friends">
        <TabsList className="w-full">
          <TabsTrigger value="friends" className="flex-1">
            My friends
          </TabsTrigger>
          <TabsTrigger value="asks" className="flex-1 gap-2">
            Asked of me
            {asksForMe.length > 0 ? (
              <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                {asksForMe.length}
              </span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="lent" className="flex-1">
            Lent out
          </TabsTrigger>
          <TabsTrigger value="borrowed" className="flex-1">
            Things I borrowed
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="friends"
          className="mt-4 space-y-3 duration-200 animate-in fade-in slide-in-from-bottom-1"
        >
          {friendsLoading ? (
            <Loading />
          ) : (friends ?? []).length === 0 ? (
            <Empty
              title="No friends yet"
              detail="Swap codes with somebody you know. Nobody can find you by name or email, so you decide who is in."
              action={
                <Button type="button" onClick={() => setAdding(true)} className="mt-4 h-11">
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
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4">
      <div className="min-w-0">
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
        className="h-11 shrink-0"
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
    <article className="rounded-xl border border-border p-3">
      <div className="flex items-center gap-3">
        <Initials name={friend.nickname} id={friend.person.id} />

        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2">
            <span className="truncate font-medium">{friend.nickname}</span>
            {friend.blocked ? <Badge variant="secondary">Blocked</Badge> : null}
          </p>
          <p className="truncate text-sm text-muted-foreground">
            {friend.person.display_name}
            {friend.person.city ? ` · ${friend.person.city}` : ""}
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
            className="inline-flex h-11 shrink-0 items-center rounded-lg border border-border px-4 text-sm font-medium hover:bg-accent"
          >
            See what they lend
          </Link>
        ) : null}
      </div>

      {renaming ? (
        <div className="mt-3 flex flex-wrap gap-2">
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
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setRenaming(true)}
            className="h-11 gap-2"
          >
            <Pencil className="size-4" aria-hidden />
            Rename
          </Button>
          <Button
            type="button"
            variant="ghost"
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
            className="h-11 gap-2"
          >
            <Ban className="size-4" aria-hidden />
            {friend.blocked ? "Unblock" : "Block"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() =>
              remove.mutate(friend.id, {
                onSuccess: () => toast.success("Removed."),
                onError: complain,
              })
            }
            disabled={remove.isPending}
            className="h-11 gap-2 text-destructive hover:text-destructive"
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
    <div className="space-y-3">
      {Array.from({ length: 3 }, (_, index) => (
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
      <Users className="mx-auto size-8 text-muted-foreground" aria-hidden />
      <p className="mt-3 font-medium">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{detail}</p>
      {action}
    </div>
  );
}
