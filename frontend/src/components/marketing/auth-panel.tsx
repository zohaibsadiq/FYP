"use client";

import Image from "next/image";
import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import { Check, CloudSun, MapPin } from "lucide-react";

/**
 * The photo and the words beside the sign-in and sign-up forms. Each page gets
 * its own picture and its own promise, chosen from the address.
 *
 * Written about what the app does, not about any one person's clothes. Sign-in
 * screens are read by strangers, and a first-person line about what somebody
 * owns and how often they wore it belongs nowhere near one.
 */
const PANELS = {
  login: {
    image: "/images/sign-in.jpg",
    headline: ["Everything you own,", "where you left it."],
    points: [
      "Find anything in seconds, because the app remembers which drawer it is in.",
      "See what is on sale before you buy something you already own.",
      "Borrow from a friend instead of buying for one evening.",
    ],
  },
  register: {
    image: "/images/sign-up.jpg",
    headline: ["Your closet starts", "with one item."],
    points: [
      "Take a photo, say where it lives, and it is in. About a minute.",
      "Private until you choose to share it with a friend.",
      "Free, and nothing is ever posted anywhere on your behalf.",
    ],
  },
};

export function AuthPanel() {
  const segment = useSelectedLayoutSegment();
  const panel = segment === "register" ? PANELS.register : PANELS.login;

  return (
    <div className="relative hidden overflow-hidden lg:block">
      <Image key={panel.image} src={panel.image} alt="" fill priority sizes="55vw" className="object-cover" />

      {/* Dark only where the words sit, so the photo keeps its own colours. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 via-45% to-black/5"
      />

      <div className="animate-float absolute left-12 top-14 rounded-2xl border border-white/25 bg-white/15 px-4 py-3 text-white shadow-lg backdrop-blur-md">
        <p className="flex items-center gap-2 text-sm font-medium">
          <CloudSun className="size-4" aria-hidden />
          31 C in Lahore today
        </p>
        <p className="mt-0.5 text-xs text-white/80">Warm. Light clothes are enough.</p>
      </div>

      <div
        className="animate-float-slow absolute right-12 top-36 rounded-2xl border border-white/25 bg-white/15 px-4 py-3 text-white shadow-lg backdrop-blur-md"
        style={{ animationDelay: "1.2s" }}
      >
        <p className="flex items-center gap-2 text-sm font-medium">
          <MapPin className="size-4" aria-hidden />
          Bedroom &gt; Wardrobe &gt; Drawer 2
        </p>
        <p className="mt-0.5 text-xs text-white/80">Navy Kurta is kept here</p>
      </div>

      <div className="relative flex h-full flex-col justify-end gap-6 p-12 text-white">
        <h2 className="max-w-md font-display text-4xl font-semibold leading-tight tracking-tight">
          {panel.headline[0]} <span className="italic">{panel.headline[1]}</span>
        </h2>

        <ul className="max-w-md space-y-3">
          {panel.points.map((point, index) => (
            <li
              key={point}
              className="animate-in fade-in slide-in-from-bottom-2 flex items-start gap-3 text-[0.95rem] leading-snug duration-700"
              style={{ animationDelay: `${200 + index * 120}ms` }}
            >
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-white/25">
                <Check className="size-3.5" aria-hidden />
              </span>
              <span className="text-white/90">{point}</span>
            </li>
          ))}
        </ul>

        <p className="max-w-md text-xs leading-relaxed text-white/70">
          Your closet is private. Nothing is shown to anybody until you choose to share it, and
          nothing is ever posted anywhere on your behalf.
        </p>
      </div>
    </div>
  );
}

/** The small link in the corner that swaps between the two forms. */
export function AuthSwitch() {
  const segment = useSelectedLayoutSegment();

  if (segment === "register") {
    return (
      <p className="text-sm text-muted-foreground">
        Have an account?{" "}
        <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    );
  }
  return (
    <p className="text-sm text-muted-foreground">
      New here?{" "}
      <Link href="/register" className="font-medium text-primary underline-offset-4 hover:underline">
        Create your closet
      </Link>
    </p>
  );
}
