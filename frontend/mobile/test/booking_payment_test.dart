import 'package:bike_buddy/core/api/api_endpoints.dart';
import 'package:bike_buddy/core/widgets/secure_badge.dart';
import 'package:bike_buddy/features/bookings/data/booking_model.dart';
import 'package:bike_buddy/features/bookings/presentation/payment_awaiting_sheet.dart';
import 'package:bike_buddy/features/bookings/presentation/wallet_checkout_page.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('payment intent preserves explicit demo-state messaging', () {
    final intent = PaymentIntent.fromJson({
      'paymentId': 'payment-1',
      'transactionRef': 'BB-123',
      'amount': 4200,
      'provider': 'esewa',
      'mode': 'demo',
      'demoConfirmationRequired': true,
      'notice': 'Coursework demo only — no money will be charged.',
    });

    expect(intent.mode, 'demo');
    expect(intent.demoConfirmationRequired, isTrue);
    expect(intent.notice, contains('no money'));
  });

  test('sandbox intent validates only hosted HTTP payment URLs', () {
    final intent = PaymentIntent.fromJson({
      'paymentId': 'payment-sandbox',
      'transactionRef': 'BB-SBX-123',
      'amount': 4200,
      'currency': 'NPR',
      'provider': 'khalti',
      'mode': 'sandbox',
      'paymentUrl': 'https://test-pay.khalti.example/checkout',
      'demoConfirmationRequired': false,
      'notice': 'Sandbox only - no real charge.',
    });

    expect(intent.isSandbox, isTrue);
    expect(intent.isDemo, isFalse);
    expect(intent.currency, 'NPR');
    expect(intent.checkoutUri?.scheme, 'https');

    final unsafe = PaymentIntent.fromJson({
      'mode': 'sandbox',
      'paymentUrl': 'javascript:alert(1)',
    });
    expect(unsafe.checkoutUri, isNull);

    final insecureRemote = PaymentIntent.fromJson({
      'mode': 'sandbox',
      'paymentUrl': 'http://wallet.example/checkout',
    });
    expect(insecureRemote.checkoutUri, isNull);

    final localBridge = PaymentIntent.fromJson({
      'mode': 'sandbox',
      'paymentUrl': 'http://10.0.2.2:5050/payments/esewa/bridge',
    });
    expect(
      localBridge.checkoutUri?.host,
      Uri.parse(ApiEndpoints.serverUrl).host,
    );
  });

  test('payment succeeds only when the server state is paid and terminal', () {
    PaymentStatus status({
      required String value,
      required bool paid,
      required bool terminal,
    }) => PaymentStatus.fromJson({
      'paymentId': 'payment-1',
      'bookingId': 'booking-1',
      'provider': 'esewa',
      'mode': 'sandbox',
      'status': value,
      'paid': paid,
      'terminal': terminal,
      'message': 'Status checked by server.',
    });

    expect(
      status(value: 'succeeded', paid: true, terminal: true).isSucceeded,
      isTrue,
    );
    expect(
      status(value: 'succeeded', paid: false, terminal: true).isSucceeded,
      isFalse,
    );
    expect(
      status(value: 'pending', paid: true, terminal: false).isSucceeded,
      isFalse,
    );
  });

  test('booking model preserves cash reconciliation evidence', () {
    final booking = Booking.fromJson({
      '_id': 'booking-1',
      'bikeId': 'bike-1',
      'startDate': '2030-01-01T10:00:00.000Z',
      'endDate': '2030-01-02T10:00:00.000Z',
      'pickupLocation': 'Thamel',
      'status': 'confirmed',
      'paymentStatus': 'pending',
      'paymentMethod': 'cash',
      'cashReference': 'CASH-BB-123',
      'totalAmount': 4200,
    });

    expect(booking.paymentMethod, 'cash');
    expect(booking.cashReference, 'CASH-BB-123');
    expect(booking.cashReceivedAt, isNull);
  });

  test('booking detail model preserves checklist and cancellation context', () {
    final booking = Booking.fromJson({
      '_id': 'booking-cancelled',
      'bikeId': 'bike-1',
      'startDate': '2030-01-01T10:00:00.000Z',
      'endDate': '2030-01-02T10:00:00.000Z',
      'pickupLocation': 'Thamel',
      'status': 'cancelled',
      'paymentStatus': 'unpaid',
      'totalAmount': 4200,
      'cancellationReason': 'Plans changed',
      'preRideChecklist': {
        'items': [
          {'key': 'brakes', 'ok': true},
        ],
        'photos': ['private-evidence-url'],
        'acknowledged': true,
        'completedAt': '2030-01-01T09:45:00.000Z',
      },
    });

    expect(booking.cancellationReason, 'Plans changed');
    expect(booking.checklistDone, isTrue);
    expect(booking.checklistItemCount, 1);
    expect(booking.checklistPhotoCount, 1);
    expect(booking.checklistAcknowledged, isTrue);
  });

  test('damage report summary does not expose evidence URLs', () {
    final report = BookingDamageReport.fromJson({
      '_id': 'damage-1',
      'bookingId': 'booking-1',
      'description': 'Scratch near the left panel',
      'status': 'reviewed',
      'photos': ['private-one', 'private-two'],
    });

    expect(report.bookingId, 'booking-1');
    expect(report.photoCount, 2);
    expect(report.status, 'reviewed');
  });

  testWidgets('checkout badge explains that demo mode never charges money', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(body: Center(child: SecureBadge())),
      ),
    );

    expect(find.text('Demo mode'), findsOneWidget);
    await tester.tap(find.text('Demo mode'));
    await tester.pumpAndSettle();

    expect(find.text('Coursework demo mode'), findsOneWidget);
    expect(find.textContaining('no money is charged'), findsOneWidget);
  });

  testWidgets('sandbox checkout keeps amount and reference visible', (
    tester,
  ) async {
    var openCount = 0;
    final intent = PaymentIntent.fromJson({
      'paymentId': 'payment-sandbox',
      'transactionRef': 'BB-SBX-123',
      'amount': 4200,
      'currency': 'NPR',
      'provider': 'khalti',
      'mode': 'sandbox',
      'paymentUrl': 'https://test-pay.khalti.example/checkout',
      'demoConfirmationRequired': false,
      'notice': 'Sandbox only - no real charge.',
    });

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: PaymentAwaitingSheet(
            intent: intent,
            checkStatus: () async => PaymentStatus.fromJson({
              'paymentId': 'payment-sandbox',
              'bookingId': 'booking-1',
              'provider': 'khalti',
              'mode': 'sandbox',
              'status': 'pending',
              'paid': false,
              'terminal': false,
              'message': 'Still waiting for Khalti.',
            }),
            openPaymentPage: () async {
              openCount += 1;
              return WalletCheckoutOutcome.returned;
            },
            pollingInterval: const Duration(days: 1),
            maxAutomaticChecks: 0,
          ),
        ),
      ),
    );

    expect(find.text('SANDBOX / TEST - NO REAL CHARGE'), findsOneWidget);
    expect(find.byKey(const Key('sandbox-payment-total')), findsOneWidget);
    expect(find.text('NPR 4,200'), findsOneWidget);
    expect(find.text('BB-SBX-123'), findsOneWidget);
    expect(find.textContaining('never asks for or stores'), findsOneWidget);

    await tester.ensureVisible(find.byKey(const Key('open-sandbox-payment')));
    await tester.tap(find.byKey(const Key('open-sandbox-payment')));
    await tester.pumpAndSettle();

    expect(openCount, 1);
    expect(
      find.textContaining('Returned from the test checkout'),
      findsOneWidget,
    );
  });

  testWidgets('a cancelled provider return never claims the payment worked', (
    tester,
  ) async {
    final intent = PaymentIntent.fromJson({
      'paymentId': 'payment-cancelled',
      'transactionRef': 'BB-SBX-CANCEL',
      'amount': 4200,
      'currency': 'NPR',
      'provider': 'esewa',
      'mode': 'sandbox',
      'paymentUrl': 'https://test-pay.khalti.example/checkout',
      'demoConfirmationRequired': false,
    });

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: PaymentAwaitingSheet(
            intent: intent,
            checkStatus: () async => PaymentStatus.fromJson({
              'paymentId': 'payment-cancelled',
              'bookingId': 'booking-1',
              'provider': 'esewa',
              'mode': 'sandbox',
              'status': 'pending',
              'paid': false,
              'terminal': false,
              'message': 'eSewa has not recorded this test payment yet.',
            }),
            openPaymentPage: () async => WalletCheckoutOutcome.cancelled,
            pollingInterval: const Duration(days: 1),
            maxAutomaticChecks: 0,
          ),
        ),
      ),
    );

    await tester.ensureVisible(find.byKey(const Key('open-sandbox-payment')));
    await tester.tap(find.byKey(const Key('open-sandbox-payment')));
    await tester.pumpAndSettle();

    expect(find.textContaining('was cancelled'), findsOneWidget);
    // The server is still the authority: a cancelled redirect leaves the sheet
    // showing the pending server status rather than a failure of its own.
    expect(find.text('Payment pending'), findsOneWidget);
  });

  testWidgets('terminal sandbox failure offers retry without a new booking', (
    tester,
  ) async {
    final intent = PaymentIntent.fromJson({
      'paymentId': 'payment-failed',
      'transactionRef': 'BB-FAIL-123',
      'amount': 4200,
      'currency': 'NPR',
      'provider': 'esewa',
      'mode': 'sandbox',
      'paymentUrl': 'https://localhost.test/payments/esewa/bridge',
      'demoConfirmationRequired': false,
    });

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: PaymentAwaitingSheet(
            intent: intent,
            checkStatus: () async => PaymentStatus.fromJson({
              'paymentId': 'payment-failed',
              'bookingId': 'booking-1',
              'provider': 'esewa',
              'mode': 'sandbox',
              'status': 'failed',
              'paid': false,
              'terminal': true,
              'message': 'The provider declined this test payment.',
            }),
            pollingInterval: const Duration(days: 1),
            maxAutomaticChecks: 0,
          ),
        ),
      ),
    );

    await tester.ensureVisible(find.byKey(const Key('check-sandbox-payment')));
    await tester.tap(find.byKey(const Key('check-sandbox-payment')));
    await tester.pumpAndSettle();

    expect(find.text('Payment failed'), findsOneWidget);
    expect(
      find.text('The provider declined this test payment.'),
      findsOneWidget,
    );
    expect(find.byKey(const Key('retry-terminal-payment')), findsOneWidget);
  });

  testWidgets('sandbox status is checked again when the app resumes', (
    tester,
  ) async {
    var checks = 0;
    final intent = PaymentIntent.fromJson({
      'paymentId': 'payment-resume',
      'transactionRef': 'BB-RESUME-123',
      'amount': 4200,
      'currency': 'NPR',
      'provider': 'khalti',
      'mode': 'sandbox',
      'paymentUrl': 'https://test-pay.khalti.example/checkout',
      'demoConfirmationRequired': false,
    });

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: PaymentAwaitingSheet(
            intent: intent,
            checkStatus: () async {
              checks += 1;
              return PaymentStatus.fromJson({
                'paymentId': 'payment-resume',
                'bookingId': 'booking-1',
                'provider': 'khalti',
                'mode': 'sandbox',
                'status': 'pending',
                'paid': false,
                'terminal': false,
                'message': 'Still pending.',
              });
            },
            pollingInterval: const Duration(days: 1),
            maxAutomaticChecks: 2,
          ),
        ),
      ),
    );
    await tester.pump();
    expect(checks, 1);

    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.hidden);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.hidden);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await tester.pump();

    expect(checks, 2);
  });
}
