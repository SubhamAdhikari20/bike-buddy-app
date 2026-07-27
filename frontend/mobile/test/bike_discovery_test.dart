import 'package:bike_buddy/features/bikes/data/bike_model.dart';
import 'package:bike_buddy/features/bikes/presentation/providers/bikes_provider.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('bike response exposes trust and location cues', () {
    final bike = Bike.fromJson({
      '_id': 'bike-1',
      'title': 'City commuter',
      'brand': 'Honda',
      'model': 'Shine',
      'year': 2025,
      'engineCc': 125,
      'fuelType': 'petrol',
      'transmission': 'manual',
      'condition': 'excellent',
      'pricePerDay': 1500,
      'location': {
        'label': 'Thamel pickup',
        'address': 'Tridevi Marg',
        'city': 'Kathmandu',
        'landmark': 'Near Garden of Dreams',
      },
      'images': const [],
      'status': 'available',
      'verifiedBike': true,
      'averageRating': 4.8,
      'ratingCount': 12,
      'ownerId': {
        '_id': 'owner-1',
        'fullName': 'Verified Owner',
        'ownerStatus': 'verified',
      },
    });

    expect(bike.location.landmark, 'Near Garden of Dreams');
    expect(bike.owner?.isVerified, isTrue);
    expect(bike.verifiedBike, isTrue);
  });

  test('clearing a discovery filter is explicit', () {
    const query = BikeQuery(
      search: 'Honda',
      category: 'commuter',
      city: 'Kathmandu',
    );

    final cleared = query.copyWith(search: null, category: null);
    expect(cleared.search, isNull);
    expect(cleared.category, isNull);
    expect(cleared.city, 'Kathmandu');
  });
}
