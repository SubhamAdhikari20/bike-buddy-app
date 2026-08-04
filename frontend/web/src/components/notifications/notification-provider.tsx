"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Role } from "@/lib/api";
import {
  isNotificationItem,
  isNotificationReadyEvent,
  isNotificationResyncEvent,
  notificationHref,
  notificationsApi,
  notificationStreamUrl,
  parseServerEvent,
  type NotificationItem,
} from "@/lib/notifications";

export type NotificationConnectionStatus =
  | "connecting"
  | "live"
  | "reconnecting";

type NotificationContextValue = {
  notifications: NotificationItem[];
  unreadCount: number;
  connectionStatus: NotificationConnectionStatus;
  initialLoading: boolean;
  refreshing: boolean;
  loadingMore: boolean;
  markingAllRead: boolean;
  pendingReadIds: ReadonlySet<string>;
  hasMore: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  markRead: (notificationId: string) => Promise<void>;
  markAllRead: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextValue | null>(
  null,
);

const storageKeyFor = (userId: string) =>
  `bike-buddy.notifications.${userId}.last-sequence`;

const errorMessage = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Notifications could not be refreshed. Please try again.";

export function NotificationProvider({
  userId,
  role,
  children,
}: {
  userId: string;
  role: Role;
  children: ReactNode;
}) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [connectionStatus, setConnectionStatus] =
    useState<NotificationConnectionStatus>("connecting");
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [pendingReadIds, setPendingReadIds] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const itemsRef = useRef<NotificationItem[]>([]);
  const knownIdsRef = useRef(new Set<string>());
  const lastSequenceRef = useRef(0);
  const storageKeyRef = useRef(storageKeyFor(userId));
  const readyForLiveToastsRef = useRef(false);
  const sourceRef = useRef<EventSource | null>(null);
  const nextCursorRef = useRef<number | null>(null);
  const generationRef = useRef(0);
  const resyncPromiseRef = useRef<Promise<void> | null>(null);
  const loadMorePromiseRef = useRef<Promise<void> | null>(null);
  const pendingReadIdsRef = useRef(new Set<string>());

  const rememberSequence = useCallback((sequence: number) => {
    if (sequence <= lastSequenceRef.current) return;
    lastSequenceRef.current = sequence;
    try {
      window.sessionStorage.setItem(storageKeyRef.current, String(sequence));
    } catch {
      // Private browsing or a disabled storage API should not stop live updates.
    }
  }, []);

  const mergeNotifications = useCallback(
    (incoming: readonly NotificationItem[]) => {
      if (incoming.length === 0) return;
      const byId = new Map(
        itemsRef.current.map((notification) => [
          notification._id,
          notification,
        ]),
      );
      let maxSequence = lastSequenceRef.current;

      incoming.forEach((notification) => {
        byId.set(notification._id, notification);
        knownIdsRef.current.add(notification._id);
        maxSequence = Math.max(maxSequence, notification.sequence);
      });

      const next = Array.from(byId.values()).sort(
        (left, right) => right.sequence - left.sequence,
      );
      itemsRef.current = next;
      setNotifications(next);
      rememberSequence(maxSequence);
    },
    [rememberSequence],
  );

  const markRead = useCallback(
    async (notificationId: string) => {
      const existing = itemsRef.current.find(
        (notification) => notification._id === notificationId,
      );
      if (
        !existing ||
        existing.readAt ||
        pendingReadIdsRef.current.has(notificationId)
      ) {
        return;
      }

      pendingReadIdsRef.current.add(notificationId);
      setPendingReadIds(new Set(pendingReadIdsRef.current));
      try {
        const response = await notificationsApi.markRead(notificationId);
        if (!isNotificationItem(response.data)) {
          throw new Error("The server returned an invalid notification.");
        }
        mergeNotifications([response.data]);
        setUnreadCount((current) => Math.max(0, current - 1));
      } catch (caught) {
        toast.error("Notification was not marked as read", {
          description: errorMessage(caught),
        });
        throw caught;
      } finally {
        pendingReadIdsRef.current.delete(notificationId);
        setPendingReadIds(new Set(pendingReadIdsRef.current));
      }
    },
    [mergeNotifications],
  );

  const showLiveToast = useCallback(
    (notification: NotificationItem) => {
      const href = notificationHref(notification.action, role);
      const options = {
        description: notification.message,
        ...(href
          ? {
              action: {
                label: "View",
                onClick: () => {
                  void markRead(notification._id).catch(() => undefined);
                  router.push(href);
                },
              },
            }
          : {}),
      };

      switch (notification.severity) {
        case "success":
          toast.success(notification.title, options);
          break;
        case "warning":
          toast.warning(notification.title, options);
          break;
        case "error":
          toast.error(notification.title, options);
          break;
        default:
          toast.info(notification.title, options);
      }
    },
    [markRead, role, router],
  );

  const runResync = useCallback(
    (initial: boolean, generation = generationRef.current) => {
      if (resyncPromiseRef.current) return resyncPromiseRef.current;

      const promise = (async () => {
        const baseline = lastSequenceRef.current;
        let before: number | undefined;
        let firstPage = true;
        let finalCursor: number | null = null;
        let finalHasMore = false;
        const visitedCursors = new Set<number>();

        try {
          do {
            const response = await notificationsApi.list({
              before,
              limit: 50,
            });
            if (generation !== generationRef.current) return;

            const validItems = response.data.items.filter(isNotificationItem);
            mergeNotifications(validItems);
            if (firstPage) setUnreadCount(response.data.unreadCount);

            finalCursor = response.data.pageInfo.nextCursor;
            finalHasMore = response.data.pageInfo.hasMore;
            const oldestSequence = validItems.at(-1)?.sequence;
            const caughtUp =
              baseline === 0 ||
              oldestSequence === undefined ||
              oldestSequence <= baseline;

            if (caughtUp || !finalHasMore || finalCursor === null) break;
            if (visitedCursors.has(finalCursor)) {
              throw new Error(
                "Notification history returned a repeated cursor.",
              );
            }
            visitedCursors.add(finalCursor);
            before = finalCursor;
            firstPage = false;
          } while (true);

          if (initial) {
            nextCursorRef.current = finalCursor;
            setHasMore(finalHasMore && finalCursor !== null);
          } else if (
            nextCursorRef.current !== null &&
            finalCursor !== null &&
            finalCursor < nextCursorRef.current
          ) {
            nextCursorRef.current = finalCursor;
          }
          setError(null);
        } catch (caught) {
          if (generation !== generationRef.current) return;
          setError(errorMessage(caught));
          throw caught;
        }
      })();

      resyncPromiseRef.current = promise;
      void promise
        .finally(() => {
          if (resyncPromiseRef.current === promise) {
            resyncPromiseRef.current = null;
          }
        })
        .catch(() => undefined);
      return promise;
    },
    [mergeNotifications],
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await runResync(false);
    } finally {
      setRefreshing(false);
    }
  }, [runResync]);

  const loadMore = useCallback(() => {
    if (loadMorePromiseRef.current) return loadMorePromiseRef.current;
    const cursor = nextCursorRef.current;
    if (cursor === null) return Promise.resolve();
    const generation = generationRef.current;

    setLoadingMore(true);
    const promise = notificationsApi
      .list({ before: cursor, limit: 20 })
      .then((response) => {
        if (generation !== generationRef.current) return;
        mergeNotifications(response.data.items.filter(isNotificationItem));
        setUnreadCount(response.data.unreadCount);
        nextCursorRef.current = response.data.pageInfo.nextCursor;
        setHasMore(
          response.data.pageInfo.hasMore &&
            response.data.pageInfo.nextCursor !== null,
        );
        setError(null);
      })
      .catch((caught: unknown) => {
        if (generation !== generationRef.current) return;
        const message = errorMessage(caught);
        setError(message);
        toast.error("More notifications could not be loaded", {
          description: message,
        });
        throw caught;
      })
      .finally(() => {
        if (generation === generationRef.current) setLoadingMore(false);
      });

    loadMorePromiseRef.current = promise;
    void promise
      .finally(() => {
        if (loadMorePromiseRef.current === promise) {
          loadMorePromiseRef.current = null;
        }
      })
      .catch(() => undefined);
    return promise;
  }, [mergeNotifications]);

  const markAllRead = useCallback(async () => {
    if (markingAllRead) return;
    setMarkingAllRead(true);
    try {
      const response = await notificationsApi.markAllRead();
      mergeNotifications(
        itemsRef.current.map((notification) =>
          notification.readAt
            ? notification
            : { ...notification, readAt: response.data.readAt },
        ),
      );
      setUnreadCount(0);
      toast.success("Notifications marked as read", {
        description:
          response.data.updatedCount === 1
            ? "1 notification was updated."
            : `${response.data.updatedCount} notifications were updated.`,
      });
    } catch (caught) {
      toast.error("Notifications were not marked as read", {
        description: errorMessage(caught),
      });
      throw caught;
    } finally {
      setMarkingAllRead(false);
    }
  }, [markingAllRead, mergeNotifications]);

  useEffect(() => {
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    const storageKey = storageKeyFor(userId);
    storageKeyRef.current = storageKey;
    let storedSequence = 0;
    try {
      const stored = Number(window.sessionStorage.getItem(storageKey));
      if (Number.isSafeInteger(stored) && stored > 0) storedSequence = stored;
    } catch {
      // The REST snapshot still establishes a safe baseline without storage.
    }

    lastSequenceRef.current = storedSequence;
    knownIdsRef.current.clear();
    itemsRef.current = [];
    pendingReadIdsRef.current.clear();
    nextCursorRef.current = null;
    readyForLiveToastsRef.current = false;

    const source = new EventSource(notificationStreamUrl(storedSequence), {
      withCredentials: true,
    });
    sourceRef.current = source;

    source.onopen = () => {
      if (generation !== generationRef.current) return;
      readyForLiveToastsRef.current = false;
      setConnectionStatus("connecting");
    };

    source.addEventListener("notification", (rawEvent) => {
      if (generation !== generationRef.current) return;
      const notification = parseServerEvent(
        rawEvent as MessageEvent<string>,
        isNotificationItem,
      );
      if (!notification) {
        setError("A live notification could not be read. Refreshing history…");
        void runResync(false, generation).catch(() => undefined);
        return;
      }

      const known = knownIdsRef.current.has(notification._id);
      const newerThanBaseline = notification.sequence > lastSequenceRef.current;
      const shouldToast =
        readyForLiveToastsRef.current && known === false && newerThanBaseline;

      mergeNotifications([notification]);
      if (readyForLiveToastsRef.current && !known && !notification.readAt) {
        setUnreadCount((current) => current + 1);
      }
      if (shouldToast) showLiveToast(notification);
    });

    source.addEventListener("ready", (rawEvent) => {
      if (generation !== generationRef.current) return;
      const ready = parseServerEvent(
        rawEvent as MessageEvent<string>,
        isNotificationReadyEvent,
      );
      if (!ready) {
        setError(
          "The live notification connection returned invalid status data.",
        );
        void runResync(false, generation).catch(() => undefined);
        return;
      }

      setUnreadCount(ready.unreadCount);
      setConnectionStatus("live");
      readyForLiveToastsRef.current = true;
      if (ready.latestSequence > lastSequenceRef.current) {
        void runResync(false, generation).catch(() => undefined);
      }
    });

    source.addEventListener("resync", (rawEvent) => {
      if (generation !== generationRef.current) return;
      const resync = parseServerEvent(
        rawEvent as MessageEvent<string>,
        isNotificationResyncEvent,
      );
      if (!resync) {
        setError("The notification resync request was invalid.");
        return;
      }
      readyForLiveToastsRef.current = false;
      setConnectionStatus("reconnecting");
      void runResync(false, generation).catch(() => undefined);
    });

    source.onerror = () => {
      if (generation !== generationRef.current) return;
      readyForLiveToastsRef.current = false;
      setConnectionStatus("reconnecting");
      void runResync(false, generation).catch(() => undefined);
    };

    void runResync(true, generation)
      .catch(() => undefined)
      .finally(() => {
        if (generation === generationRef.current) setInitialLoading(false);
      });

    return () => {
      if (generationRef.current === generation) generationRef.current += 1;
      readyForLiveToastsRef.current = false;
      source.close();
      if (sourceRef.current === source) sourceRef.current = null;
      resyncPromiseRef.current = null;
      loadMorePromiseRef.current = null;
    };
  }, [mergeNotifications, runResync, showLiveToast, userId]);

  const value = useMemo<NotificationContextValue>(
    () => ({
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
    }),
    [
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
    ],
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      "useNotifications must be used inside NotificationProvider",
    );
  }
  return context;
}
