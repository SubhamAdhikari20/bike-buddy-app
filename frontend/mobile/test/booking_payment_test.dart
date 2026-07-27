import 'package:bike_buddy/core/widgets/secure_badge.dart';
import 'package:bike_buddy/features/bookings/data/booking_model.dart';
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
}
