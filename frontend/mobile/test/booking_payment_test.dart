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
}
