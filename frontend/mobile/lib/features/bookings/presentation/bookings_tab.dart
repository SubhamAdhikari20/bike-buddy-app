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
import '../../reviews/data/review_api.dart';
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

class _BookingCard extends ConsumerWidget {
  final Booking booking;

  const _BookingCard({required this.booking});

  // Refund policy shown BEFORE cancelling (BK-03, H5).
  Future<void> _cancel(BuildContext context, WidgetRef ref) async {
    Map<String, dynamic> policy = const {
      'policyText': 'Cancelling may be subject to the refund policy.',
    };
    try {
      policy = await ref.read(bookingApiProvider).cancellationPolicy(booking.id);
    } catch (_) {}

    if (!context.mounted) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.large)),
        icon: const Icon(Icons.event_busy, size: 40, color: AppColors.warning),
        title: const Text('Cancel this booking?'),
        content: Text(policy['policyText'] as String? ?? ''),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Keep booking'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.error),
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Cancel booking'),
          ),
        ],
      ),
    );
    if (confirmed != true || !context.mounted) return;

    try {
      await ref
          .read(bookingApiProvider)
          .cancel(booking.id, 'Cancelled by rider from the app');
      ref.invalidate(myBookingsProvider);
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Booking cancelled.')),
        );
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString()), backgroundColor: AppColors.error),
        );
      }
    }
  }

  Future<void> _reschedule(BuildContext context, WidgetRef ref) async {
    final picked = await showDatePicker(
      context: context,
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 90)),
      initialDate: booking.startDate,
      helpText: 'New pickup date (same duration and price)',
    );
    if (picked == null || !context.mounted) return;

    final newStart = DateTime(picked.year, picked.month, picked.day,
        booking.startDate.hour, booking.startDate.minute);
    try {
      await ref.read(bookingApiProvider).reschedule(booking.id, newStart);
      ref.invalidate(myBookingsProvider);
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Booking moved. Same price, new dates.')),
        );
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString()), backgroundColor: AppColors.error),
        );
      }
    }
  }

  // Honest reviews - 1 star is never blocked (TR-04).
  Future<void> _review(BuildContext context, WidgetRef ref) async {
    var stars = 5;
    final controller = TextEditingController();
    final submitted = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setState) => AlertDialog(
          shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppRadius.large)),
          title: const Text('How was your ride?'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(
                  5,
                  (i) => IconButton(
                    onPressed: () => setState(() => stars = i + 1),
                    icon: Icon(
                      i < stars ? Icons.star : Icons.star_border,
                      color: AppColors.warning,
                      size: 32,
                    ),
                  ),
                ),
              ),
              TextField(
                controller: controller,
                maxLines: 3,
                maxLength: 500,
                decoration: const InputDecoration(
                    hintText: 'Honest feedback helps other riders'),
              ),
            ],
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.of(context).pop(false),
                child: const Text('Cancel')),
            ElevatedButton(
                onPressed: () => Navigator.of(context).pop(true),
                child: const Text('Post review')),
          ],
        ),
      ),
    );
    if (submitted != true || !context.mounted) return;

    try {
      await ref.read(reviewApiProvider).create(
            bikeId: booking.bikeId,
            bookingId: booking.id,
            rating: stars,
            comment: controller.text.trim().isEmpty
                ? 'No comment'
                : controller.text.trim(),
          );
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Review posted. Thanks for keeping it real!')),
        );
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString()), backgroundColor: AppColors.error),
        );
      }
    }
  }

  (String, Color) get _statusChip => switch (booking.status) {
        'confirmed' when booking.isActive => ('In Progress', AppColors.success),
        'confirmed' => ('Confirmed', AppColors.primary),
        'pending' => ('Waiting for payment', AppColors.warning),
        'completed' => ('Completed', AppColors.teal),
        'cancelled' => ('Cancelled', AppColors.error),
        _ => (booking.status, AppColors.textMuted),
      };

  @override
  Widget build(BuildContext context, WidgetRef ref) {
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
                    onPressed: () => booking.isActive
                        ? context.push(booking.checklistDone
                            ? '/ride/${booking.id}'
                            : '/checklist/${booking.id}')
                        : context.push('/receipt/${booking.id}'),
                    child: Text(
                      booking.isActive
                          ? 'Manage Ride'
                          : booking.paymentStatus == 'paid'
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
            // Cancel / reschedule for upcoming rides (BK-03) and honest
            // reviews after completed ones (TR-04).
            if (booking.isUpcoming)
              Padding(
                padding: const EdgeInsets.only(top: AppSpacing.sm),
                child: Row(
                  children: [
                    Expanded(
                      child: TextButton.icon(
                        style: TextButton.styleFrom(
                            foregroundColor: AppColors.error),
                        onPressed: () => _cancel(context, ref),
                        icon: const Icon(Icons.close, size: 18),
                        label: const Text('Cancel'),
                      ),
                    ),
                    Expanded(
                      child: TextButton.icon(
                        onPressed: () => _reschedule(context, ref),
                        icon: const Icon(Icons.edit_calendar, size: 18),
                        label: const Text('Reschedule'),
                      ),
                    ),
                  ],
                ),
              )
            else if (booking.status == 'completed')
              Padding(
                padding: const EdgeInsets.only(top: AppSpacing.sm),
                child: Row(
                  children: [
                    Expanded(
                      child: TextButton.icon(
                        onPressed: () => _review(context, ref),
                        icon: const Icon(Icons.star_border, size: 18),
                        label: const Text('Leave a review'),
                      ),
                    ),
                    Expanded(
                      child: TextButton.icon(
                        onPressed: () =>
                            context.push('/damage-report/${booking.id}'),
                        icon: const Icon(Icons.report_problem_outlined,
                            size: 18),
                        label: const Text('Report damage'),
                      ),
                    ),
                  ],
                ),
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
