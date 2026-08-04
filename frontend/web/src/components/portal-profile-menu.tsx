"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, LogOut, UserRound } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { mediaUrl, type AuthSession } from "@/lib/api";

export function PortalProfileMenu({
  session,
  onSignOut,
}: {
  session: AuthSession;
  onSignOut: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const name = session.profile.fullName || session.user.email;
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  const signOut = async () => {
    setBusy(true);
    try {
      await onSignOut();
      setConfirmOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              className="h-10 gap-2 rounded-full px-1.5 pr-2 sm:rounded-lg"
              aria-label="Open profile menu"
            />
          }
        >
          <span className="flex size-8 items-center justify-center overflow-hidden rounded-full bg-blue-100 text-xs font-bold text-blue-800 dark:bg-blue-950 dark:text-blue-200">
            {session.profile.profilePictureUrl ? (
              // Profile images may come from Bike Buddy uploads or Google.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={mediaUrl(session.profile.profilePictureUrl)}
                alt=""
                className="size-full object-cover"
              />
            ) : (
              initials || "BB"
            )}
          </span>
          <span className="hidden max-w-32 truncate text-sm sm:inline">
            {name}
          </span>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 p-0">
          <div className="border-b p-4">
            <PopoverTitle className="truncate font-semibold">
              {name}
            </PopoverTitle>
            <PopoverDescription className="mt-1 truncate text-xs text-muted-foreground">
              {session.user.email}
            </PopoverDescription>
            <span className="mt-2 inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium capitalize text-blue-700 dark:bg-blue-950 dark:text-blue-200">
              {session.user.role} portal
            </span>
          </div>
          <div className="space-y-1 p-2">
            <Link
              href="/profile"
              onClick={() => setOpen(false)}
              className="flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <UserRound className="size-4" aria-hidden="true" />
              Manage profile
            </Link>
            <button
              type="button"
              className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-medium text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => {
                setOpen(false);
                setConfirmOpen(true);
              }}
            >
              <LogOut className="size-4" aria-hidden="true" />
              Sign out
            </button>
          </div>
          <p className="border-t px-4 py-2 text-center text-xs text-muted-foreground">
            Secured by Bike Buddy
          </p>
        </PopoverContent>
      </Popover>

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(next) => !busy && setConfirmOpen(next)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out of Bike Buddy?</AlertDialogTitle>
            <AlertDialogDescription>
              Your portal session will end and unsaved form changes will be
              lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              disabled={busy}
              onClick={() => void signOut()}
            >
              {busy && (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              )}
              {busy ? "Signing out…" : "Sign out"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
