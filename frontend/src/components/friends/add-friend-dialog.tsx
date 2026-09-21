"use client";

import { useState } from "react";
import { Check, Copy, RefreshCw, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAskToBeFriends, useMyFriendCode, useNewFriendCode } from "@/hooks/use-friends";
import { getErrorMessage } from "@/lib/api";

/**
 * Two halves of the same job: the code you hand out, and the box you type
 * somebody else's into.
 *
 * There is deliberately no search box. A name search cannot tell your friend
 * from somebody using their name, and searching by email would tell anybody
 * holding an address whether it has an account here.
 */
export function AddFriendDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [typed, setTyped] = useState("");
  const [problem, setProblem] = useState("");
  const [copied, setCopied] = useState(false);

  const { data: mine } = useMyFriendCode();
  const newCode = useNewFriendCode();
  const ask = useAskToBeFriends();

  async function copy() {
    if (!mine?.code) return;
    try {
      await navigator.clipboard.writeText(mine.code);
      setCopied(true);
      toast.success("Code copied. Send it to your friend.");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access is refused in some browsers and on insecure pages.
      // The code is on screen either way, so this is a nudge, not a failure.
      toast.message("Copy it from the box above.");
    }
  }

  function send() {
    setProblem("");
    ask.mutate(typed, {
      onSuccess: () => {
        setTyped("");
        toast.success("Asked. They will see it next time they open Closette.");
        onOpenChange(false);
      },
      onError: (error) => setProblem(getErrorMessage(error, "That did not work. Try again.")),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a friend</DialogTitle>
          <DialogDescription>
            Friends are added by swapping a code. Nobody can find you by name or email.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="my-friend-code">Your code</Label>
            <div className="flex gap-2">
              <Input
                id="my-friend-code"
                readOnly
                value={mine?.code ?? ""}
                className="font-mono text-lg tracking-widest"
              />
              <Button
                type="button"
                variant="outline"
                onClick={copy}
                disabled={!mine?.code}
                className="h-11 shrink-0 gap-2"
              >
                {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Give this to somebody you know. Only a person who has it can ask to be
              your friend.
            </p>
            <Button
              type="button"
              variant="ghost"
              onClick={() =>
                newCode.mutate(undefined, {
                  onSuccess: () => toast.success("New code made. The old one no longer works."),
                  onError: (error: unknown) =>
                    toast.error(getErrorMessage(error, "That did not work. Try again.")),
                })
              }
              disabled={newCode.isPending}
              className="h-11 gap-2 px-0 text-sm"
            >
              <RefreshCw className="size-4" aria-hidden />
              Make a new code
            </Button>
          </div>

          <div className="space-y-2 border-t border-border pt-5">
            <Label htmlFor="their-friend-code">Their code</Label>
            <Input
              id="their-friend-code"
              value={typed}
              onChange={(event) => setTyped(event.target.value.toUpperCase())}
              placeholder="ABCD2345"
              autoComplete="off"
              autoCapitalize="characters"
              className="font-mono text-lg tracking-widest"
              aria-invalid={Boolean(problem)}
            />
            <p className="text-xs text-muted-foreground">
              Type the code they gave you. They have to say yes before anything is shared.
            </p>

            {problem ? (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm"
              >
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
                {problem}
              </p>
            ) : null}

            <Button
              type="button"
              onClick={send}
              disabled={!typed.trim() || ask.isPending}
              className="h-11 w-full"
            >
              {ask.isPending ? "Asking..." : "Ask to be friends"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
