"use client";

import { Fragment, useState, type ReactNode } from "react";
import { Loader2, MoreVertical } from "lucide-react";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type TableAction = {
  label: string;
  icon?: ReactNode;
  onSelect: () => void | Promise<void>;
  disabled?: boolean;
  destructive?: boolean;
  separatorBefore?: boolean;
  confirmation?: {
    title: string;
    description: string;
    confirmLabel: string;
  };
};

export function TableActionsMenu({
  label = "Open actions menu",
  actions,
}: {
  label?: string;
  actions: TableAction[];
}) {
  const [pending, setPending] = useState<TableAction | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (action: TableAction) => {
    if (action.confirmation) {
      setPending(action);
      return;
    }
    try {
      await action.onSelect();
    } catch {
      // The action already emitted its contextual Sonner error.
    }
  };

  const confirm = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      await pending.onSelect();
      setPending(null);
    } catch {
      // The action provides its own contextual Sonner error. Keeping the
      // dialog open preserves context and gives the user a retry path.
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={label}
            />
          }
        >
          <MoreVertical aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {actions.map((action) => (
            <Fragment key={action.label}>
              {action.separatorBefore && <DropdownMenuSeparator />}
              <DropdownMenuItem
                variant={action.destructive ? "destructive" : "default"}
                disabled={action.disabled || busy}
                onClick={() => void run(action)}
              >
                {action.icon}
                {action.label}
              </DropdownMenuItem>
            </Fragment>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog
        open={Boolean(pending)}
        onOpenChange={(open) => !open && !busy && setPending(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pending?.confirmation?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.confirmation?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant={pending?.destructive ? "destructive" : "default"}
              disabled={busy}
              onClick={() => void confirm()}
            >
              {busy && (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              )}
              {busy ? "Working…" : pending?.confirmation?.confirmLabel}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
