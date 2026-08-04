import 'package:flutter_test/flutter_test.dart';

import 'package:bike_buddy/core/constants/app_constants.dart';
import 'package:bike_buddy/core/utils/media_url.dart';
import 'package:bike_buddy/features/bikes/data/bike_model.dart';

void main() {
  test('owner-uploaded photos are pointed at the host the app can reach', () {
    final apiHost = Uri.parse(AppConstants.baseUrl).host;
    final resolved = resolveMediaUrl(
      'http://localhost:5050/uploads/bike/photo.png',
    );

    expect(Uri.parse(resolved).host, apiHost);
    expect(Uri.parse(resolved).path, '/uploads/bike/photo.png');
  });

  test('remote images and empty values are left alone', () {
    const remote = 'https://images.unsplash.com/photo-123?w=1200';
    expect(resolveMediaUrl(remote), remote);
    expect(resolveMediaUrl(''), '');
    expect(resolveMediaUrl('not a url'), 'not a url');
  });

  test('bike json runs its image urls through the same rule', () {
    final bike = Bike.fromJson({
      '_id': 'bike1',
      'title': 'Honda Dio',
      'pricePerDay': 950,
      'images': [
        {'url': 'http://localhost:5050/uploads/bike/one.png'},
        {'url': 'https://images.unsplash.com/photo-9?w=800'},
      ],
      'location': {'label': 'Thamel Hub', 'address': 'Thamel', 'city': 'Kathmandu'},
    });

    final apiHost = Uri.parse(AppConstants.baseUrl).host;
    expect(Uri.parse(bike.imageUrls.first).host, apiHost);
    expect(bike.imageUrls.last, 'https://images.unsplash.com/photo-9?w=800');
  });
}
