import Link from "next/link";
import { Shirt } from "lucide-react";

import { cn } from "@/lib/utils";

/** The logo mark and the name, as one link back to the front page. */
export function Brand({ className, light = false }: { className?: string; light?: boolean }) {
  return (
    <Link href="/" className={cn("flex w-fit items-center gap-2.5", className)}>
      <span
        className={cn(
          "flex size-9 items-center justify-center rounded-xl shadow-sm",
          light ? "bg-white/15 text-white backdrop-blur" : "bg-primary text-primary-foreground",
        )}
      >
        <Shirt className="size-5" aria-hidden />
      </span>
      <span className={cn("font-display text-xl font-semibold tracking-tight", light && "text-white")}>
        My Closette
      </span>
    </Link>
  );
}
