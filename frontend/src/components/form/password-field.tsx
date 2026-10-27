"use client";

import { useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * A password box with a Show / Hide switch, so a long password can be checked
 * before it is sent. The switch carries its word, not only an eye.
 */
export function PasswordField({
  id,
  label,
  hint,
  error,
  ...inputProps
}: Omit<React.ComponentProps<typeof Input>, "type"> & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
}) {
  const [shown, setShown] = useState(false);

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Lock
          className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          id={id}
          name={id}
          type={shown ? "text" : "password"}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className="pl-10 pr-20"
          {...inputProps}
        />
        <button
          type="button"
          onClick={() => setShown((value) => !value)}
          className="absolute right-1.5 top-1/2 flex h-8 -translate-y-1/2 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {shown ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
          {shown ? "Hide" : "Show"}
        </button>
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
