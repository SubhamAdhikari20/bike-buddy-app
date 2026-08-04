import 'package:flutter_test/flutter_test.dart';

import 'package:bike_buddy/core/api/api_endpoints.dart';
import 'package:bike_buddy/core/utils/media_url.dart';
import 'package:bike_buddy/features/bikes/data/bike_model.dart';

void main() {
  test('relative upload paths use the configured API origin', () {
    final apiBase = Uri.parse(ApiEndpoints.mediaServerUrl);
    final publicUrl = Uri.parse(
      resolveMediaUrl('/uploads/bike/demo/pulsar-220f-1.jpg'),
    );
    final protectedUrl = Uri.parse(
      resolveMediaUrl('/api/v1/uploads/kyc/demo-renter-id.png'),
    );

    expect(publicUrl.host, apiBase.host);
    expect(publicUrl.port, apiBase.port);
    expect(publicUrl.path, '/uploads/bike/demo/pulsar-220f-1.jpg');
    expect(protectedUrl.path, '/api/v1/uploads/kyc/demo-renter-id.png');
  });

  test('owner-uploaded photos are pointed at the host the app can reach', () {
    final apiHost = Uri.parse(ApiEndpoints.mediaServerUrl).host;
    final resolved = resolveMediaUrl(
      'http://localhost:5050/uploads/bike/photo.png',
    );

    expect(Uri.parse(resolved).host, apiHost);
    expect(Uri.parse(resolved).path, '/uploads/bike/photo.png');
  });

  test(
    'legacy Android-emulator image hosts follow the selected device host',
    () {
      final apiBase = Uri.parse(ApiEndpoints.mediaServerUrl);
      final resolved = Uri.parse(
        resolveMediaUrl('http://10.0.2.2:5050/uploads/bike/legacy.png'),
      );

      expect(resolved.host, apiBase.host);
      expect(resolved.port, apiBase.port);
      expect(resolved.path, '/uploads/bike/legacy.png');
    },
  );

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
      'location': {
        'label': 'Thamel Hub',
        'address': 'Thamel',
        'city': 'Kathmandu',
      },
    });

    final apiHost = Uri.parse(ApiEndpoints.mediaServerUrl).host;
    expect(Uri.parse(bike.imageUrls.first).host, apiHost);
    expect(bike.imageUrls.last, 'https://images.unsplash.com/photo-9?w=800');
  });
}
