import 'dart:async';

import 'package:flutter/material.dart';

import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_theme.dart';
import '../../../core/error/app_exception.dart';
import '../../../core/utils/formatters.dart';
import '../data/booking_model.dart';
import 'wallet_checkout_page.dart';

typedef PaymentStatusChecker = Future<PaymentStatus> Function();
typedef PaymentPageLauncher = Future<WalletCheckoutOutcome?> Function();

Future<PaymentStatus?> showSandboxPaymentSheet({
  required BuildContext context,
  required PaymentIntent intent,
  required PaymentStatusChecker checkStatus,
}) {
  return showModalBottomSheet<PaymentStatus>(
    context: context,
    isDismissible: false,
    enableDrag: false,
    isScrollControlled: true,
    useSafeArea: true,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(
        top: Radius.circular(AppRadius.large),
      ),
    ),
    builder: (context) =>
        PaymentAwaitingSheet(intent: intent, checkStatus: checkStatus),
  );
}

/// A provider-neutral hosted checkout handoff.
///
/// Bike Buddy opens the provider/server-hosted test page in the system browser
/// and trusts only the authenticated server status endpoint afterwards. A
/// browser redirect by itself can never mark a booking paid.
class PaymentAwaitingSheet extends StatefulWidget {
  final PaymentIntent intent;
  final PaymentStatusChecker checkStatus;
  final PaymentPageLauncher? openPaymentPage;
  final Duration pollingInterval;
  final int maxAutomaticChecks;

  const PaymentAwaitingSheet({
    super.key,
    required this.intent,
    required this.checkStatus,
    this.openPaymentPage,
    this.pollingInterval = const Duration(seconds: 4),
    this.maxAutomaticChecks = 30,
  });

  @override
  State<PaymentAwaitingSheet> createState() => _PaymentAwaitingSheetState();
}

class _PaymentAwaitingSheetState extends State<PaymentAwaitingSheet>
    with WidgetsBindingObserver {
  Timer? _pollTimer;
  PaymentStatus? _status;
  bool _checking = false;
  bool _opening = false;

  /// True while the provider page sits on top of this sheet. Polling must not
  /// run then: a success would call [Navigator.pop] and close the checkout
  /// view instead of the sheet, stranding the payer on a paid-but-open screen.
  bool _checkoutOpen = false;
  int _automaticChecks = 0;
  String? _localMessage;

  /// What the provider page did on the way out. Kept separate from
  /// [_localMessage], which each status check resets, so the note survives the
  /// verification that immediately follows it.
  String? _checkoutNote;

  bool get _isTerminal => _status?.terminal ?? false;

  bool get _pollingLimitReached =>
      _automaticChecks >= widget.maxAutomaticChecks;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      unawaited(_checkPayment(automatic: true));
    });
    _pollTimer = Timer.periodic(widget.pollingInterval, (_) {
      if (!mounted || _isTerminal || _pollingLimitReached) return;
      unawaited(_checkPayment(automatic: true));
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && !_isTerminal) {
      unawaited(_checkPayment(automatic: true));
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _pollTimer?.cancel();
    super.dispose();
  }

  /// Opens the provider's hosted test page inside the app.
  ///
  /// The returned outcome only decides what to tell the payer while the
  /// authoritative check runs. Whatever the provider redirect claimed, the
  /// booking still moves only on the server-verified status below.
  Future<void> _openPaymentPage() async {
    final checkoutUri = widget.intent.checkoutUri;
    if (checkoutUri == null || _opening) return;

    setState(() {
      _opening = true;
      _checkoutOpen = true;
      _localMessage = null;
      _checkoutNote = null;
    });
    try {
      final outcome =
          await (widget.openPaymentPage?.call() ??
              Navigator.of(context).push<WalletCheckoutOutcome>(
                MaterialPageRoute(
                  fullscreenDialog: true,
                  builder: (_) => WalletCheckoutPage(
                    checkoutUri: checkoutUri,
                    provider: widget.intent.provider,
                    amountLabel: _amountLabel(widget.intent),
                    transactionRef: widget.intent.transactionRef,
                  ),
                ),
              ));
      if (!mounted) return;
      setState(() {
        _checkoutOpen = false;
        _checkoutNote = switch (outcome) {
          WalletCheckoutOutcome.returned =>
            'Returned from the test checkout. Confirming with Bike Buddy...',
          WalletCheckoutOutcome.cancelled =>
            'The test checkout was cancelled. You were not charged.',
          WalletCheckoutOutcome.dismissed =>
            'Checkout closed before it finished. Open it again to pay.',
          null => 'Checkout closed. Open it again to pay.',
        };
      });
      // Re-check in every case: a payer can complete the wallet flow and still
      // dismiss the view before the provider finishes redirecting. This one is
      // deliberately not an automatic poll, so it still runs after a long
      // checkout has used up the automatic budget.
      unawaited(_checkPayment(automatic: false));
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _checkoutOpen = false;
        _localMessage =
            'Could not open the payment page. Check your connection and try again.';
      });
    } finally {
      if (mounted) {
        setState(() {
          _opening = false;
          _checkoutOpen = false;
        });
      }
    }
  }

  Future<void> _checkPayment({required bool automatic}) async {
    if (_checking || _isTerminal || _checkoutOpen) return;
    if (automatic && _pollingLimitReached) return;

    if (automatic) _automaticChecks += 1;
    setState(() {
      _checking = true;
      _localMessage = null;
    });

    try {
      final status = await widget.checkStatus();
      if (!mounted) return;
      setState(() => _status = status);

      if (status.isSucceeded) {
        _pollTimer?.cancel();
        Navigator.of(context).pop(status);
        return;
      }

      if (status.terminal) {
        _pollTimer?.cancel();
      } else if (_pollingLimitReached) {
        setState(() {
          _localMessage =
              'Automatic checks paused. Use "Check payment status" when you are ready.';
        });
      }
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _localMessage = error is AppException
            ? error.message
            : 'Could not check payment status. Your booking is saved; try again.';
      });
    } finally {
      if (mounted) setState(() => _checking = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final status = _status;
    final provider = _providerLabel(widget.intent.provider);
    final statusLabel = _statusLabel(status);
    final statusColor = _statusColor(status);
    final statusIcon = _statusIcon(status);

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: LayoutBuilder(
        builder: (context, constraints) => SingleChildScrollView(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 560),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        padding: const EdgeInsets.all(AppSpacing.sm),
                        decoration: BoxDecoration(
                          color: AppColors.primaryLight,
                          borderRadius: BorderRadius.circular(AppRadius.medium),
                        ),
                        child: const Icon(
                          Icons.open_in_browser,
                          color: AppColors.primary,
                        ),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '$provider test checkout',
                              style: Theme.of(context).textTheme.titleLarge,
                            ),
                            const SizedBox(height: AppSpacing.xs),
                            const _SandboxBadge(),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.md),
                  Container(
                    padding: const EdgeInsets.all(AppSpacing.md),
                    decoration: BoxDecoration(
                      color: AppColors.warning.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(AppRadius.medium),
                    ),
                    child: Text(
                      widget.intent.notice ??
                          'Sandbox/test payment only. Use provider test credentials; no real money is charged.',
                      style: const TextStyle(
                        color: AppColors.warning,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(AppSpacing.md),
                      child: Column(
                        children: [
                          _SummaryRow(
                            label: 'Locked total',
                            value: _amountLabel(widget.intent),
                            valueKey: const Key('sandbox-payment-total'),
                          ),
                          const Divider(height: AppSpacing.lg),
                          _SummaryRow(
                            label: 'Reference',
                            value: widget.intent.transactionRef,
                            valueKey: const Key('sandbox-payment-reference'),
                          ),
                          const Divider(height: AppSpacing.lg),
                          _SummaryRow(label: 'Provider', value: provider),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  Semantics(
                    liveRegion: true,
                    label: 'Payment status: $statusLabel',
                    child: Container(
                      key: const Key('sandbox-payment-status'),
                      padding: const EdgeInsets.all(AppSpacing.md),
                      decoration: BoxDecoration(
                        color: statusColor.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(AppRadius.medium),
                        border: Border.all(
                          color: statusColor.withValues(alpha: 0.4),
                        ),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (_checking)
                            SizedBox(
                              width: 22,
                              height: 22,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: statusColor,
                              ),
                            )
                          else
                            Icon(statusIcon, color: statusColor),
                          const SizedBox(width: AppSpacing.sm),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  statusLabel,
                                  style: TextStyle(
                                    color: statusColor,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                const SizedBox(height: AppSpacing.xs),
                                Text(
                                  status?.message ??
                                      'Waiting for verified status from Bike Buddy.',
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  if (_checkoutNote != null) ...[
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      _checkoutNote!,
                      key: const Key('sandbox-checkout-note'),
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                  ],
                  if (_localMessage != null) ...[
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      _localMessage!,
                      key: const Key('sandbox-payment-local-message'),
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                  ],
                  const SizedBox(height: AppSpacing.md),
                  const Text(
                    'Bike Buddy never asks for or stores wallet credentials. Returning from the browser is not proof of payment; the server verifies the provider result.',
                    style: TextStyle(fontSize: 13),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  if (!_isTerminal) ...[
                    ElevatedButton.icon(
                      key: const Key('open-sandbox-payment'),
                      onPressed: _opening || widget.intent.checkoutUri == null
                          ? null
                          : _openPaymentPage,
                      icon: _opening
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Icon(Icons.open_in_new),
                      label: Text(
                        _opening ? 'Opening...' : 'Open payment page',
                      ),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    OutlinedButton.icon(
                      key: const Key('check-sandbox-payment'),
                      onPressed: _checking
                          ? null
                          : () => _checkPayment(automatic: false),
                      icon: const Icon(Icons.refresh),
                      label: Text(
                        _checking ? 'Checking...' : 'Check payment status',
                      ),
                    ),
                    TextButton(
                      onPressed: () => Navigator.of(context).pop(),
                      child: const Text('Close and finish later'),
                    ),
                  ] else ...[
                    ElevatedButton(
                      key: const Key('retry-terminal-payment'),
                      onPressed: () => Navigator.of(context).pop(status),
                      child: Text(
                        status?.isCancelled == true
                            ? 'Choose another payment method'
                            : 'Try another payment',
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  static String _providerLabel(String provider) =>
      switch (provider.toLowerCase()) {
        'esewa' => 'eSewa',
        'khalti' => 'Khalti',
        _ => provider,
      };

  static String _amountLabel(PaymentIntent intent) {
    if (intent.currency.toUpperCase() == 'NPR') {
      return Formatters.npr(intent.amount);
    }
    return '${intent.currency.toUpperCase()} ${intent.amount.toStringAsFixed(2)}';
  }

  static String _statusLabel(PaymentStatus? status) {
    if (status == null) return 'Awaiting payment';
    if (status.isSucceeded) return 'Payment verified';
    if (status.isCancelled) return 'Payment cancelled';
    if (status.isFailed) return 'Payment failed';
    return 'Payment pending';
  }

  static Color _statusColor(PaymentStatus? status) {
    if (status?.isSucceeded == true) return AppColors.success;
    if (status?.isCancelled == true) return AppColors.textSecondary;
    if (status?.isFailed == true) return AppColors.error;
    return AppColors.warning;
  }

  static IconData _statusIcon(PaymentStatus? status) {
    if (status?.isSucceeded == true) return Icons.check_circle_outline;
    if (status?.isCancelled == true) return Icons.cancel_outlined;
    if (status?.isFailed == true) return Icons.error_outline;
    return Icons.hourglass_top;
  }
}

class _SandboxBadge extends StatelessWidget {
  const _SandboxBadge();

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: AppColors.warning.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(AppRadius.pill),
      ),
      child: const Padding(
        padding: EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: 4),
        child: Text(
          'SANDBOX / TEST - NO REAL CHARGE',
          style: TextStyle(
            color: AppColors.warning,
            fontSize: 11,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }
}

class _SummaryRow extends StatelessWidget {
  final String label;
  final String value;
  final Key? valueKey;

  const _SummaryRow({required this.label, required this.value, this.valueKey});

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Text(label, style: Theme.of(context).textTheme.bodyMedium),
        ),
        const SizedBox(width: AppSpacing.md),
        Flexible(
          child: SelectableText(
            value,
            key: valueKey,
            textAlign: TextAlign.end,
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
        ),
      ],
    );
  }
}
