import 'package:bike_buddy/app/theme/app_theme.dart';
import 'package:bike_buddy/core/api/api_client.dart';
import 'package:bike_buddy/features/bikes/data/bike_model.dart';
import 'package:bike_buddy/features/bikes/presentation/pages/bike_detail_page.dart';
import 'package:bike_buddy/features/bikes/presentation/providers/bikes_provider.dart';
import 'package:bike_buddy/features/bookings/data/booking_api.dart';
import 'package:bike_buddy/features/reviews/data/review_api.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  for (final config in const [
    (size: Size(320, 700), textScale: 1.0),
    (size: Size(390, 844), textScale: 1.3),
  ]) {
    testWidgets('bike details remain visible and responsive at '
        '${config.size.width.toInt()} px and ${config.textScale}x text', (
      tester,
    ) async {
      await tester.binding.setSurfaceSize(config.size);
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            bikeDetailProvider.overrideWith((ref, bikeId) async {
              expect(bikeId, _bike.id);
              return _bike;
            }),
            bikeReviewsProvider.overrideWith((ref, bikeId) async => const []),
            bookingApiProvider.overrideWithValue(_StubBookingApi()),
          ],
          child: MaterialApp(
            theme: AppTheme.light(),
            builder: (context, child) => MediaQuery(
              data: MediaQuery.of(
                context,
              ).copyWith(textScaler: TextScaler.linear(config.textScale)),
              child: child!,
            ),
            home: const BikeDetailPage(bikeId: 'bike-1'),
          ),
        ),
      );

      await tester.pump();

      final detailsList = find.byKey(const ValueKey('bike-details-list'));
        final detailsScroll = find.descendant(
          of: detailsList,
          matching: find.byType(Scrollable),
        ).first;
      final actionBar = find.byKey(const ValueKey('bike-booking-action-bar'));

      expect(tester.takeException(), isNull);
      expect(tester.getSize(detailsList).height, greaterThan(200));
      expect(tester.getSize(actionBar).height, lessThan(140));
      expect(find.text('Honda CB Hornet 160R'), findsOneWidget);
      expect(
        find.text('Thamel pickup point\nTridevi Marg, Kathmandu'),
        findsOneWidget,
      );
      expect(find.text('Bike verified'), findsOneWidget);
      expect(find.text('Safety 94/100'), findsOneWidget);
      expect(find.text('Book Now'), findsOneWidget);

      final titleTop = tester.getTopLeft(find.text('Honda CB Hornet 160R')).dy;
      final actionTop = tester.getTopLeft(find.text('Book Now')).dy;
      expect(titleTop, lessThan(actionTop));

      for (final section in const [
        'Pricing',
        'Specifications',
        'Trust & condition',
        'Damage & Dispute Policy',
        'Reviews',
      ]) {
        await tester.scrollUntilVisible(
          find.text(section),
          260,
          scrollable: detailsScroll,
        );
        expect(find.text(section), findsOneWidget);
        expect(tester.takeException(), isNull);
      }
    });
  }

  test('bike model keeps inspection data and dated condition photos', () {
    final bike = Bike.fromJson({
      '_id': 'bike-1',
      'title': 'Demo bike',
      'verifiedBike': true,
      'safetyScore': 94,
      'inspectionNotes': '  Brakes and lights checked.  ',
      'images': [
        {'url': '/uploads/bike/primary.jpg'},
      ],
      'conditionInfo': {
        'photos': [
          {
            'url': '/uploads/bike/primary.jpg',
            'takenAt': '2026-08-01T06:00:00.000Z',
          },
          {
            'url': '/uploads/bike/condition.jpg',
            'takenAt': '2026-08-02T06:00:00.000Z',
          },
        ],
      },
    });

    expect(bike.safetyScore, 94);
    expect(bike.inspectionNotes, 'Brakes and lights checked.');
    expect(bike.conditionPhotos, hasLength(2));
    expect(bike.imageUrls, hasLength(2));
    expect(bike.imageUrls.last, endsWith('/uploads/bike/condition.jpg'));
  });
}

const _bike = Bike(
  id: 'bike-1',
  title: 'Honda CB Hornet 160R',
  brand: 'Honda',
  model: 'CB Hornet 160R',
  year: 2021,
  engineCc: 162,
  fuelType: 'petrol',
  transmission: 'manual',
  condition: 'excellent',
  description: 'A comfortable city bike with complete service history.',
  pricePerDay: 1800,
  pricePerHour: 300,
  location: BikeLocation(
    label: 'Thamel pickup point',
    address: 'Tridevi Marg',
    city: 'Kathmandu',
    landmark: 'Near Garden of Dreams',
    latitude: 27.7149,
    longitude: 85.3123,
  ),
  imageUrls: [],
  status: 'available',
  verifiedBike: true,
  safetyScore: 94,
  inspectionNotes: 'Brakes, lights and documents checked.',
  averageRating: 4.8,
  ratingCount: 12,
  category: 'street',
  securityDeposit: 3000,
  owner: BikeOwner(
    id: 'owner-1',
    fullName: 'Demo Owner',
    ownerStatus: 'verified',
  ),
  helmetIncluded: true,
);

class _StubBookingApi extends BookingApi {
  _StubBookingApi() : super(ApiClient());

  @override
  Future<Map<String, dynamic>> availability(String bikeId) async => {
    'availableNow': true,
  };
}
