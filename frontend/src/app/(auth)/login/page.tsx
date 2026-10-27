"use client";

import { useState } from "react";
import { ArrowRight, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";

import { PasswordField } from "@/components/form/password-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLogin, useSkipIfSignedIn } from "@/hooks/use-auth";
import { getErrorMessage } from "@/lib/api";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // The toast disappears on a timer, so the same text also stays in the page
  // for anyone who looks away or reads through a screen reader.
  const [formError, setFormError] = useState("");

  const login = useLogin();
  useSkipIfSignedIn();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError("");
    login.mutate(
      { email: email.trim(), password },
      {
        onError: (error) => {
          const message = getErrorMessage(error, "Check the email and password, then try again.");
          setFormError(message);
          toast.error(message);
        },
      },
    );
  }

  return (
    <div>
      <p className="text-sm font-medium text-primary">Sign in</p>
      <h1 className="mt-1.5 font-display text-3xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mt-2 text-sm text-muted-foreground">Open your wardrobe where you left it.</p>

      {formError ? (
        <p
          role="alert"
          className="mt-6 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {formError}
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-7 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail
              className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10"
              required
            />
          </div>
        </div>

        <PasswordField
          id="password"
          label="Password"
          autoComplete="current-password"
          placeholder="Your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <Button type="submit" size="lg" className="h-12 w-full gap-2 shadow-lg shadow-primary/20" disabled={login.isPending}>
          {login.isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <ArrowRight className="size-4" aria-hidden />
          )}
          {login.isPending ? "Signing in..." : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
