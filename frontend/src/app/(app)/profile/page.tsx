"use client";

import { useState } from "react";
import { Check, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser, useUpdateProfile } from "@/hooks/use-auth";
import { getErrorMessage, getFieldErrors } from "@/lib/api";
import { cn } from "@/lib/utils";
import { SHOPPING_FOR, SHOPPING_FOR_LABELS, type ShoppingFor } from "@/types";

/**
 * The few things about a person the app actually needs.
 *
 * The phone number is here because Buy and Sell hands it to one person when a
 * sale is agreed, and there was previously nowhere to type it in. The reason
 * it is asked for sits next to the box, because a field asking for a phone
 * number with no explanation is a field people rightly refuse.
 */
export default function ProfilePage() {
  const { data: me, isPending } = useCurrentUser();
  const update = useUpdateProfile();

  const [draft, setDraft] = useState<{
    full_name?: string;
    city?: string;
    phone?: string;
    shopping_for?: ShoppingFor;
  }>({});
  const [problem, setProblem] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  if (isPending || !me) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  const value = <K extends keyof typeof draft>(key: K, fallback: string) =>
    (draft[key] as string | undefined) ?? fallback;

  const chosen = draft.shopping_for ?? me.shopping_for;

  function save() {
    setProblem("");
    setFieldErrors({});
    update.mutate(draft, {
      onSuccess: () => {
        setDraft({});
        toast.success("Saved.");
      },
      onError: (error) => {
        setFieldErrors(getFieldErrors(error));
        setProblem(getErrorMessage(error, "That did not save. Try again."));
      },
    });
  }

  const unsaved = Object.keys(draft).length > 0;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">My details</h1>
        <p className="mt-2 text-muted-foreground">
          Used for the weather where you are, and for arranging a sale.
        </p>
      </div>

      <div className="space-y-5 rounded-xl border border-border p-4">
        <div className="space-y-2">
          <Label htmlFor="profile-name">Your name</Label>
          <Input
            id="profile-name"
            value={value("full_name", me.full_name)}
            onChange={(event) => setDraft({ ...draft, full_name: event.target.value })}
            aria-invalid={Boolean(fieldErrors.full_name)}
          />
          <p className="text-xs text-muted-foreground">
            Shown to anybody who sees something you are selling.
          </p>
          {fieldErrors.full_name ? (
            <p className="text-xs text-destructive">{fieldErrors.full_name}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="profile-email">Email</Label>
          <Input id="profile-email" value={me.email} disabled />
          <p className="text-xs text-muted-foreground">
            This is how you sign in, so it cannot be changed here.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="profile-city">City</Label>
          <Input
            id="profile-city"
            value={value("city", me.city)}
            onChange={(event) => setDraft({ ...draft, city: event.target.value })}
            placeholder="Lahore"
            aria-invalid={Boolean(fieldErrors.city)}
          />
          <p className="text-xs text-muted-foreground">
            Gets your weather, and lets people find things for sale near them.
          </p>
          {fieldErrors.city ? (
            <p className="text-xs text-destructive">{fieldErrors.city}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="profile-phone">Phone number</Label>
          <Input
            id="profile-phone"
            type="tel"
            inputMode="tel"
            value={value("phone", me.phone)}
            onChange={(event) => setDraft({ ...draft, phone: event.target.value })}
            placeholder="0300 1234567"
            aria-invalid={Boolean(fieldErrors.phone)}
          />
          <p className="text-xs text-muted-foreground">
            Never shown on a listing and never searchable. It is given to one person only,
            at the moment you agree to buy or sell something with them.
          </p>
          {fieldErrors.phone ? (
            <p className="text-xs text-destructive">{fieldErrors.phone}</p>
          ) : null}
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Whose clothes do you want to see?</legend>
          <p className="text-xs text-muted-foreground">
            Only decides what each page opens on. You can switch to anything else at any
            time.
          </p>
          <div className="grid gap-2 pt-1 sm:grid-cols-2">
            {SHOPPING_FOR.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setDraft({ ...draft, shopping_for: option })}
                aria-pressed={chosen === option}
                className={cn(
                  "flex min-h-11 items-center gap-2 rounded-lg border px-3 text-left text-sm transition-colors",
                  chosen === option
                    ? "border-primary bg-primary/10 font-medium"
                    : "border-border hover:border-primary hover:bg-accent",
                )}
              >
                {chosen === option ? (
                  <Check className="size-4 shrink-0 text-primary" aria-hidden />
                ) : null}
                {SHOPPING_FOR_LABELS[option]}
              </button>
            ))}
          </div>
        </fieldset>

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
          onClick={save}
          disabled={!unsaved || update.isPending}
          className="h-11 w-full sm:w-auto sm:px-8"
        >
          {update.isPending ? "Saving..." : unsaved ? "Save changes" : "Nothing to save"}
        </Button>
      </div>
    </div>
  );
}
