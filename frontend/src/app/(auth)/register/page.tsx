"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Baby, Check, Loader2, Mail, MapPin, Shirt, User, Users } from "lucide-react";
import { toast } from "sonner";

import { PasswordField } from "@/components/form/password-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRegister, useSkipIfSignedIn } from "@/hooks/use-auth";
import { getErrorMessage, getFieldErrors } from "@/lib/api";
import { cn } from "@/lib/utils";
import { SHOPPING_FOR, SHOPPING_FOR_LABELS, type ShoppingFor } from "@/types";

// Three short screens instead of one long form. Each one asks about one
// thing, so the page never scrolls and a mistake is caught where it was made.
const STEPS = [
  { title: "About you", blurb: "The name your friends will see, and how to sign in.", fields: ["full_name", "email"] },
  { title: "Where you are", blurb: "Your city picks the weather and what is for sale nearby.", fields: ["city", "shopping_for"] },
  { title: "Your password", blurb: "At least 8 characters. Nobody else will ever see it.", fields: ["password", "password_confirm"] },
] as const;

const SHOPPING_ICONS: Record<ShoppingFor, typeof Shirt> = {
  WOMEN: User,
  MEN: Users,
  KIDS: Baby,
  EVERYTHING: Shirt,
};

const LOOKS_LIKE_AN_EMAIL = /^\S+@\S+\.\S+$/;

type Form = {
  full_name: string;
  email: string;
  city: string;
  password: string;
  password_confirm: string;
};

export default function RegisterPage() {
  const [step, setStep] = useState(0);
  const [goingBack, setGoingBack] = useState(false);
  const [shoppingFor, setShoppingFor] = useState<ShoppingFor>("EVERYTHING");
  const [form, setForm] = useState<Form>({
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

  const last = step === STEPS.length - 1;

  function update(event: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => ({ ...prev, [name]: "" }));
  }

  /** What is wrong on this screen, if anything. Checked before moving on. */
  function problemsOn(which: number): Record<string, string> {
    const problems: Record<string, string> = {};
    if (which === 0) {
      if (!form.full_name.trim()) problems.full_name = "Please tell us your name.";
      if (!form.email.trim()) problems.email = "Please enter your email.";
      else if (!LOOKS_LIKE_AN_EMAIL.test(form.email.trim())) {
        problems.email = "That does not look like an email address.";
      }
    }
    if (which === 1 && !form.city.trim()) {
      problems.city = "Please tell us your city. It picks your weather.";
    }
    if (which === 2) {
      if (form.password.length < 8) problems.password = "Use at least 8 characters.";
      if (form.password_confirm !== form.password) {
        problems.password_confirm = "Both passwords must be the same.";
      }
    }
    return problems;
  }

  function goTo(next: number) {
    setGoingBack(next < step);
    setStep(next);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError("");

    const problems = problemsOn(step);
    if (Object.keys(problems).length > 0) {
      setFieldErrors(problems);
      return;
    }
    if (!last) {
      goTo(step + 1);
      return;
    }

    register.mutate(
      {
        ...form,
        full_name: form.full_name.trim(),
        city: form.city.trim(),
        shopping_for: shoppingFor,
        email: form.email.trim().toLowerCase(),
        // Sign-up needs a country, and Pakistan is the only one the shops cover so far.
        country_code: "PK",
      },
      {
        onError: (error) => {
          const message = getErrorMessage(error, "Check the details, then try again.");
          const errors = getFieldErrors(error);
          setFieldErrors(errors);
          // A refusal about one box is shown next to that box, not twice.
          setFormError(Object.keys(errors).length > 0 ? "" : message);
          toast.error(message);

          // Go back to the screen that holds the first thing the server
          // refused, so the message appears next to the box it is about.
          const wrong = STEPS.findIndex((s) => s.fields.some((f) => errors[f]));
          if (wrong >= 0) goTo(wrong);
        },
      },
    );
  }

  const current = STEPS[step];

  return (
    <div>
      <p className="text-sm font-medium text-primary">Create your closet</p>
      <h1 className="mt-1.5 font-display text-3xl font-semibold tracking-tight">{current.title}</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">{current.blurb}</p>

      <Progress step={step} />

      {formError ? (
        <p
          role="alert"
          className="mt-5 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {formError}
        </p>
      ) : null}

      {/* noValidate: the checks above explain in full sentences, and the
          browser's own pop-up would speak first and in its own words. */}
      <form onSubmit={handleSubmit} noValidate className="mt-5">
        <div
          key={step}
          className={cn(
            "animate-in fade-in space-y-4 duration-300",
            goingBack ? "slide-in-from-left-4" : "slide-in-from-right-4",
          )}
        >
          {step === 0 ? (
            <>
              <Field
                id="full_name"
                label="Full name"
                icon={User}
                value={form.full_name}
                onChange={update}
                placeholder="Ayesha Khan"
                autoComplete="name"
                error={fieldErrors.full_name}
                autoFocus
              />
              <Field
                id="email"
                label="Email"
                icon={Mail}
                type="email"
                value={form.email}
                onChange={update}
                placeholder="you@example.com"
                autoComplete="email"
                error={fieldErrors.email}
              />
            </>
          ) : null}

          {step === 1 ? (
            <>
              <Field
                id="city"
                label="City"
                icon={MapPin}
                value={form.city}
                onChange={update}
                placeholder="Lahore"
                autoComplete="address-level2"
                error={fieldErrors.city}
                autoFocus
              />

              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Whose clothes do you want to see?</legend>
                <p className="text-xs text-muted-foreground">Each page opens on this first. Change it any time.</p>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {SHOPPING_FOR.map((option) => {
                    const Icon = SHOPPING_ICONS[option];
                    const chosen = shoppingFor === option;
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setShoppingFor(option)}
                        aria-pressed={chosen}
                        className={cn(
                          "flex min-h-11 items-center gap-2.5 rounded-xl border px-3 text-left text-sm transition-all",
                          chosen
                            ? "border-primary bg-primary/10 font-medium shadow-sm"
                            : "border-border hover:border-primary/50 hover:bg-accent",
                        )}
                      >
                        <span
                          className={cn(
                            "flex size-8 shrink-0 items-center justify-center rounded-lg",
                            chosen ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                          )}
                        >
                          <Icon className="size-4" aria-hidden />
                        </span>
                        {SHOPPING_FOR_LABELS[option]}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <PasswordField
                id="password"
                label="Password"
                value={form.password}
                onChange={update}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                error={fieldErrors.password}
                autoFocus
              />
              <p
                className={cn(
                  "flex items-center gap-2 text-xs transition-colors",
                  form.password.length >= 8 ? "text-success" : "text-muted-foreground",
                )}
              >
                <Check className="size-3.5" aria-hidden />
                {form.password.length >= 8 ? "Long enough" : `${8 - form.password.length} more characters to go`}
              </p>
              <PasswordField
                id="password_confirm"
                label="Confirm password"
                value={form.password_confirm}
                onChange={update}
                placeholder="Type it again"
                autoComplete="new-password"
                error={fieldErrors.password_confirm}
              />
            </>
          ) : null}
        </div>

        <div className="mt-6 flex gap-3">
          {step > 0 ? (
            <Button type="button" variant="outline" size="lg" onClick={() => goTo(step - 1)} className="h-12 gap-2">
              <ArrowLeft className="size-4" aria-hidden />
              Back
            </Button>
          ) : null}

          <Button
            type="submit"
            size="lg"
            className="h-12 flex-1 gap-2 shadow-lg shadow-primary/20"
            disabled={register.isPending}
          >
            {register.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : last ? (
              <Check className="size-4" aria-hidden />
            ) : null}
            {register.isPending ? "Creating your closet..." : last ? "Create my closet" : "Next"}
            {!last && !register.isPending ? <ArrowRight className="size-4" aria-hidden /> : null}
          </Button>
        </div>
      </form>
    </div>
  );
}

/** "Step 2 of 3" with three bars: done, current, still to come. */
function Progress({ step }: { step: number }) {
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">
          Step {step + 1} of {STEPS.length}
        </span>
        <span className="text-muted-foreground">{STEPS[step].title}</span>
      </div>
      <ol className="mt-2 grid grid-cols-3 gap-2" aria-label="Progress">
        {STEPS.map((s, index) => (
          <li key={s.title} aria-current={index === step ? "step" : undefined}>
            <span className="sr-only">
              {s.title}: {index < step ? "done" : index === step ? "current" : "to come"}
            </span>
            <span
              aria-hidden
              className={cn(
                "block h-1.5 rounded-full transition-colors duration-500",
                index < step ? "bg-primary" : index === step ? "bg-primary/60" : "bg-muted",
              )}
            />
          </li>
        ))}
      </ol>
    </div>
  );
}

function Field({
  id,
  label,
  hint,
  error,
  icon: Icon,
  ...inputProps
}: React.ComponentProps<typeof Input> & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  icon: typeof Shirt;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Icon
          className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          id={id}
          name={id}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className="pl-10"
          {...inputProps}
        />
      </div>
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
