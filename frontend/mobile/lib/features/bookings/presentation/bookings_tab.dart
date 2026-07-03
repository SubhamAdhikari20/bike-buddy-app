import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/error_view.dart';
import '../../../core/widgets/loading_view.dart';
import '../../auth/presentation/providers/auth_provider.dart';
import '../data/booking_api.dart';
import '../data/booking_model.dart';

/// My Bookings with Active / Upcoming / Past tabs, matching the
/// prototype's in-progress card with return time and time left.
class BookingsTab extends ConsumerWidget {
  const BookingsTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final textTheme = Theme.of(context).textTheme;
    final auth = ref.watch(authProvider).valueOrNull;

    if (auth == null) {
      return SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('My Bookings', style: textTheme.displayLarge),
              Expanded(
                child: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.event_note_outlined,
                          size: 56, color: AppColors.textMuted),
                      const SizedBox(height: AppSpacing.md),
                      Text('Sign in to see your bookings',
                          style: textTheme.bodyLarge),
                      const SizedBox(height: AppSpacing.md),
                      SizedBox(
                        width: 200,
                        child: ElevatedButton(
                          onPressed: () => context.push('/auth'),
                          child: const Text('Sign In'),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    }

    final bookingsAsync = ref.watch(myBookingsProvider);

    return SafeArea(
      child: DefaultTabController(
        length: 3,
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('My Bookings', style: textTheme.displayLarge),
              const SizedBox(height: AppSpacing.sm),
              const TabBar(
                labelColor: AppColors.primary,
                unselectedLabelColor: AppColors.textSecondary,
                indicatorColor: AppColors.primary,
                tabs: [
                  Tab(text: 'Active'),
                  Tab(text: 'Upcoming'),
                  Tab(text: 'Past'),
                ],
              ),
              Expanded(
                child: bookingsAsync.when(
                  loading: () =>
                      const LoadingView(label: 'Loading your bookings...'),
                  error: (error, _) => ErrorView(
                    message: error.toString(),
                    onRetry: () => ref.invalidate(myBookingsProvider),
                  ),
                  data: (bookings) {
                    final active =
                        bookings.where((b) => b.isActive).toList();
                    final upcoming =
                        bookings.where((b) => b.isUpcoming).toList();
                    final past = bookings
                        .where((b) => !b.isActive && !b.isUpcoming)
                        .toList();
                    return TabBarView(
                      children: [
                        _BookingList(bookings: active, emptyText: 'No active ride right now.'),
                        _BookingList(bookings: upcoming, emptyText: 'No upcoming bookings yet.'),
                        _BookingList(bookings: past, emptyText: 'Your completed rides will appear here.'),
                      ],
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _BookingList extends ConsumerWidget {
  final List<Booking> bookings;
  final String emptyText;

  const _BookingList({required this.bookings, required this.emptyText});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (bookings.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.event_note_outlined,
                size: 56, color: AppColors.textMuted),
            const SizedBox(height: AppSpacing.md),
            Text(emptyText, style: Theme.of(context).textTheme.bodyLarge),
            const SizedBox(height: AppSpacing.md),
            SizedBox(
              width: 200,
              child: ElevatedButton(
                onPressed: () => context.go('/home'),
                child: const Text('Browse bikes'),
              ),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: () async => ref.refresh(myBookingsProvider.future),
      child: ListView.separated(
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
        itemCount: bookings.length,
        separatorBuilder: (context, index) =>
            const SizedBox(height: AppSpacing.md),
        itemBuilder: (context, index) =>
            _BookingCard(booking: bookings[index]),
      ),
    );
  }
}

class _BookingCard extends StatelessWidget {
  final Booking booking;

  const _BookingCard({required this.booking});

  (String, Color) get _statusChip => switch (booking.status) {
        'confirmed' when booking.isActive => ('In Progress', AppColors.success),
        'confirmed' => ('Confirmed', AppColors.primary),
        'pending' => ('Waiting for payment', AppColors.warning),
        'completed' => ('Completed', AppColors.teal),
        'cancelled' => ('Cancelled', AppColors.error),
        _ => (booking.status, AppColors.textMuted),
      };

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final (statusLabel, statusColor) = _statusChip;
    final bike = booking.bike;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.circle, size: 10, color: statusColor),
                const SizedBox(width: 6),
                Text(statusLabel,
                    style: TextStyle(
                        color: statusColor,
                        fontWeight: FontWeight.w600,
                        fontSize: 13)),
                const Spacer(),
                Text(
                  'Booking #${booking.id.substring(booking.id.length - 6).toUpperCase()}',
                  style: textTheme.labelSmall,
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            Row(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(AppRadius.small),
                  child: SizedBox(
                    width: 72,
                    height: 56,
                    child: bike == null || bike.imageUrls.isEmpty
                        ? Container(
                            color: AppColors.primaryLight,
                            child: const Icon(Icons.two_wheeler,
                                color: AppColors.primary),
                          )
                        : CachedNetworkImage(
                            imageUrl: bike.imageUrls.first, fit: BoxFit.cover),
                  ),
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(bike?.title ?? 'Bike',
                          style: textTheme.titleMedium,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis),
                      Text(booking.pickupLocation,
                          style: textTheme.bodyMedium,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis),
                      Text(Formatters.npr(booking.totalAmount),
                          style: textTheme.bodyMedium
                              ?.copyWith(color: AppColors.primary)),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            Row(
              children: [
                const Icon(Icons.schedule, size: 16, color: AppColors.textMuted),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(
                    booking.isActive
                        ? 'Return by ${DateFormat('EEE, h:mm a').format(booking.endDate)}'
                        : '${DateFormat('d MMM').format(booking.startDate)} - ${DateFormat('d MMM yyyy').format(booking.endDate)}',
                    style: textTheme.bodyMedium,
                  ),
                ),
                if (booking.isActive)
                  Text(
                    _timeLeft(booking.endDate),
                    style: const TextStyle(
                        color: AppColors.accent, fontWeight: FontWeight.w600),
                  ),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            Row(
              children: [
                Expanded(
                  child: ElevatedButton(
                    onPressed: () => context.push('/receipt/${booking.id}'),
                    child: Text(
                      booking.paymentStatus == 'paid'
                          ? 'View Receipt'
                          : 'View Details',
                    ),
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                SizedBox(
                  width: 48,
                  height: 48,
                  child: OutlinedButton(
                    style: OutlinedButton.styleFrom(
                      padding: EdgeInsets.zero,
                      side: const BorderSide(color: AppColors.divider),
                    ),
                    onPressed: () => context.push('/support'),
                    child:
                        const Icon(Icons.support_agent, color: AppColors.primary),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  String _timeLeft(DateTime end) {
    final diff = end.difference(DateTime.now());
    if (diff.isNegative) return 'Overdue';
    final hours = diff.inHours;
    final minutes = diff.inMinutes % 60;
    return '${hours}h ${minutes}m';
  }
}
