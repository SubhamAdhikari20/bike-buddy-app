import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../app/theme/app_theme.dart';
import '../../data/notification_model.dart';
import '../notification_routes.dart';
import '../providers/notification_provider.dart';

class NotificationsPage extends ConsumerStatefulWidget {
  const NotificationsPage({super.key});

  @override
  ConsumerState<NotificationsPage> createState() => _NotificationsPageState();
}

class _NotificationsPageState extends ConsumerState<NotificationsPage> {
  bool _unreadOnly = false;

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(notificationProvider);
    final notifier = ref.read(notificationProvider.notifier);
    final items = _unreadOnly
        ? state.items.where((item) => !item.isRead).toList(growable: false)
        : state.items;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          if (state.unreadCount > 0)
            IconButton(
              onPressed: state.markingAllRead
                  ? null
                  : () async {
                      try {
                        final count = await notifier.markAllRead();
                        if (!context.mounted) return;
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text(
                              count == 1
                                  ? '1 notification marked as read.'
                                  : '$count notifications marked as read.',
                            ),
                          ),
                        );
                      } catch (_) {
                        if (!context.mounted) return;
                        _showError(context, state.error);
                      }
                    },
              tooltip: 'Mark all as read',
              icon: state.markingAllRead
                  ? const SizedBox.square(
                      dimension: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.done_all),
            ),
        ],
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: notifier.refresh,
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.md,
                  AppSpacing.md,
                  AppSpacing.md,
                  AppSpacing.sm,
                ),
                sliver: SliverToBoxAdapter(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _ConnectionBanner(state: state),
                      const SizedBox(height: AppSpacing.md),
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              state.unreadCount == 0
                                  ? 'You are caught up'
                                  : '${state.unreadCount} unread ${state.unreadCount == 1 ? 'update' : 'updates'}',
                              style: Theme.of(context).textTheme.titleMedium,
                            ),
                          ),
                          SegmentedButton<bool>(
                            segments: const [
                              ButtonSegment(value: false, label: Text('All')),
                              ButtonSegment(value: true, label: Text('Unread')),
                            ],
                            selected: {_unreadOnly},
                            showSelectedIcon: false,
                            onSelectionChanged: (values) =>
                                setState(() => _unreadOnly = values.first),
                          ),
                        ],
                      ),
                      if (state.error != null) ...[
                        const SizedBox(height: AppSpacing.sm),
                        Material(
                          color: Theme.of(context).colorScheme.errorContainer,
                          borderRadius: BorderRadius.circular(AppRadius.small),
                          child: Padding(
                            padding: const EdgeInsets.all(AppSpacing.sm),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Icon(
                                  Icons.info_outline,
                                  color: Theme.of(
                                    context,
                                  ).colorScheme.onErrorContainer,
                                ),
                                const SizedBox(width: AppSpacing.sm),
                                Expanded(
                                  child: Text(
                                    state.error!,
                                    style: TextStyle(
                                      color: Theme.of(
                                        context,
                                      ).colorScheme.onErrorContainer,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
              if (state.initialLoading)
                const SliverFillRemaining(
                  hasScrollBody: false,
                  child: Center(child: CircularProgressIndicator()),
                )
              else if (items.isEmpty)
                SliverFillRemaining(
                  hasScrollBody: false,
                  child: _EmptyState(unreadOnly: _unreadOnly),
                )
              else
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(
                    AppSpacing.md,
                    0,
                    AppSpacing.md,
                    AppSpacing.md,
                  ),
                  sliver: SliverList.separated(
                    itemCount: items.length,
                    separatorBuilder: (context, index) =>
                        const SizedBox(height: AppSpacing.sm),
                    itemBuilder: (context, index) => _NotificationCard(
                      notification: items[index],
                      busy: state.pendingReadIds.contains(items[index].id),
                      onMarkRead: () => _markRead(items[index]),
                      onView: notificationRoute(items[index].action) == null
                          ? null
                          : () => _open(items[index]),
                    ),
                  ),
                ),
              if (state.hasMore && !_unreadOnly)
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(
                    AppSpacing.md,
                    0,
                    AppSpacing.md,
                    AppSpacing.xxl,
                  ),
                  sliver: SliverToBoxAdapter(
                    child: OutlinedButton.icon(
                      onPressed: state.loadingMore
                          ? null
                          : () async {
                              try {
                                await notifier.loadMore();
                              } catch (_) {
                                if (!context.mounted) return;
                                _showError(context, state.error);
                              }
                            },
                      icon: state.loadingMore
                          ? const SizedBox.square(
                              dimension: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.expand_more),
                      label: const Text('Load older notifications'),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _markRead(BikeBuddyNotification notification) async {
    try {
      await ref.read(notificationProvider.notifier).markRead(notification.id);
    } catch (_) {
      if (!mounted) return;
      _showError(context, ref.read(notificationProvider).error);
    }
  }

  void _open(BikeBuddyNotification notification) {
    if (!notification.isRead) {
      ref
          .read(notificationProvider.notifier)
          .markRead(notification.id)
          .catchError((_) {});
    }
    final route = notificationRoute(notification.action);
    if (route != null) context.push(route);
  }

  void _showError(BuildContext context, String? message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          message ?? 'Notifications could not be updated. Please try again.',
        ),
      ),
    );
  }
}

class _ConnectionBanner extends StatelessWidget {
  final NotificationState state;

  const _ConnectionBanner({required this.state});

  @override
  Widget build(BuildContext context) {
    final live = state.connectionStatus == NotificationConnectionStatus.live;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.sm),
      decoration: BoxDecoration(
        color: live
            ? AppColors.mint.withValues(alpha: 0.7)
            : Theme.of(context).colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(AppRadius.small),
      ),
      child: Row(
        children: [
          Icon(
            live ? Icons.wifi : Icons.sync,
            size: 18,
            color: live ? Colors.green.shade800 : Colors.orange.shade800,
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              live
                  ? 'Live while Bike Buddy is open'
                  : 'Reconnecting and checking saved updates…',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ),
          if (state.refreshing)
            const SizedBox.square(
              dimension: 16,
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
        ],
      ),
    );
  }
}

class _NotificationCard extends StatelessWidget {
  final BikeBuddyNotification notification;
  final bool busy;
  final VoidCallback onMarkRead;
  final VoidCallback? onView;

  const _NotificationCard({
    required this.notification,
    required this.busy,
    required this.onMarkRead,
    required this.onView,
  });

  @override
  Widget build(BuildContext context) {
    final color = switch (notification.severity) {
      'success' => Colors.green,
      'warning' => Colors.orange,
      'error' => Colors.red,
      _ => AppColors.primary,
    };
    final label = notification.type.replaceAll('_', ' ').replaceAll('.', ' · ');

    return Card(
      color: notification.isRead
          ? null
          : Theme.of(
              context,
            ).colorScheme.primaryContainer.withValues(alpha: 0.28),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 4,
                  height: 42,
                  decoration: BoxDecoration(
                    color: color,
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              notification.title,
                              style: Theme.of(context).textTheme.titleSmall,
                            ),
                          ),
                          if (!notification.isRead)
                            const Badge(label: Text('New')),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(notification.message),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              '$label · ${DateFormat('d MMM, h:mm a').format(notification.createdAt.toLocal())}',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            Wrap(
              spacing: AppSpacing.sm,
              runSpacing: AppSpacing.xs,
              alignment: WrapAlignment.end,
              children: [
                if (!notification.isRead)
                  TextButton.icon(
                    onPressed: busy ? null : onMarkRead,
                    icon: busy
                        ? const SizedBox.square(
                            dimension: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.done, size: 18),
                    label: const Text('Mark read'),
                  ),
                if (onView != null)
                  OutlinedButton.icon(
                    onPressed: onView,
                    icon: const Icon(Icons.arrow_forward, size: 18),
                    label: const Text('View'),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  final bool unreadOnly;

  const _EmptyState({required this.unreadOnly});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              unreadOnly ? Icons.done_all : Icons.notifications_none_outlined,
              size: 48,
              color: Theme.of(context).colorScheme.primary,
            ),
            const SizedBox(height: AppSpacing.md),
            Text(
              unreadOnly ? 'You are caught up' : 'No notifications yet',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              unreadOnly
                  ? 'Choose All to review earlier updates.'
                  : 'Booking, payment, support, and safety updates will appear here.',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ],
        ),
      ),
    );
  }
}
