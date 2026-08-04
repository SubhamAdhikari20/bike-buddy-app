import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_theme.dart';
import '../../../core/error/app_exception.dart';
import '../../../core/utils/formatters.dart';
import '../data/booking_api.dart';
import '../data/booking_model.dart';

class BookingDetailsPage extends ConsumerStatefulWidget {
  final String bookingId;

  const BookingDetailsPage({super.key, required this.bookingId});

  @override
  ConsumerState<BookingDetailsPage> createState() => _BookingDetailsPageState();
}

class _BookingDetailsPageState extends ConsumerState<BookingDetailsPage> {
  Booking? _booking;
  List<BookingDamageReport> _damageReports = const [];
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final api = ref.read(bookingApiProvider);
      final results = await Future.wait<Object>([
        api.getBooking(widget.bookingId),
        api.myDamageReports(),
      ]);
      final booking = results[0] as Booking;
      final reports = (results[1] as List<BookingDamageReport>)
          .where((report) => report.bookingId == booking.id)
          .toList(growable: false);
      if (!mounted) return;
      setState(() {
        _booking = booking;
        _damageReports = reports;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error is AppException
            ? error.message
            : 'Could not load this booking. Please try again.';
        _loading = false;
      });
    }
  }

  Color _statusColor(String status) => switch (status) {
    'confirmed' || 'paid' || 'completed' => AppColors.success,
    'pending' || 'unpaid' => AppColors.warning,
    'cancelled' || 'rejected' || 'failed' => AppColors.error,
    _ => AppColors.textMuted,
  };

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Booking Details')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.lg),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(
                      Icons.error_outline,
                      size: 48,
                      color: AppColors.error,
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Text(_error!, textAlign: TextAlign.center),
                    const SizedBox(height: AppSpacing.md),
                    ElevatedButton(
                      onPressed: _load,
                      child: const Text('Retry'),
                    ),
                  ],
                ),
              ),
            )
          : RefreshIndicator(
              onRefresh: _load,
              child: _BookingDetailsBody(
                booking: _booking!,
                damageReports: _damageReports,
                statusColor: _statusColor,
              ),
            ),
    );
  }
}

class _BookingDetailsBody extends StatelessWidget {
  final Booking booking;
  final List<BookingDamageReport> damageReports;
  final Color Function(String status) statusColor;

  const _BookingDetailsBody({
    required this.booking,
    required this.damageReports,
    required this.statusColor,
  });

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final bike = booking.bike;
    final shortId = booking.id.length > 6
        ? booking.id.substring(booking.id.length - 6).toUpperCase()
        : booking.id.toUpperCase();

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(AppSpacing.md),
      children: [
        Card(
          clipBehavior: Clip.antiAlias,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (bike != null && bike.imageUrls.isNotEmpty)
                CachedNetworkImage(
                  imageUrl: bike.imageUrls.first,
                  width: double.infinity,
                  height: 190,
                  fit: BoxFit.cover,
                  errorWidget: (_, _, _) => const SizedBox(
                    height: 150,
                    child: Center(child: Icon(Icons.two_wheeler, size: 52)),
                  ),
                ),
              Padding(
                padding: const EdgeInsets.all(AppSpacing.md),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Text(
                            bike?.title ?? 'Motorbike booking',
                            style: textTheme.titleLarge,
                          ),
                        ),
                        _StatusChip(
                          label: booking.status,
                          color: statusColor(booking.status),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text('Booking #$shortId', style: textTheme.labelSmall),
                    const SizedBox(height: AppSpacing.sm),
                    _InfoRow(
                      icon: Icons.calendar_month_outlined,
                      label:
                          '${Formatters.nptTime(booking.startDate)} → ${Formatters.nptTime(booking.endDate)}',
                    ),
                    _InfoRow(
                      icon: Icons.location_on_outlined,
                      label: booking.pickupLocation,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        Text('Progress', style: textTheme.titleLarge),
        const SizedBox(height: AppSpacing.sm),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: Column(
              children: [
                _TimelineRow(
                  icon: Icons.event_available,
                  title: 'Booking created',
                  detail: booking.createdAt == null
                      ? 'Request recorded'
                      : Formatters.nptTime(booking.createdAt!),
                  complete: true,
                ),
                _TimelineRow(
                  icon: Icons.account_balance_wallet_outlined,
                  title: 'Payment',
                  detail:
                      '${booking.paymentStatus.toUpperCase()}${booking.paymentMethod == null ? '' : ' · ${booking.paymentMethod}'}',
                  complete: booking.paymentStatus == 'paid',
                  color: statusColor(booking.paymentStatus),
                ),
                _TimelineRow(
                  icon: Icons.fact_check_outlined,
                  title: 'Handover checklist',
                  detail: booking.checklistDone
                      ? '${booking.checklistItemCount} checks and ${booking.checklistPhotoCount} photos recorded'
                      : 'Not completed',
                  complete: booking.checklistDone,
                ),
                _TimelineRow(
                  icon: Icons.keyboard_return,
                  title: 'Return',
                  detail: booking.returnedAt == null
                      ? 'Not recorded'
                      : Formatters.nptTime(booking.returnedAt!),
                  complete: booking.returnedAt != null,
                  last: true,
                ),
              ],
            ),
          ),
        ),
        if (booking.cancellationReason != null) ...[
          const SizedBox(height: AppSpacing.md),
          Card(
            color: AppColors.error.withValues(alpha: 0.08),
            child: ListTile(
              leading: const Icon(Icons.info_outline, color: AppColors.error),
              title: Text('${booking.status} booking'),
              subtitle: Text(booking.cancellationReason!),
            ),
          ),
        ],
        const SizedBox(height: AppSpacing.md),
        Text('Payment summary', style: textTheme.titleLarge),
        const SizedBox(height: AppSpacing.sm),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: Column(
              children: [
                if (booking.priceBreakdown case final breakdown?) ...[
                  _PriceRow('Rental', breakdown.baseAmount),
                  _PriceRow('Service fee', breakdown.serviceFee),
                  _PriceRow('Refundable deposit', breakdown.securityDeposit),
                  const Divider(),
                ],
                _PriceRow('Total', booking.totalAmount, strong: true),
                const SizedBox(height: AppSpacing.xs),
                Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    'Status: ${booking.paymentStatus}${booking.paymentMode == null ? '' : ' · ${booking.paymentMode} mode'}',
                    style: textTheme.bodySmall,
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        Text('Damage reports', style: textTheme.titleLarge),
        const SizedBox(height: AppSpacing.sm),
        if (damageReports.isEmpty)
          const Card(
            child: ListTile(
              leading: Icon(Icons.verified_outlined, color: AppColors.success),
              title: Text('No damage report submitted'),
              subtitle: Text('Reports for this booking will appear here.'),
            ),
          )
        else
          ...damageReports.map(
            (report) => Card(
              child: ListTile(
                leading: Icon(
                  Icons.build_outlined,
                  color: statusColor(report.status),
                ),
                title: Text(report.description),
                subtitle: Text(
                  '${report.photoCount} evidence photo${report.photoCount == 1 ? '' : 's'}'
                  '${report.createdAt == null ? '' : ' · ${Formatters.nptTime(report.createdAt!)}'}',
                ),
                trailing: _StatusChip(
                  label: report.status,
                  color: statusColor(report.status),
                ),
              ),
            ),
          ),
        const SizedBox(height: AppSpacing.md),
        if (booking.paymentStatus == 'paid')
          ElevatedButton.icon(
            onPressed: () => context.push('/receipt/${booking.id}'),
            icon: const Icon(Icons.receipt_long_outlined),
            label: const Text('View receipt'),
          )
        else if (booking.status == 'pending')
          ElevatedButton.icon(
            onPressed: () =>
                context.push('/book/${booking.bikeId}?bookingId=${booking.id}'),
            icon: const Icon(Icons.account_balance_wallet_outlined),
            label: const Text('Continue payment'),
          ),
        if (booking.isActive)
          Padding(
            padding: const EdgeInsets.only(top: AppSpacing.sm),
            child: ElevatedButton.icon(
              onPressed: () => context.push(
                booking.checklistDone
                    ? '/ride/${booking.id}'
                    : '/checklist/${booking.id}',
              ),
              icon: const Icon(Icons.route_outlined),
              label: Text(
                booking.checklistDone ? 'Manage active ride' : 'Start handover',
              ),
            ),
          ),
        if (booking.status == 'completed')
          Padding(
            padding: const EdgeInsets.only(top: AppSpacing.sm),
            child: OutlinedButton.icon(
              onPressed: () => context.push('/damage-report/${booking.id}'),
              icon: const Icon(Icons.add_a_photo_outlined),
              label: const Text('Report return damage'),
            ),
          ),
        Padding(
          padding: const EdgeInsets.only(top: AppSpacing.sm),
          child: OutlinedButton.icon(
            onPressed: () => context.push('/support'),
            icon: const Icon(Icons.support_agent),
            label: const Text('Get support'),
          ),
        ),
        const SizedBox(height: AppSpacing.xxl),
      ],
    );
  }
}

class _StatusChip extends StatelessWidget {
  final String label;
  final Color color;

  const _StatusChip({required this.label, required this.color});

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
    decoration: BoxDecoration(
      color: color.withValues(alpha: 0.12),
      borderRadius: BorderRadius.circular(AppRadius.pill),
    ),
    child: Text(
      label.toUpperCase(),
      style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: color),
    ),
  );
}

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String label;

  const _InfoRow({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 6),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 17, color: AppColors.textMuted),
        const SizedBox(width: 6),
        Expanded(child: Text(label)),
      ],
    ),
  );
}

class _TimelineRow extends StatelessWidget {
  final IconData icon;
  final String title;
  final String detail;
  final bool complete;
  final bool last;
  final Color? color;

  const _TimelineRow({
    required this.icon,
    required this.title,
    required this.detail,
    required this.complete,
    this.last = false,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    final indicatorColor =
        color ?? (complete ? AppColors.success : AppColors.textMuted);
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            width: 30,
            child: Column(
              children: [
                Icon(icon, size: 20, color: indicatorColor),
                if (!last)
                  Expanded(
                    child: Container(width: 2, color: AppColors.divider),
                  ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.md),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                  Text(detail, style: Theme.of(context).textTheme.bodySmall),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _PriceRow extends StatelessWidget {
  final String label;
  final double amount;
  final bool strong;

  const _PriceRow(this.label, this.amount, {this.strong = false});

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 4),
    child: Row(
      children: [
        Expanded(
          child: Text(
            label,
            style: strong ? const TextStyle(fontWeight: FontWeight.w700) : null,
          ),
        ),
        Text(
          Formatters.npr(amount),
          style: strong ? const TextStyle(fontWeight: FontWeight.w700) : null,
        ),
      ],
    ),
  );
}
