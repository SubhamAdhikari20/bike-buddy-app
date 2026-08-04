"use client";

import { useState, type ComponentProps } from "react";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

type ButtonVariant = ComponentProps<typeof Button>["variant"];

export function ConfirmActionDialog({
  triggerLabel,
  title,
  description,
  confirmLabel,
  triggerVariant = "outline",
  triggerClassName,
  confirmVariant = "destructive",
  disabled = false,
  onConfirm,
}: {
  triggerLabel: string;
  title: string;
  description: string;
  confirmLabel: string;
  triggerVariant?: ButtonVariant;
  triggerClassName?: string;
  confirmVariant?: ButtonVariant;
  disabled?: boolean;
  onConfirm: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
      setOpen(false);
    } catch {
      // The caller owns the visible, action-specific error message. Keeping
      // the dialog open lets the user retry or cancel without losing context.
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button
            type="button"
            variant={triggerVariant}
            className={triggerClassName}
            disabled={disabled}
          />
        }
      >
        {triggerLabel}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <Button
            type="button"
            variant={confirmVariant}
            disabled={busy}
            onClick={() => void confirm()}
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            {busy ? "Working…" : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
