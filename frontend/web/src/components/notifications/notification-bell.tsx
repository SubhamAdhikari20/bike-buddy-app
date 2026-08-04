"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import type { Role } from "@/lib/api";
import {
  notificationHref,
  notificationTypeLabel,
  type NotificationItem,
} from "@/lib/notifications";
import { useNotifications } from "@/components/notifications/notification-provider";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const severityDot: Record<NotificationItem["severity"], string> = {
  info: "bg-blue-500",
  success: "bg-green-600",
  warning: "bg-amber-500",
  error: "bg-red-600",
};

const compactTime = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

export function NotificationBell({ role }: { role: Role }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const {
    notifications,
    unreadCount,
    connectionStatus,
    initialLoading,
    refreshing,
    markingAllRead,
    pendingReadIds,
    error,
    markRead,
    markAllRead,
  } = useNotifications();
  const recent = notifications.slice(0, 5);
  const countLabel = unreadCount > 99 ? "99+" : String(unreadCount);
  const live = connectionStatus === "live";

  const view = (notification: NotificationItem) => {
    const href = notificationHref(notification.action, role);
    if (!notification.readAt) {
      void markRead(notification._id).catch(() => undefined);
    }
    if (href) {
      setOpen(false);
      router.push(href);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            className="relative"
            aria-label={`Notifications, ${unreadCount} unread`}
          />
        }
      >
        <Bell aria-hidden="true" />
        {unreadCount > 0 && (
          <span
            className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-5 text-white ring-2 ring-background"
            aria-hidden="true"
          >
            {countLabel}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[min(24rem,calc(100vw-2rem))] overflow-hidden"
      >
        <div className="flex items-start justify-between gap-3 border-b p-4">
          <div>
            <PopoverTitle className="font-semibold">Notifications</PopoverTitle>
            <PopoverDescription className="mt-0.5 text-xs text-muted-foreground">
              {unreadCount === 0
                ? "You are caught up."
                : `${unreadCount} unread ${unreadCount === 1 ? "update" : "updates"}.`}
            </PopoverDescription>
          </div>
          {unreadCount > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={markingAllRead}
              onClick={() => void markAllRead().catch(() => undefined)}
            >
              {markingAllRead ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : (
                <CheckCheck aria-hidden="true" />
              )}
              Read all
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
          <span
            className={cn(
              "size-2 rounded-full",
              live ? "bg-green-600" : "animate-pulse bg-amber-500",
            )}
            aria-hidden="true"
          />
          {live
            ? "Live while this portal is open"
            : "Reconnecting and checking saved updates…"}
          {refreshing && <Loader2 className="ml-auto size-3 animate-spin" />}
        </div>

        {initialLoading ? (
          <div
            className="flex min-h-32 items-center justify-center gap-2 text-sm text-muted-foreground"
            role="status"
          >
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Loading notifications…
          </div>
        ) : recent.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            No notifications yet. New booking and safety updates will appear
            here while you use the portal.
          </p>
        ) : (
          <ul className="max-h-[min(26rem,65vh)] divide-y overflow-y-auto">
            {recent.map((notification) => {
              const href = notificationHref(notification.action, role);
              const pending = pendingReadIds.has(notification._id);
              return (
                <li key={notification._id}>
                  <article
                    className={cn(
                      "relative space-y-2 p-4",
                      !notification.readAt &&
                        "bg-blue-50/70 dark:bg-blue-950/20",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          "mt-1.5 size-2 shrink-0 rounded-full",
                          severityDot[notification.severity],
                        )}
                        aria-hidden="true"
                      />
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold leading-5">
                          {notification.title}
                        </h3>
                        <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted-foreground">
                          {notification.message}
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {notificationTypeLabel(notification.type)} ·{" "}
                          <time dateTime={notification.createdAt}>
                            {compactTime(notification.createdAt)}
                          </time>
                        </p>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      {!notification.readAt && (
                        <Button
                          type="button"
                          size="xs"
                          variant="ghost"
                          disabled={pending}
                          onClick={() =>
                            void markRead(notification._id).catch(
                              () => undefined,
                            )
                          }
                        >
                          {pending && (
                            <Loader2
                              className="animate-spin"
                              aria-hidden="true"
                            />
                          )}
                          Mark read
                        </Button>
                      )}
                      {href && (
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          onClick={() => view(notification)}
                        >
                          View
                        </Button>
                      )}
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        )}

        {error && (
          <p
            className="border-t bg-destructive/10 px-4 py-2 text-xs text-destructive"
            role="alert"
          >
            {error}
          </p>
        )}
        <div className="border-t p-2">
          <Button
            render={
              <Link href="/notifications" onClick={() => setOpen(false)} />
            }
            variant="ghost"
            className="w-full"
          >
            View notification history
          </Button>
        </div>
      </PopoverContent>
      <span className="sr-only" aria-live="polite">
        {unreadCount} unread notifications
      </span>
    </Popover>
  );
}
