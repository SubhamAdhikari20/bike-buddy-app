import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_theme.dart';
import '../../../core/error/app_exception.dart';
import '../../../core/services/local_store.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/error_view.dart';
import '../../../core/widgets/loading_view.dart';
import '../../../core/widgets/secure_badge.dart';
import '../../bikes/data/bike_model.dart';
import '../../bikes/presentation/providers/bikes_provider.dart';
import '../data/booking_api.dart';
import '../data/booking_model.dart';
import 'payment_awaiting_sheet.dart';

/// The 3-step booking flow (BK-01): 1) pick dates with a live fare,
/// 2) review the full summary, 3) pay. A progress bar shows the step at
/// all times (H1) and Back never loses data (H3, BK-06).
class BookingFlowPage extends ConsumerStatefulWidget {
  final String bikeId;
  final String? initialBookingId;

  const BookingFlowPage({
    super.key,
    required this.bikeId,
    this.initialBookingId,
  });

  @override
  ConsumerState<BookingFlowPage> createState() => _BookingFlowPageState();
}

class _BookingFlowPageState extends ConsumerState<BookingFlowPage> {
  static const _budgetWarningNpr = 5000.0; // PR-02 budget nudge

  int _step = 0;
  DateTimeRange? _dates;
  FareQuote? _quote;
  bool _quoteLoading = false;
  String? _quoteError;
  Timer? _quoteDebounce;

  Booking? _booking;
  String _provider = 'esewa';
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    if (widget.initialBookingId != null) {
      Future.microtask(_restorePendingBooking);
    }
  }

  Future<void> _restorePendingBooking() async {
    setState(() => _busy = true);
    try {
      final booking = await ref
          .read(bookingApiProvider)
          .getBooking(widget.initialBookingId!);
      final quote = await ref
          .read(bookingApiProvider)
          .quote(
            bikeId: widget.bikeId,
            start: booking.startDate,
            end: booking.endDate,
          );
      if (!mounted) return;
      setState(() {
        _booking = booking;
        _dates = DateTimeRange(start: booking.startDate, end: booking.endDate);
        _quote = quote;
        _step = 2;
      });
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            error is AppException
                ? error.message
                : 'Could not restore this booking.',
          ),
          backgroundColor: AppColors.error,
        ),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  void dispose() {
    _quoteDebounce?.cancel();
    super.dispose();
  }

  Future<void> _pickDates() async {
    final now = DateTime.now();
    final picked = await showDateRangePicker(
      context: context,
      firstDate: now,
      lastDate: now.add(const Duration(days: 90)),
      initialDateRange: _dates,
      helpText: 'When do you want the bike?',
      saveText: 'Done',
    );
    if (picked != null) {
      setState(() {
        _dates = picked;
        _booking = null;
      });
      _refreshQuote();
    }
  }

  void _quickDuration(int days) {
    final start = DateTime.now().add(const Duration(hours: 1));
    setState(() {
      _dates = DateTimeRange(
        start: start,
        end: start.add(Duration(days: days)),
      );
      _booking = null;
    });
    _refreshQuote();
  }

  // Live fare estimate updates within a second of a change (PR-02).
  void _refreshQuote() {
    final dates = _dates;
    if (dates == null) return;
    _quoteDebounce?.cancel();
    setState(() {
      _quoteLoading = true;
      _quoteError = null;
    });
    _quoteDebounce = Timer(const Duration(milliseconds: 350), () async {
      try {
        final quote = await ref
            .read(bookingApiProvider)
            .quote(bikeId: widget.bikeId, start: dates.start, end: dates.end);
        if (mounted) setState(() => _quote = quote);
      } catch (e) {
        if (mounted) {
          setState(
            () => _quoteError = e is AppException
                ? e.message
                : 'Could not fetch the price.',
          );
        }
      } finally {
        if (mounted) setState(() => _quoteLoading = false);
      }
    });
  }

  Future<void> _confirmAndPay(Bike bike) async {
    final dates = _dates;
    if (dates == null) return;
    setState(() => _busy = true);
    try {
      // Create once; retries after a failed payment reuse it (PR-05).
      _booking ??= await ref
          .read(bookingApiProvider)
          .create(
            bikeId: widget.bikeId,
            start: dates.start,
            end: dates.end,
            pickupLocation: '${bike.location.label}, ${bike.location.address}',
          );

      // Cash at pickup skips the gateway entirely (PR-03).
      if (_provider == 'cash') {
        final cash = await ref
            .read(bookingApiProvider)
            .confirmCash(_booking!.id);
        await LocalStore.clearBookingDraft();
        ref.invalidate(myBookingsProvider);
        if (!mounted) return;
        await showDialog(
          context: context,
          builder: (context) => AlertDialog(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppRadius.large),
            ),
            icon: const Icon(
              Icons.payments_outlined,
              size: 40,
              color: AppColors.success,
            ),
            title: const Text('Cash request sent'),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Reference: ${cash['reference']}',
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  cash['instructions'] as String? ??
                      'Bring the cash to the pickup point and show this reference.',
                ),
                const SizedBox(height: AppSpacing.sm),
                const Text(
                  'Your booking request is awaiting owner approval. Track it in My Bookings.',
                ),
              ],
            ),
            actions: [
              ElevatedButton(
                onPressed: () => Navigator.of(context).pop(),
                child: const Text('Got it'),
              ),
            ],
          ),
        );
        if (mounted) context.go('/home?tab=2');
        return;
      }

      final intent = await ref
          .read(bookingApiProvider)
          .initiatePayment(bookingId: _booking!.id, provider: _provider);

      if (!mounted) return;
      if (intent.isDemo && intent.demoConfirmationRequired) {
        await _completeLocalDemoPayment(intent);
        return;
      }

      if (intent.isSandbox && intent.checkoutUri != null) {
        final status = await showSandboxPaymentSheet(
          context: context,
          intent: intent,
          checkStatus: () =>
              ref.read(bookingApiProvider).paymentStatus(intent.paymentId),
        );
        if (!mounted || status == null) return;

        if (status.isSucceeded && status.bookingId == _booking!.id) {
          await _finishSuccessfulPayment();
        } else if (status.isSucceeded) {
          throw const AppException(
            'The verified payment did not match this booking. Contact support before trying again.',
          );
        } else if (status.terminal) {
          _showPaymentFailure(message: status.message);
        }
        return;
      }

      // A sandbox intent without a checkout URL is a real server state, not a
      // misconfiguration: Khalti initiation may still be in flight or awaiting
      // reconciliation. Surface the server's own explanation instead of
      // telling the renter that payments are broken.
      if (intent.isSandbox) {
        throw AppException(
          intent.notice ??
              'The wallet checkout is still being prepared. Wait a moment and try again.',
        );
      }

      throw const AppException(
        'Payment is not configured safely. Use local demo mode or ask the administrator to enable a sandbox provider.',
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              e is AppException
                  ? e.message
                  : 'Something went wrong. Please try again.',
            ),
            backgroundColor: AppColors.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _completeLocalDemoPayment(PaymentIntent intent) async {
    final success = await _showDemoGateway(intent);
    if (success == null || !mounted) return;

    final result = await ref
        .read(bookingApiProvider)
        .confirmDemoPayment(paymentId: intent.paymentId, success: success);

    if (!mounted) return;
    if (result['succeeded'] == true) {
      await _finishSuccessfulPayment();
    } else {
      _showPaymentFailure();
    }
  }

  Future<void> _finishSuccessfulPayment() async {
    await LocalStore.clearBookingDraft();
    ref.invalidate(myBookingsProvider);
    if (mounted) context.pushReplacement('/receipt/${_booking!.id}');
  }

  /// Explicit coursework simulation. It never collects wallet credentials or
  /// represents itself as a live eSewa/Khalti transaction.
  Future<bool?> _showDemoGateway(PaymentIntent intent) {
    return showModalBottomSheet<bool>(
      context: context,
      isDismissible: false,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(AppRadius.large),
        ),
      ),
      builder: (context) => Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Icon(
                  _provider == 'esewa'
                      ? Icons.wallet
                      : Icons.account_balance_wallet,
                  color: AppColors.primary,
                ),
                const SizedBox(width: AppSpacing.sm),
                Text(
                  '${_provider == 'esewa' ? 'eSewa' : 'Khalti'} Demo',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const Spacer(),
                const SecureBadge(),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            Container(
              padding: const EdgeInsets.all(AppSpacing.sm),
              decoration: BoxDecoration(
                color: AppColors.warning.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(AppRadius.small),
              ),
              child: Text(
                intent.notice ??
                    'Coursework simulation only — no money will be charged.',
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: AppColors.warning,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              'Ref: ${intent.transactionRef}',
              style: Theme.of(context).textTheme.labelSmall,
            ),
            const SizedBox(height: AppSpacing.md),
            Text(
              'Demo total ${Formatters.npr(intent.amount)}',
              style: Theme.of(context).textTheme.displayLarge,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppSpacing.lg),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.success,
              ),
              onPressed: () => Navigator.of(context).pop(true),
              child: const Text('Complete Demo Booking'),
            ),
            const SizedBox(height: AppSpacing.sm),
            OutlinedButton(
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.error,
                side: const BorderSide(color: AppColors.error),
              ),
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text('Test a Failed Payment'),
            ),
            TextButton(
              onPressed: () => Navigator.of(context).pop(null),
              child: const Text('Cancel'),
            ),
          ],
        ),
      ),
    );
  }

  // Clear failure handling: reason, proof of no charge, retry without
  // re-entering anything, and a support way out (PR-05, H6).
  void _showPaymentFailure({String? message}) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.large),
        ),
        icon: const Icon(Icons.error_outline, size: 40, color: AppColors.error),
        title: const Text('Payment failed'),
        content: Text(
          message ??
              'The payment did not go through and you were NOT charged. '
                  'Your booking and details are saved - just try again.',
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.of(context).pop();
              context.push('/support');
            },
            child: const Text('Contact support'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Try Again'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final bikeAsync = ref.watch(bikeDetailProvider(widget.bikeId));

    return Scaffold(
      appBar: AppBar(title: const Text('Book This Bike')),
      body: bikeAsync.when(
        loading: () => const LoadingView(label: 'Getting things ready...'),
        error: (error, _) => ErrorView(
          message: error.toString(),
          onRetry: () => ref.invalidate(bikeDetailProvider(widget.bikeId)),
        ),
        data: (bike) => Column(
          children: [
            // Step progress (1/3, 2/3, 3/3) - always visible (BK-01).
            Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: Column(
                children: [
                  Row(
                    children: List.generate(3, (index) {
                      final active = index <= _step;
                      return Expanded(
                        child: Container(
                          margin: EdgeInsets.only(
                            right: index < 2 ? AppSpacing.sm : 0,
                          ),
                          height: 6,
                          decoration: BoxDecoration(
                            color: active
                                ? AppColors.primary
                                : AppColors.divider,
                            borderRadius: BorderRadius.circular(AppRadius.pill),
                          ),
                        ),
                      );
                    }),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    'Step ${_step + 1} of 3 - ${['Choose dates', 'Review', 'Payment'][_step]}',
                    style: Theme.of(context).textTheme.labelSmall,
                  ),
                ],
              ),
            ),
            Expanded(
              child: switch (_step) {
                0 => _buildDatesStep(bike),
                1 => _buildReviewStep(bike),
                _ => _buildPayStep(bike),
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDatesStep(Bike bike) {
    final textTheme = Theme.of(context).textTheme;
    final dates = _dates;
    final quote = _quote;
    final overBudget =
        quote != null && quote.breakdown.total > _budgetWarningNpr;

    return ListView(
      padding: const EdgeInsets.all(AppSpacing.md),
      children: [
        Text(
          'How long do you need the ${bike.title}?',
          style: textTheme.titleLarge,
        ),
        const SizedBox(height: AppSpacing.md),
        Wrap(
          spacing: AppSpacing.sm,
          children: [
            for (final (label, days) in [
              ('1 day', 1),
              ('2 days', 2),
              ('3 days', 3),
              ('1 week', 7),
            ])
              ChoiceChip(
                label: Text(label),
                selected: dates != null && dates.duration.inDays == days,
                selectedColor: AppColors.mint,
                showCheckmark: false,
                onSelected: (_) => _quickDuration(days),
              ),
          ],
        ),
        const SizedBox(height: AppSpacing.sm),
        Card(
          child: ListTile(
            leading: const Icon(Icons.calendar_month, color: AppColors.primary),
            title: Text(
              dates == null
                  ? 'Pick your dates'
                  : '${DateFormat('EEE, d MMM').format(dates.start)} - ${DateFormat('EEE, d MMM').format(dates.end)}',
            ),
            subtitle: dates == null
                ? const Text('Advance booking supported up to 90 days')
                : Text('${dates.duration.inDays} day rental'),
            trailing: const Icon(Icons.edit_calendar_outlined),
            onTap: _pickDates,
          ),
        ),
        const SizedBox(height: AppSpacing.md),

        // Live fare estimate (PR-02).
        if (_quoteLoading)
          const Card(
            child: Padding(
              padding: EdgeInsets.all(AppSpacing.md),
              child: Row(
                children: [
                  SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                  SizedBox(width: AppSpacing.sm),
                  Text('Updating your fare...'),
                ],
              ),
            ),
          )
        else if (_quoteError != null)
          Card(
            child: ListTile(
              leading: const Icon(Icons.error_outline, color: AppColors.error),
              title: Text(_quoteError!),
              trailing: TextButton(
                onPressed: _refreshQuote,
                child: const Text('Retry'),
              ),
            ),
          )
        else if (quote != null) ...[
          Card(
            color: AppColors.primaryLight,
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('Estimated total', style: textTheme.titleMedium),
                      Text(
                        Formatters.npr(quote.breakdown.total),
                        style: textTheme.displayLarge?.copyWith(
                          color: AppColors.primary,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        '${quote.breakdown.rentalDays} days x ${Formatters.npr(quote.breakdown.pricePerDay)}',
                        style: textTheme.bodyMedium,
                      ),
                      const Text(
                        'No hidden fees',
                        style: TextStyle(
                          fontSize: 12,
                          color: AppColors.success,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          if (overBudget)
            Padding(
              padding: const EdgeInsets.only(top: AppSpacing.sm),
              child: Row(
                children: [
                  const Icon(
                    Icons.info_outline,
                    size: 16,
                    color: AppColors.warning,
                  ),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      'Heads up: this is above ${Formatters.npr(_budgetWarningNpr)}. A shorter rental or another bike could cost less.',
                      style: textTheme.bodyMedium?.copyWith(
                        color: AppColors.warning,
                      ),
                    ),
                  ),
                ],
              ),
            ),
        ],
        const SizedBox(height: AppSpacing.lg),
        ElevatedButton(
          onPressed: dates != null && quote != null && !_quoteLoading
              ? () => setState(() => _step = 1)
              : null,
          child: const Text('Continue'),
        ),
      ],
    );
  }

  Widget _buildReviewStep(Bike bike) {
    final textTheme = Theme.of(context).textTheme;
    final dates = _dates!;
    final quote = _quote!;

    return ListView(
      padding: const EdgeInsets.all(AppSpacing.md),
      children: [
        Text(
          'Check everything before you confirm',
          style: textTheme.titleLarge,
        ),
        const SizedBox(height: AppSpacing.md),

        // Every row is editable from here (BK-06, H3).
        Card(
          child: Column(
            children: [
              ListTile(
                leading: const Icon(
                  Icons.two_wheeler,
                  color: AppColors.primary,
                ),
                title: Text(bike.title),
                subtitle: Text('${bike.brand} · ${bike.engineCc}cc'),
              ),
              const Divider(height: 1),
              ListTile(
                leading: const Icon(
                  Icons.calendar_month,
                  color: AppColors.primary,
                ),
                title: Text(
                  '${DateFormat('EEE, d MMM h:mm a').format(dates.start)} -',
                ),
                subtitle: Text(
                  DateFormat('EEE, d MMM h:mm a').format(dates.end),
                ),
                trailing: IconButton(
                  tooltip: 'Change dates',
                  icon: const Icon(Icons.edit_outlined, size: 20),
                  onPressed: () => setState(() => _step = 0),
                ),
              ),
              const Divider(height: 1),
              ListTile(
                leading: const Icon(
                  Icons.location_on_outlined,
                  color: AppColors.primary,
                ),
                title: Text(bike.location.label),
                subtitle: Text(
                  '${bike.location.address}${bike.location.landmark != null ? '\n${bike.location.landmark}' : ''}',
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.md),

        // Itemised breakdown before any payment (PR-01, H5).
        Text('Price breakdown', style: textTheme.titleMedium),
        const SizedBox(height: AppSpacing.sm),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: Column(
              children: [
                _priceRow(
                  '${quote.breakdown.rentalDays} days x ${Formatters.npr(quote.breakdown.pricePerDay)}',
                  Formatters.npr(quote.breakdown.baseAmount),
                ),
                _priceRow(
                  'Service fee',
                  Formatters.npr(quote.breakdown.serviceFee),
                ),
                if (quote.breakdown.securityDeposit > 0)
                  _priceRow(
                    'Refundable security deposit',
                    Formatters.npr(quote.breakdown.securityDeposit),
                    muted: true,
                  ),
                const Divider(),
                _priceRow(
                  'Total to pay now',
                  Formatters.npr(quote.breakdown.total),
                  bold: true,
                ),
                const SizedBox(height: AppSpacing.xs),
                const Align(
                  alignment: Alignment.centerRight,
                  child: Text(
                    'No hidden fees',
                    style: TextStyle(
                      fontSize: 12,
                      color: AppColors.success,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        Text(
          'By confirming you agree to return the bike on time and follow the damage policy shown on the listing.',
          style: textTheme.bodyMedium,
        ),
        const SizedBox(height: AppSpacing.lg),
        ElevatedButton(
          onPressed: () => setState(() => _step = 2),
          child: const Text('Confirm & Continue to Payment'),
        ),
        TextButton(
          onPressed: () => setState(() => _step = 0),
          child: const Text('Go Back'),
        ),
      ],
    );
  }

  Widget _buildPayStep(Bike bike) {
    final textTheme = Theme.of(context).textTheme;
    final quote = _quote!;

    return ListView(
      padding: const EdgeInsets.all(AppSpacing.md),
      children: [
        Card(
          color: AppColors.warning.withValues(alpha: 0.12),
          child: const Padding(
            padding: EdgeInsets.all(AppSpacing.md),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.science_outlined, color: AppColors.warning),
                SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Text(
                    'Test payments only. Sandbox mode opens an eSewa or Khalti test checkout using provider test credentials; no real money is charged. Local demo mode stays inside Bike Buddy and never contacts a wallet.',
                    style: TextStyle(
                      color: AppColors.warning,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.md),

        // Price locked banner (PR-07).
        Card(
          color: AppColors.mint,
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: Row(
              children: [
                const Icon(Icons.lock, color: AppColors.teal),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Text(
                    'Price locked at ${Formatters.npr(quote.breakdown.total)}. It cannot change unless you change the booking.',
                    style: const TextStyle(fontWeight: FontWeight.w500),
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.md),

        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text('Choose payment method', style: textTheme.titleLarge),
            const SecureBadge(),
          ],
        ),
        const SizedBox(height: AppSpacing.sm),

        // Cash is an equal option, not an afterthought (PR-03).
        for (final (value, label, icon) in [
          ('esewa', 'eSewa', Icons.wallet),
          ('khalti', 'Khalti', Icons.account_balance_wallet),
          ('cash', 'Cash at Pickup', Icons.payments_outlined),
        ])
          Card(
            shape: _provider == value
                ? RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppRadius.large),
                    side: const BorderSide(color: AppColors.primary, width: 2),
                  )
                : null,
            child: RadioListTile<String>(
              value: value,
              // ignore: deprecated_member_use
              groupValue: _provider,
              // ignore: deprecated_member_use
              onChanged: (selected) =>
                  setState(() => _provider = selected ?? 'esewa'),
              title: Row(
                children: [
                  Icon(icon, color: AppColors.primary),
                  const SizedBox(width: AppSpacing.sm),
                  Text(label),
                ],
              ),
              subtitle: Text(
                value == 'cash'
                    ? 'Pay at pickup with a booking reference'
                    : 'Hosted sandbox/test checkout or local demo, based on server configuration',
              ),
            ),
          ),
        const SizedBox(height: AppSpacing.lg),

        ElevatedButton(
          onPressed: _busy ? null : () => _confirmAndPay(bike),
          child: _busy
              ? const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.white,
                  ),
                )
              : Text('Continue - ${Formatters.npr(quote.breakdown.total)}'),
        ),
        TextButton(
          onPressed: _busy ? null : () => setState(() => _step = 1),
          child: const Text('Back to review'),
        ),
      ],
    );
  }

  Widget _priceRow(
    String label,
    String value, {
    bool bold = false,
    bool muted = false,
  }) {
    final style = TextStyle(
      fontSize: bold ? 16 : 14,
      fontWeight: bold ? FontWeight.w700 : FontWeight.w400,
      color: muted ? AppColors.textMuted : AppColors.textPrimary,
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
}
