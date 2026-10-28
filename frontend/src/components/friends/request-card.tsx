"use client";

import { useState } from "react";
import { TriangleAlert, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Initials } from "@/components/friends/initials";
import type { FriendRequest } from "@/types/friends";

/**
 * The nickname is chosen here, before anything is shared. Each person's
 * nicknames must be unique, so somebody who already has a friend called "Ali
 * Khan" is told so now and asked for another name, such as "Ali Khan (uni)".
 */
export function RequestCard({
  request,
  takenNames,
  busy,
  onAccept,
  onDecline,
}: {
  request: FriendRequest;
  takenNames: string[];
  busy?: boolean;
  onAccept: (request: FriendRequest, nickname: string) => void;
  onDecline: (request: FriendRequest) => void;
}) {
  const them = request.from_person;
  const [nickname, setNickname] = useState(them.display_name);

  const taken = takenNames.some(
    (name) => name.toLowerCase() === nickname.trim().toLowerCase(),
  );
  const empty = nickname.trim().length === 0;

  return (
    <article className="rounded-2xl border border-primary/30 bg-primary/5 p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <Initials name={them.display_name} id={them.id} className="size-12 text-base" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{them.display_name}</p>
          <p className="truncate text-sm text-muted-foreground">
            {them.city || "No city saved"} - wants to be your friend
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <Label htmlFor={`nickname-${request.id}`}>What do you want to call them?</Label>
        <Input
          id={`nickname-${request.id}`}
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          aria-invalid={taken || empty}
          className="bg-card"
        />
        {taken ? (
          <p
            role="alert"
            className="flex items-start gap-2 text-xs text-destructive"
          >
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            You already have a friend called {nickname.trim()}. Add something to tell them
            apart, like where you know them from.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Only you see this. Change it any time.
          </p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() => onAccept(request, nickname.trim())}
          disabled={busy || taken || empty}
          className="h-11 flex-1 gap-2 shadow-md shadow-primary/20"
        >
          <UserPlus className="size-4" aria-hidden />
          Yes, add them
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => onDecline(request)}
          disabled={busy}
          className="h-11 flex-1"
        >
          No thanks
        </Button>
      </div>
    </article>
  );
}
