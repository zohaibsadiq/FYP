import { AuthPanel, AuthSwitch } from "@/components/marketing/auth-panel";
import { Brand } from "@/components/marketing/brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* Kept short on purpose: the form, the way to the other form, and
          nothing else, so neither page needs to scroll on a laptop. */}
      <div className="flex flex-col px-5 py-4 sm:px-10">
        <div className="flex items-center justify-between gap-4">
          <Brand />
          <AuthSwitch />
        </div>

        <div className="flex flex-1 items-center justify-center py-4">
          <div className="animate-in fade-in slide-in-from-bottom-3 w-full max-w-sm duration-500">
            {children}
          </div>
        </div>

        {/* On a phone the photo panel is not shown, so the promise it carries
            sits under the form instead. */}
        <p className="mx-auto max-w-sm text-center text-xs leading-relaxed text-muted-foreground lg:hidden">
          Your closet is private. Nothing is shown to anybody until you choose to share it, and
          nothing is ever posted anywhere on your behalf.
        </p>
      </div>

      <AuthPanel />
    </div>
  );
}
