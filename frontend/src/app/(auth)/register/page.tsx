"use client";

import Link from "next/link";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRegister, useSkipIfSignedIn } from "@/hooks/use-auth";
import { getErrorMessage, getFieldErrors } from "@/lib/api";
import { cn } from "@/lib/utils";
import { SHOPPING_FOR, SHOPPING_FOR_LABELS, type ShoppingFor } from "@/types";

export default function RegisterPage() {
  const [shoppingFor, setShoppingFor] = useState<ShoppingFor>("EVERYTHING");
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    city: "",
    password: "",
    password_confirm: "",
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [formError, setFormError] = useState("");

  const register = useRegister();
  useSkipIfSignedIn();

  function update(event: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => ({ ...prev, [name]: "" }));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError("");

    if (form.password !== form.password_confirm) {
      setFieldErrors({ password_confirm: "Both passwords must be the same." });
      return;
    }

    register.mutate(
      {
        ...form,
        shopping_for: shoppingFor,
        email: form.email.trim().toLowerCase(),
        // Sign-up needs a country, and Pakistan is the only one the shops cover so far.
        country_code: "PK",
      },
      {
        onError: (error) => {
          const message = getErrorMessage(error, "Check the details above, then try again.");
          setFieldErrors(getFieldErrors(error));
          setFormError(message);
          toast.error(message);
        },
      },
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Create your closet</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Takes about a minute. Add your clothes whenever it suits you.
      </p>

      {formError ? (
        <p
          role="alert"
          className="mt-6 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {formError}
        </p>
      ) : null}

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
          hint="Used for your local weather, and to find things for sale near you."
          error={fieldErrors.city}
          required
        />

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Whose clothes do you want to see?</legend>
          <p className="text-xs text-muted-foreground">
            Only decides which section each page opens on. You can change it whenever you
            like.
          </p>
          <div className="grid grid-cols-2 gap-2 pt-1">
            {SHOPPING_FOR.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setShoppingFor(option)}
                aria-pressed={shoppingFor === option}
                className={cn(
                  "min-h-11 rounded-lg border px-3 text-sm transition-colors",
                  shoppingFor === option
                    ? "border-primary bg-primary/10 font-medium"
                    : "border-border hover:border-primary hover:bg-accent",
                )}
              >
                {SHOPPING_FOR_LABELS[option]}
              </button>
            ))}
          </div>
        </fieldset>

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
          {register.isPending ? "Creating account..." : "Create account"}
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
