import 'package:flutter_test/flutter_test.dart';

import 'package:bike_buddy/features/bikes/data/bike_model.dart';

void main() {
  test('Bike model parses backend json', () {
    final bike = Bike.fromJson({
      '_id': 'abc123',
      'title': 'Honda Shine 125',
      'brand': 'Honda',
      'model': 'Shine',
      'year': 2022,
      'engineCc': 125,
      'fuelType': 'petrol',
      'transmission': 'manual',
      'condition': 'good',
      'pricePerDay': 800,
      'location': {
        'label': 'Thamel Hub',
        'address': 'Thamel Marg',
        'city': 'Kathmandu',
        'latitude': 27.7154,
        'longitude': 85.3123,
      },
      'images': [
        {'url': 'http://example.com/bike.jpg'}
      ],
      'status': 'available',
      'verifiedBike': true,
      'averageRating': 4.5,
      'ratingCount': 12,
      'distanceKm': 0.8,
    });

    expect(bike.id, 'abc123');
    expect(bike.isAvailable, true);
    expect(bike.verifiedBike, true);
    expect(bike.imageUrls.length, 1);
    expect(bike.distanceKm, 0.8);
    expect(bike.location.city, 'Kathmandu');
  });
}
