import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  icon: LucideIcon;
  title: string;
  body: string;
  /** Numbered steps, for the first-run case where the user has never done this. */
  steps?: string[];
  action?: { href: string; label: string };
  secondary?: React.ReactNode;
}

/** A friendly box for a page with nothing on it yet, with the way forward. */
export function EmptyState({ icon: Icon, title, body, steps, action, secondary }: Props) {
  return (
    <div className="relative mx-auto max-w-lg overflow-hidden rounded-3xl border border-primary/15 bg-gradient-to-br from-primary/10 via-card to-chart-4/10 px-6 py-12 text-center">
      <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-primary/10 blur-2xl" />

      <span className="animate-float relative mx-auto flex size-16 items-center justify-center rounded-2xl bg-card text-primary shadow-lg shadow-primary/10">
        <Icon className="size-7" aria-hidden />
      </span>

      <h2 className="relative mt-5 font-display text-2xl font-semibold tracking-tight">{title}</h2>
      <p className="relative mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">{body}</p>

      {steps?.length ? (
        <ol className="relative mx-auto mt-6 max-w-xs space-y-2 text-left">
          {steps.map((step, i) => (
            <li key={step} className="flex items-center gap-3 rounded-xl bg-card/80 px-3 py-2 text-sm backdrop-blur">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                {i + 1}
              </span>
              <span className="leading-snug">{step}</span>
            </li>
          ))}
        </ol>
      ) : null}

      {action ? (
        <Link
          href={action.href}
          className={cn(
            buttonVariants({ size: "lg" }),
            "relative mt-7 h-11 w-full px-6 shadow-lg shadow-primary/20 sm:w-auto",
          )}
        >
          {action.label}
        </Link>
      ) : null}

      {secondary ? <div className="relative mt-4">{secondary}</div> : null}
    </div>
  );
}
