import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_theme.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/error_view.dart';
import '../../../core/widgets/loading_view.dart';
import '../../bookings/data/booking_api.dart';
import '../../bookings/data/booking_model.dart';

final _rideBookingProvider =
    FutureProvider.family<Booking, String>((ref, bookingId) {
  return ref.watch(bookingApiProvider).getBooking(bookingId);
});

/// Active ride screen. The SOS button is 64px, high-contrast orange and
/// ALWAYS visible - never hidden or below the fold (SUP-01, safety).
class ActiveRidePage extends ConsumerStatefulWidget {
  final String bookingId;

  const ActiveRidePage({super.key, required this.bookingId});

  @override
  ConsumerState<ActiveRidePage> createState() => _ActiveRidePageState();
}

class _ActiveRidePageState extends ConsumerState<ActiveRidePage> {
  Timer? _ticker;
  bool _sosBusy = false;

  @override
  void initState() {
    super.initState();
    // Keep the countdown fresh.
    _ticker = Timer.periodic(const Duration(minutes: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  // One tap: share location with support and start the call (SUP-01).
  Future<void> _triggerSos() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.large)),
        icon: const Icon(Icons.sos, size: 44, color: AppColors.accent),
        title: const Text('Get emergency help?'),
        content: const Text(
            'We will share your location with our 24/7 support team and start a call right away.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.accent),
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Yes, get help'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    setState(() => _sosBusy = true);
    try {
      double? lat;
      double? lng;
      try {
        final position = await Geolocator.getCurrentPosition(
          locationSettings:
              const LocationSettings(accuracy: LocationAccuracy.high),
        ).timeout(const Duration(seconds: 5));
        lat = position.latitude;
        lng = position.longitude;
      } catch (_) {
        // Send the alert even without a fix - support can still call back.
      }

      await ref.read(bookingApiProvider).sendSos(
            bookingId: widget.bookingId,
            latitude: lat,
            longitude: lng,
          );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Alert sent. Our team can see your location. Calling now...'),
            backgroundColor: AppColors.success,
          ),
        );
      }
      await launchUrl(Uri(scheme: 'tel', path: AppConstants.supportPhone));
    } catch (_) {
      // Even if the API call fails, never block the emergency call.
      await launchUrl(Uri(scheme: 'tel', path: AppConstants.supportPhone));
    } finally {
      if (mounted) setState(() => _sosBusy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bookingAsync = ref.watch(_rideBookingProvider(widget.bookingId));
    final textTheme = Theme.of(context).textTheme;

    return Scaffold(
      appBar: AppBar(title: const Text('Your Ride')),
      body: bookingAsync.when(
        loading: () => const LoadingView(label: 'Loading your ride...'),
        error: (error, _) => ErrorView(
          message: error.toString(),
          onRetry: () => ref.invalidate(_rideBookingProvider(widget.bookingId)),
        ),
        data: (booking) {
          final timeLeft = booking.endDate.difference(DateTime.now());
          final overdue = timeLeft.isNegative;

          return ListView(
            padding: const EdgeInsets.all(AppSpacing.md),
            children: [
              Card(
                color: overdue ? const Color(0xFFFFF1F0) : AppColors.mint,
                child: Padding(
                  padding: const EdgeInsets.all(AppSpacing.lg),
                  child: Column(
                    children: [
                      Text(
                        overdue ? 'Return overdue' : 'Ride in progress',
                        style: textTheme.titleLarge?.copyWith(
                          color:
                              overdue ? AppColors.error : AppColors.teal,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      Text(
                        overdue
                            ? 'Late by ${(-timeLeft.inMinutes)} min - a late fee may apply'
                            : '${timeLeft.inHours}h ${timeLeft.inMinutes % 60}m left',
                        style: textTheme.displayLarge,
                      ),
                      Text(
                        'Return by ${DateFormat('EEE, d MMM h:mm a').format(booking.endDate)}',
                        style: textTheme.bodyMedium,
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: AppSpacing.md),

              if (booking.bike != null)
                Card(
                  child: ListTile(
                    leading: const Icon(Icons.two_wheeler,
                        size: 36, color: AppColors.primary),
                    title: Text(booking.bike!.title),
                    subtitle: Text(booking.pickupLocation),
                  ),
                ),
              const SizedBox(height: AppSpacing.md),

              if (!booking.checklistDone)
                Card(
                  color: const Color(0xFFFFF7E6),
                  child: ListTile(
                    leading: const Icon(Icons.checklist,
                        color: AppColors.warning),
                    title: const Text('Pre-ride checklist not done'),
                    subtitle: const Text(
                        'Takes 2 minutes and protects you in a dispute.'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () =>
                        context.push('/checklist/${widget.bookingId}'),
                  ),
                ),
              const SizedBox(height: AppSpacing.md),

              Text('Paid: ${Formatters.npr(booking.totalAmount)}',
                  style: textTheme.bodyMedium, textAlign: TextAlign.center),
              const SizedBox(height: AppSpacing.md),

              ElevatedButton.icon(
                onPressed: () => context.push('/return/${widget.bookingId}'),
                icon: const Icon(Icons.keyboard_return),
                label: const Text('Return the Bike'),
              ),
              const SizedBox(height: AppSpacing.sm),
              OutlinedButton.icon(
                onPressed: () => context.push('/support'),
                icon: const Icon(Icons.support_agent),
                label: const Text('Help & Support'),
              ),
              const SizedBox(height: 120), // room above the SOS button
            ],
          );
        },
      ),
      // Floating SOS - fixed position, 64px, accent orange (SUP-01).
      floatingActionButton: SizedBox(
        width: 64,
        height: 64,
        child: FloatingActionButton(
          backgroundColor: AppColors.accent,
          onPressed: _sosBusy ? null : _triggerSos,
          tooltip: 'Emergency help',
          child: _sosBusy
              ? const CircularProgressIndicator(color: Colors.white)
              : const Text('SOS',
                  style: TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.w800)),
        ),
      ),
    );
  }
}
