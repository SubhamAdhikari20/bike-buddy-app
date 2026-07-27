import 'package:bike_buddy/core/constants/app_constants.dart';
import 'package:bike_buddy/features/bookings/data/booking_model.dart';
import 'package:bike_buddy/features/support/data/support_api.dart';
import 'package:bike_buddy/features/support/presentation/support_page.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('booking model preserves return and extension evidence', () {
    final booking = Booking.fromJson({
      '_id': 'booking-1',
      'bikeId': 'bike-1',
      'startDate': '2030-01-01T10:00:00.000Z',
      'endDate': '2030-01-01T12:00:00.000Z',
      'pickupLocation': 'Thamel',
      'status': 'completed',
      'paymentStatus': 'paid',
      'paymentMode': 'demo',
      'totalAmount': 2100,
      'extensionHours': 1,
      'extensionAmount': 200,
      'lateMinutes': 18,
      'lateFeeAmount': 200,
    });

    expect(booking.extensionHours, 1);
    expect(booking.extensionAmount, 200);
    expect(booking.lateMinutes, 18);
    expect(booking.lateFeeAmount, 200);
  });

  testWidgets('support page never substitutes a fabricated phone number', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          faqProvider.overrideWith((ref) async => <({String q, String a})>[]),
        ],
        child: const MaterialApp(home: SupportPage()),
      ),
    );

    if (!AppConstants.hasSupportPhone) {
      expect(find.text('Phone unavailable'), findsOneWidget);
      expect(find.text('Not configured'), findsOneWidget);
    }
    expect(find.textContaining('emergency-response service'), findsOneWidget);
  });
}
