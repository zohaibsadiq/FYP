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

export function EmptyState({ icon: Icon, title, body, steps, action, secondary }: Props) {
  return (
    <div className="mx-auto max-w-md rounded-xl border border-dashed border-border px-6 py-12 text-center">
      <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="size-7" aria-hidden />
      </span>

      <h2 className="mt-5 text-lg font-semibold tracking-tight">{title}</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">{body}</p>

      {steps?.length ? (
        <ol className="mx-auto mt-6 max-w-xs space-y-3 text-left">
          {steps.map((step, i) => (
            <li key={step} className="flex gap-3 text-sm">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
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
          className={cn(buttonVariants({ size: "lg" }), "mt-7 h-11 w-full px-6 sm:w-auto")}
        >
          {action.label}
        </Link>
      ) : null}

      {secondary ? <div className="mt-4">{secondary}</div> : null}
    </div>
  );
}
