import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../notification_routes.dart';
import '../providers/notification_provider.dart';

class NotificationToastHost extends ConsumerWidget {
  final Widget child;

  const NotificationToastHost({super.key, required this.child});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Watching starts the foreground-only stream and lets its auth listener
    // close the connection immediately when the renter signs out.
    ref.watch(notificationProvider);
    ref.listen(notificationProvider.select((state) => state.liveEvent), (
      previous,
      next,
    ) {
      if (next == null || previous?.serial == next.serial) return;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!context.mounted) return;
        final notification = next.notification;
        final route = notificationRoute(notification.action);
        final color = switch (notification.severity) {
          'success' => Colors.green.shade800,
          'warning' => Colors.orange.shade900,
          'error' => Colors.red.shade800,
          _ => Colors.blue.shade800,
        };
        final messenger = ScaffoldMessenger.maybeOf(context);
        messenger
          ?..hideCurrentSnackBar()
          ..showSnackBar(
            SnackBar(
              backgroundColor: color,
              behavior: SnackBarBehavior.floating,
              duration: const Duration(seconds: 6),
              content: Semantics(
                liveRegion: true,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      notification.title,
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      notification.message,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              action: route == null
                  ? null
                  : SnackBarAction(
                        label: 'View',
                        textColor: Colors.white,
                        onPressed: () {
                          ref
                              .read(notificationProvider.notifier)
                              .markRead(notification.id)
                              .catchError((_) {});
                          context.push(route);
                        },
                      ),
            ),
          );
      });
    });
    return child;
  }
}
