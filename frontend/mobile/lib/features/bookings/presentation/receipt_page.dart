import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';

import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/error_view.dart';
import '../../../core/widgets/loading_view.dart';
import '../data/booking_api.dart';
import '../data/booking_model.dart';

final _bookingProvider = FutureProvider.family<Booking, String>((
  ref,
  bookingId,
) {
  return ref.watch(bookingApiProvider).getBooking(bookingId);
});

/// Digital receipt shown right after payment with a PDF download
/// (PR-04). Every line item is repeated here so the rider has proof.
class ReceiptPage extends ConsumerStatefulWidget {
  final String bookingId;

  const ReceiptPage({super.key, required this.bookingId});

  @override
  ConsumerState<ReceiptPage> createState() => _ReceiptPageState();
}

class _ReceiptPageState extends ConsumerState<ReceiptPage> {
  bool _downloading = false;

  Future<void> _downloadPdf() async {
    setState(() => _downloading = true);
    try {
      final bytes = await ref
          .read(bookingApiProvider)
          .downloadReceiptPdf(widget.bookingId);
      final dir = await getApplicationDocumentsDirectory();
      final file = File(
        '${dir.path}/bike-buddy-receipt-${_shortBookingId(widget.bookingId).toLowerCase()}.pdf',
      );
      await file.writeAsBytes(bytes);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Receipt saved. Opening...')),
        );
      }
      await OpenFilex.open(file.path);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Could not download the PDF right now. Try again later.',
            ),
            backgroundColor: AppColors.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _downloading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bookingAsync = ref.watch(_bookingProvider(widget.bookingId));
    final textTheme = Theme.of(context).textTheme;

    return Scaffold(
      appBar: AppBar(title: const Text('Receipt')),
      body: bookingAsync.when(
        loading: () => const LoadingView(label: 'Fetching your receipt...'),
        error: (error, _) => ErrorView(
          message: error.toString(),
          onRetry: () => ref.invalidate(_bookingProvider(widget.bookingId)),
        ),
        data: (booking) {
          final breakdown = booking.priceBreakdown;
          final isDemo = booking.paymentMode == 'demo';
          final isSandbox = booking.paymentMode == 'sandbox';
          final isTestPayment = isDemo || isSandbox;
          final awaitsOwnerApproval = booking.status == 'pending';
          return ListView(
            padding: const EdgeInsets.all(AppSpacing.md),
            children: [
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(AppSpacing.lg),
                  child: Column(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(AppSpacing.md),
                        decoration: BoxDecoration(
                          color: isTestPayment
                              ? AppColors.warning.withValues(alpha: 0.12)
                              : AppColors.mint,
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          isTestPayment
                              ? Icons.science_outlined
                              : Icons.check_circle,
                          size: 48,
                          color: isTestPayment
                              ? AppColors.warning
                              : AppColors.success,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.md),
                      Text(
                        isDemo
                            ? 'Demo payment recorded'
                            : isSandbox
                            ? 'Test payment verified'
                            : 'Payment verified',
                        style: textTheme.titleLarge,
                        textAlign: TextAlign.center,
                      ),
                      if (isTestPayment)
                        const Padding(
                          padding: EdgeInsets.only(top: AppSpacing.xs),
                          child: Text(
                            'Sandbox/coursework test only - no real money was charged.',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color: AppColors.warning,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      if (awaitsOwnerApproval)
                        Container(
                          margin: const EdgeInsets.only(top: AppSpacing.md),
                          padding: const EdgeInsets.all(AppSpacing.sm),
                          decoration: BoxDecoration(
                            color: AppColors.primaryLight,
                            borderRadius: BorderRadius.circular(
                              AppRadius.medium,
                            ),
                          ),
                          child: const Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Icon(
                                Icons.schedule_outlined,
                                color: AppColors.primary,
                              ),
                              SizedBox(width: AppSpacing.sm),
                              Expanded(
                                child: Text(
                                  'Your payment is verified and your booking request is awaiting owner approval. Track the decision in My Bookings.',
                                  style: TextStyle(fontWeight: FontWeight.w600),
                                ),
                              ),
                            ],
                          ),
                        ),
                      Text(
                        'Booking #${_shortBookingId(booking.id)}',
                        style: textTheme.labelSmall,
                      ),
                      const SizedBox(height: AppSpacing.md),
                      const Divider(),
                      if (booking.bike != null)
                        ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: const Icon(
                            Icons.two_wheeler,
                            color: AppColors.primary,
                          ),
                          title: Text(booking.bike!.title),
                          subtitle: Text(booking.pickupLocation),
                        ),
                      _row(
                        'From',
                        DateFormat(
                          'EEE, d MMM yyyy h:mm a',
                        ).format(booking.startDate),
                      ),
                      _row(
                        'To',
                        DateFormat(
                          'EEE, d MMM yyyy h:mm a',
                        ).format(booking.endDate),
                      ),
                      const Divider(),
                      if (breakdown != null) ...[
                        _row(
                          '${breakdown.rentalDays} days x ${Formatters.npr(breakdown.pricePerDay)}',
                          Formatters.npr(breakdown.baseAmount),
                        ),
                        _row(
                          'Service fee',
                          Formatters.npr(breakdown.serviceFee),
                        ),
                        if (breakdown.securityDeposit > 0)
                          _row(
                            'Refundable deposit',
                            Formatters.npr(breakdown.securityDeposit),
                          ),
                        if (booking.extensionAmount > 0)
                          _row(
                            isTestPayment
                                ? 'Test extension (not charged)'
                                : 'Paid extension',
                            Formatters.npr(booking.extensionAmount),
                          ),
                        if (booking.lateFeeAmount > 0)
                          _row(
                            'Late-fee estimate (not charged)',
                            Formatters.npr(booking.lateFeeAmount),
                          ),
                        const Divider(),
                      ],
                      _row(
                        isTestPayment
                            ? 'Test total (not charged)'
                            : 'Total paid',
                        Formatters.npr(booking.totalAmount),
                        bold: true,
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      Text(
                        isTestPayment
                            ? 'Download the clearly labelled test PDF for your coursework evidence.'
                            : 'Download the PDF for your records. No hidden fees.',
                        style: textTheme.bodyMedium,
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              ElevatedButton.icon(
                onPressed: _downloading ? null : _downloadPdf,
                icon: _downloading
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(Icons.download),
                label: const Text('Download PDF'),
              ),
              const SizedBox(height: AppSpacing.sm),
              OutlinedButton(
                onPressed: () => context.go('/home?tab=2'),
                child: const Text('View My Bookings'),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _row(String label, String value, {bool bold = false}) {
    final style = TextStyle(
      fontSize: bold ? 16 : 14,
      fontWeight: bold ? FontWeight.w700 : FontWeight.w400,
    );
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(child: Text(label, style: style)),
          Text(value, style: style),
        ],
      ),
    );
  }

  String _shortBookingId(String id) {
    if (id.length <= 8) return id.toUpperCase();
    return id.substring(id.length - 8).toUpperCase();
  }
}
