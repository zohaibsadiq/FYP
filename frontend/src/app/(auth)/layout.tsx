import Link from "next/link";
import { Shirt } from "lucide-react";

/**
 * Shared shell for /login and /register.
 *
 * The folder name is in brackets - (auth) - which makes it a Next.js "route
 * group". It groups files so they can share this layout, WITHOUT adding "auth"
 * to the URL. So the page at (auth)/login/page.tsx is served at /login.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* ---- Left: the form ---- */}
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Link href="/" className="flex w-fit items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Shirt className="size-5" />
          </span>
          <span className="text-lg font-semibold tracking-tight">Lumiere</span>
        </Link>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </div>

      {/* ---- Right: decorative panel, hidden on small screens ---- */}
      <div className="relative hidden overflow-hidden bg-primary lg:block">
        <div
          aria-hidden
          className="absolute -right-20 -top-20 size-[28rem] rounded-full bg-white/10 blur-3xl"
        />
        <div
          aria-hidden
          className="absolute -bottom-32 -left-20 size-[26rem] rounded-full bg-black/20 blur-3xl"
        />

        <div className="relative flex h-full flex-col justify-end p-12 text-primary-foreground">
          <blockquote className="max-w-md text-2xl font-medium leading-snug tracking-tight">
            &ldquo;I know I own a navy blazer. I just have no idea which drawer it
            is in, or whether I already wore it to the last three dinners.&rdquo;
          </blockquote>
          <p className="mt-5 text-sm text-primary-foreground/70">
            The problem this system solves.
          </p>
        </div>
      </div>
    </div>
  );
}
