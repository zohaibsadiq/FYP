"use client";

/**
 * /register
 *
 * We collect the city here, not later, because the weather feature in Phase 3
 * needs it. Asking for it once at signup means the dashboard works immediately
 * instead of nagging the user to complete their profile.
 */

import Link from "next/link";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRegister } from "@/hooks/use-auth";
import { getErrorMessage, getFieldErrors } from "@/lib/api";

export default function RegisterPage() {
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    city: "",
    password: "",
    password_confirm: "",
  });

  // Per-field messages from Django, e.g. { email: "Already exists." }
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const register = useRegister();

  /** One handler for all inputs - the input's `name` decides which key to update. */
  function update(event: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    // Clear the error for this field as soon as the user starts fixing it
    setFieldErrors((prev) => ({ ...prev, [name]: "" }));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    // Check locally first so the user gets instant feedback without a round trip
    if (form.password !== form.password_confirm) {
      setFieldErrors({ password_confirm: "Passwords do not match." });
      return;
    }

    register.mutate(
      {
        ...form,
        email: form.email.trim().toLowerCase(),
        country_code: "PK",
      },
      {
        onError: (error) => {
          setFieldErrors(getFieldErrors(error));
          toast.error(getErrorMessage(error, "Could not create your account."));
        },
      },
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Create your closet</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Takes under a minute. No credit card, obviously.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <Field
          id="full_name"
          label="Full name"
          value={form.full_name}
          onChange={update}
          placeholder="Ayesha Khan"
          autoComplete="name"
          error={fieldErrors.full_name}
          required
        />

        <Field
          id="email"
          label="Email"
          type="email"
          value={form.email}
          onChange={update}
          placeholder="you@example.com"
          autoComplete="email"
          error={fieldErrors.email}
          required
        />

        <Field
          id="city"
          label="City"
          value={form.city}
          onChange={update}
          placeholder="Lahore"
          autoComplete="address-level2"
          hint="Used to fetch your local weather forecast."
          error={fieldErrors.city}
          required
        />

        <Field
          id="password"
          label="Password"
          type="password"
          value={form.password}
          onChange={update}
          placeholder="At least 8 characters"
          autoComplete="new-password"
          error={fieldErrors.password}
          required
        />

        <Field
          id="password_confirm"
          label="Confirm password"
          type="password"
          value={form.password_confirm}
          onChange={update}
          placeholder="Type it again"
          autoComplete="new-password"
          error={fieldErrors.password_confirm}
          required
        />

        <Button type="submit" className="w-full" disabled={register.isPending}>
          {register.isPending && <Loader2 className="size-4 animate-spin" />}
          {register.isPending ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already registered?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

/**
 * Small local component so we do not repeat label + input + error five times.
 * Kept in this file because nothing else needs it.
 */
function Field({
  id,
  label,
  hint,
  error,
  ...inputProps
}: React.ComponentProps<typeof Input> & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={id}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        {...inputProps}
      />
      {error ? (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
