import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_theme.dart';
import '../../../core/api/api_endpoints.dart';

/// What the hosted provider page did before the view closed.
///
/// This is a navigation observation, never a payment result. Bike Buddy still
/// asks its own server, which verifies with eSewa or Khalti directly, before
/// any booking is treated as paid.
enum WalletCheckoutOutcome {
  /// The provider redirected back to Bike Buddy's return URL.
  returned,

  /// The provider redirected to the cancel/failure return URL.
  cancelled,

  /// The payer closed the view before the provider decided anything.
  dismissed,
}

/// Published sandbox logins, shown so a marker or tester can complete the flow.
/// These are test-environment credentials from the providers' own developer
/// documentation; no real wallet, account or money is involved.
class _SandboxCredentials {
  final String title;
  final List<(String, String)> rows;

  const _SandboxCredentials({required this.title, required this.rows});

  static const esewa = _SandboxCredentials(
    title: 'eSewa UAT test login',
    rows: [
      ('eSewa ID', '9806800001'),
      ('Password', 'Nepal@123'),
      ('MPIN', '1122'),
      ('Token / OTP', '123456'),
    ],
  );

  static const khalti = _SandboxCredentials(
    title: 'Khalti sandbox test login',
    rows: [
      ('Khalti ID', '9800000000'),
      ('MPIN', '1111'),
      ('OTP', '987654'),
    ],
  );

  static _SandboxCredentials? forProvider(String provider) =>
      switch (provider.toLowerCase()) {
        'esewa' => esewa,
        'khalti' => khalti,
        _ => null,
      };
}

/// Hosts the provider's own test checkout page inside the app.
///
/// Bike Buddy deliberately does not use the eSewa or Khalti mobile SDKs. The
/// server builds a signed request following each provider's published web
/// checkout documentation, and this view only displays the resulting page, so
/// the app never handles wallet credentials itself.
class WalletCheckoutPage extends StatefulWidget {
  final Uri checkoutUri;
  final String provider;
  final String amountLabel;
  final String transactionRef;

  const WalletCheckoutPage({
    super.key,
    required this.checkoutUri,
    required this.provider,
    required this.amountLabel,
    required this.transactionRef,
  });

  @override
  State<WalletCheckoutPage> createState() => _WalletCheckoutPageState();
}

class _WalletCheckoutPageState extends State<WalletCheckoutPage> {
  late final WebViewController _controller;
  bool _loading = true;
  bool _closing = false;
  String? _loadError;

  String get _providerLabel => switch (widget.provider.toLowerCase()) {
    'esewa' => 'eSewa',
    'khalti' => 'Khalti',
    _ => widget.provider,
  };

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      // The eSewa bridge page auto-submits its signed form with a script, and
      // both providers' checkout pages are script-driven.
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(
        NavigationDelegate(
          onNavigationRequest: (request) {
            final uri = Uri.tryParse(request.url);
            if (uri != null && ApiEndpoints.isPaymentCallbackUrl(uri)) {
              _finish(
                ApiEndpoints.isPaymentCancelledCallbackUrl(uri)
                    ? WalletCheckoutOutcome.cancelled
                    : WalletCheckoutOutcome.returned,
              );
              return NavigationDecision.prevent;
            }
            return NavigationDecision.navigate;
          },
          onPageStarted: (_) {
            if (mounted) setState(() => _loading = true);
          },
          onPageFinished: (_) {
            if (mounted) setState(() => _loading = false);
          },
          onWebResourceError: (error) {
            // Sub-resource failures (an icon, a tracker) must not replace a
            // working checkout page with an error screen. The flag is nullable
            // on some platforms, so only a definite sub-resource is ignored.
            if (error.isForMainFrame == false) return;
            if (mounted) {
              setState(() {
                _loading = false;
                _loadError =
                    'The $_providerLabel test page could not be loaded. '
                    'Check that your phone still has network access, then try again.';
              });
            }
          },
        ),
      )
      ..loadRequest(widget.checkoutUri);
  }

  void _finish(WalletCheckoutOutcome outcome) {
    if (_closing || !mounted) return;
    _closing = true;
    Navigator.of(context).pop(outcome);
  }

  @override
  Widget build(BuildContext context) {
    final credentials = _SandboxCredentials.forProvider(widget.provider);

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _finish(WalletCheckoutOutcome.dismissed);
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text('$_providerLabel test checkout'),
          leading: IconButton(
            icon: const Icon(Icons.close),
            tooltip: 'Cancel payment',
            onPressed: () => _finish(WalletCheckoutOutcome.dismissed),
          ),
          bottom: PreferredSize(
            preferredSize: const Size.fromHeight(30),
            child: Container(
              width: double.infinity,
              color: AppColors.warning.withValues(alpha: 0.15),
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.md,
                vertical: 6,
              ),
              child: Text(
                'SANDBOX / TEST - ${widget.amountLabel} - no real money',
                style: const TextStyle(
                  color: AppColors.warning,
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
        ),
        body: Column(
          children: [
            if (credentials != null) _CredentialsBanner(credentials),
            Expanded(
              child: Stack(
                children: [
                  if (_loadError == null)
                    WebViewWidget(controller: _controller)
                  else
                    _CheckoutError(
                      message: _loadError!,
                      onRetry: () {
                        setState(() {
                          _loadError = null;
                          _loading = true;
                        });
                        _controller.loadRequest(widget.checkoutUri);
                      },
                    ),
                  if (_loading && _loadError == null)
                    const LinearProgressIndicator(minHeight: 3),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CredentialsBanner extends StatelessWidget {
  final _SandboxCredentials credentials;

  const _CredentialsBanner(this.credentials);

  @override
  Widget build(BuildContext context) {
    return Theme(
      data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
      child: ExpansionTile(
        dense: true,
        leading: const Icon(Icons.vpn_key_outlined, color: AppColors.primary),
        title: Text(
          credentials.title,
          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
        ),
        subtitle: const Text(
          'Tap to show the published test credentials',
          style: TextStyle(fontSize: 11),
        ),
        childrenPadding: const EdgeInsets.fromLTRB(
          AppSpacing.md,
          0,
          AppSpacing.md,
          AppSpacing.sm,
        ),
        children: [
          for (final (label, value) in credentials.rows)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 2),
              child: Row(
                children: [
                  SizedBox(
                    width: 110,
                    child: Text(
                      label,
                      style: const TextStyle(fontSize: 12),
                    ),
                  ),
                  Expanded(
                    child: SelectableText(
                      value,
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _CheckoutError extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;

  const _CheckoutError({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.wifi_off, size: 40, color: AppColors.error),
            const SizedBox(height: AppSpacing.md),
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: AppSpacing.lg),
            ElevatedButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh),
              label: const Text('Try again'),
            ),
          ],
        ),
      ),
    );
  }
}
