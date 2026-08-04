"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BellRing,
  Check,
  CheckCheck,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useSession } from "@/components/auth/session-provider";
import { useNotifications } from "@/components/notifications/notification-provider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  notificationHref,
  notificationTypeLabel,
  type NotificationItem,
} from "@/lib/notifications";

const severityStyles: Record<NotificationItem["severity"], string> = {
  info: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200",
  success:
    "border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950/30 dark:text-green-200",
  warning:
    "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200",
  error:
    "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200",
};

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });

export function NotificationHistory() {
  const router = useRouter();
  const { session } = useSession();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const {
    notifications,
    unreadCount,
    connectionStatus,
    initialLoading,
    refreshing,
    loadingMore,
    markingAllRead,
    pendingReadIds,
    hasMore,
    error,
    refresh,
    loadMore,
    markRead,
    markAllRead,
  } = useNotifications();

  const visibleNotifications = useMemo(
    () =>
      filter === "unread"
        ? notifications.filter((notification) => !notification.readAt)
        : notifications,
    [filter, notifications],
  );
  const live = connectionStatus === "live";

  const openNotification = (notification: NotificationItem) => {
    if (!session) return;
    const href = notificationHref(notification.action, session.user.role);
    if (!notification.readAt) {
      void markRead(notification._id).catch(() => undefined);
    }
    if (href) router.push(href);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
            Account updates
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            Notification history
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Booking, payment, verification, support, and safety changes are
            saved here for 90 days.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={refreshing}
            onClick={() => void refresh().catch(() => undefined)}
          >
            <RefreshCw
              className={cn(refreshing && "animate-spin")}
              aria-hidden="true"
            />
            Refresh
          </Button>
          <Button
            type="button"
            className="min-h-11"
            disabled={unreadCount === 0 || markingAllRead}
            onClick={() => void markAllRead().catch(() => undefined)}
          >
            {markingAllRead ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : (
              <CheckCheck aria-hidden="true" />
            )}
            Mark all read
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="border-b sm:grid-cols-[1fr_auto]">
          <div>
            <CardTitle>Inbox</CardTitle>
            <CardDescription>
              {unreadCount === 0
                ? "No unread notifications"
                : `${unreadCount} unread ${unreadCount === 1 ? "notification" : "notifications"}`}
            </CardDescription>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 sm:mt-0 sm:justify-end">
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              <span
                className={cn(
                  "size-2 rounded-full",
                  live ? "bg-green-600" : "animate-pulse bg-amber-500",
                )}
                aria-hidden="true"
              />
              {live ? "Live while open" : "Reconnecting"}
            </span>
            <div
              className="flex rounded-lg border bg-muted/30 p-1"
              aria-label="Filter notifications"
            >
              {(["all", "unread"] as const).map((value) => (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant={filter === value ? "secondary" : "ghost"}
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                >
                  {value === "all" ? "All" : "Unread"}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-0">
          {error && (
            <div
              className="mx-4 mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
              role="alert"
            >
              {error}
            </div>
          )}

          {initialLoading ? (
            <div
              className="flex min-h-64 items-center justify-center gap-2 text-sm text-muted-foreground"
              role="status"
            >
              <Loader2 className="animate-spin" aria-hidden="true" />
              Loading notification history…
            </div>
          ) : visibleNotifications.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
              <span className="rounded-full bg-muted p-4">
                <BellRing
                  className="size-6 text-muted-foreground"
                  aria-hidden="true"
                />
              </span>
              <h2 className="mt-4 font-semibold">
                {filter === "unread"
                  ? "You are caught up"
                  : "No notifications yet"}
              </h2>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                {filter === "unread"
                  ? "Choose All to review earlier updates."
                  : "New account and activity updates will appear here."}
              </p>
            </div>
          ) : (
            <ul className="divide-y">
              {visibleNotifications.map((notification) => {
                const href = session
                  ? notificationHref(notification.action, session.user.role)
                  : null;
                const pending = pendingReadIds.has(notification._id);
                return (
                  <li key={notification._id}>
                    <article
                      className={cn(
                        "grid gap-4 p-4 transition-colors sm:grid-cols-[auto_1fr_auto] sm:items-start sm:p-5",
                        !notification.readAt &&
                          "bg-blue-50/50 dark:bg-blue-950/15",
                      )}
                    >
                      <span
                        className={cn(
                          "inline-flex w-fit rounded-full border px-2 py-1 text-[11px] font-semibold capitalize",
                          severityStyles[notification.severity],
                        )}
                      >
                        {notification.severity}
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="font-semibold">
                            {notification.title}
                          </h2>
                          {!notification.readAt && (
                            <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                              New
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                          {notification.message}
                        </p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {notificationTypeLabel(notification.type)} ·{" "}
                          <time dateTime={notification.createdAt}>
                            {formatTime(notification.createdAt)}
                          </time>
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 sm:justify-end">
                        {!notification.readAt && (
                          <Button
                            type="button"
                            variant="ghost"
                            className="min-h-10"
                            disabled={pending}
                            onClick={() =>
                              void markRead(notification._id).catch(
                                () => undefined,
                              )
                            }
                          >
                            {pending ? (
                              <Loader2
                                className="animate-spin"
                                aria-hidden="true"
                              />
                            ) : (
                              <Check aria-hidden="true" />
                            )}
                            Mark read
                          </Button>
                        )}
                        {href && (
                          <Button
                            type="button"
                            variant="outline"
                            className="min-h-10"
                            onClick={() => openNotification(notification)}
                          >
                            View
                            <ArrowRight aria-hidden="true" />
                          </Button>
                        )}
                      </div>
                    </article>
                  </li>
                );
              })}
            </ul>
          )}

          {hasMore && filter === "all" && (
            <div className="flex justify-center border-t p-4">
              <Button
                type="button"
                variant="outline"
                className="min-h-11 min-w-36"
                disabled={loadingMore}
                onClick={() => void loadMore().catch(() => undefined)}
              >
                {loadingMore && (
                  <Loader2 className="animate-spin" aria-hidden="true" />
                )}
                Load older
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
