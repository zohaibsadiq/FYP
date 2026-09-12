"use client";

import { LogOut, Settings, Shirt } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCurrentUser, useLogout } from "@/hooks/use-auth";

/** Turns "Ayesha Khan" into "AK" for the avatar circle. */
function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function Topbar() {
  const { data: user } = useCurrentUser();
  const logout = useLogout();

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border bg-card px-4 lg:px-6">
      {/* Logo shows on mobile only - on desktop the sidebar already has it */}
      <div className="flex items-center gap-2 lg:hidden">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Shirt className="size-4" />
        </span>
        <span className="font-semibold tracking-tight">Closette</span>
      </div>

      <div className="hidden lg:block" />

      <DropdownMenu>
        {/* Base UI uses `render` where Radix used `asChild`: it tells the
            trigger to BE this Button instead of wrapping one. */}
        <DropdownMenuTrigger
          render={<Button variant="ghost" className="h-auto gap-2 px-2 py-1.5" />}
        >
          <Avatar className="size-8">
            <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
              {user ? initials(user.display_name) : "?"}
            </AvatarFallback>
          </Avatar>
          <span className="hidden text-sm font-medium sm:inline">
            {user?.display_name ?? "Loading"}
          </span>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-56">
          {/* Base UI requires GroupLabel (which DropdownMenuLabel renders) to
              sit inside a Group. Radix allowed a bare label; this build does not. */}
          <DropdownMenuGroup>
            <DropdownMenuLabel className="font-normal">
              <p className="text-sm font-medium">{user?.full_name || user?.display_name}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
            </DropdownMenuLabel>
          </DropdownMenuGroup>

          <DropdownMenuSeparator />

          <DropdownMenuItem disabled>
            <Settings className="size-4" />
            Profile settings
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={logout} variant="destructive">
            <LogOut className="size-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
