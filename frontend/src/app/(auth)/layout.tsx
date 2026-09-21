import Image from "next/image";
import Link from "next/link";
import { Check, Shirt } from "lucide-react";

/**
 * What the panel beside the form says.
 *
 * Written about what the app does, not about any one person's clothes. Sign-in
 * screens are read by strangers, and a first-person line about what somebody
 * owns and how often they wore it belongs nowhere near one.
 */
const PROMISES = [
  "Find anything in seconds, because the app remembers which drawer it is in.",
  "See what is on sale before you buy something you already own.",
  "Borrow from a friend instead of buying for one evening.",
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Link href="/" className="flex w-fit items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Shirt className="size-5" />
          </span>
          <span className="text-lg font-semibold tracking-tight">Closette</span>
        </Link>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">{children}</div>
        </div>

        {/* Next to the form rather than buried in a policy page: the question
            people have at the moment they are asked to hand something over. */}
        <p className="mx-auto max-w-sm text-center text-xs leading-relaxed text-muted-foreground">
          Your closet is private. Nothing is shown to anybody until you choose to share
          it, and nothing is ever posted anywhere on your behalf.
        </p>
      </div>

      <div className="relative hidden overflow-hidden lg:block">
        <Image
          src="/images/wardrobe.jpg"
          alt=""
          fill
          priority
          sizes="50vw"
          className="object-cover"
        />

        {/* Heavy only where the words sit. Above that it clears quickly, so the
            panel still reads as a photograph rather than a dark brown block. */}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 via-45% to-transparent"
        />

        <div className="relative flex h-full flex-col justify-end gap-6 p-12 text-white">
          <h2 className="max-w-md text-3xl font-semibold leading-tight tracking-tight">
            Everything you own, in one place.
          </h2>

          <ul className="max-w-md space-y-3">
            {PROMISES.map((promise) => (
              <li key={promise} className="flex items-start gap-3 text-[0.95rem] leading-snug">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-white/20">
                  <Check className="size-3.5" aria-hidden />
                </span>
                <span className="text-white/90">{promise}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
