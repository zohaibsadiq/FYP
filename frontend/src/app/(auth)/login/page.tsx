"use client";

/**
 * /login
 *
 * "use client" is required because this page uses state, event handlers and
 * hooks. Pages without interactivity (like the landing page) stay server
 * components, which is faster.
 */

import Link from "next/link";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLogin } from "@/hooks/use-auth";
import { getErrorMessage } from "@/lib/api";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // useLogin() handles the API call, saves the tokens, and redirects to
  // /dashboard on success. All this page does is collect the two inputs.
  const login = useLogin();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    login.mutate(
      { email: email.trim(), password },
      {
        onError: (error) => toast.error(getErrorMessage(error, "Could not sign in.")),
      },
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Sign in to open your wardrobe.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <Button type="submit" className="w-full" disabled={login.isPending}>
          {login.isPending && <Loader2 className="size-4 animate-spin" />}
          {login.isPending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        New here?{" "}
        <Link href="/register" className="font-medium text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
