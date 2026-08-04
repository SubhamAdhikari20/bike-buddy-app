import 'package:bike_buddy/core/utils/open_street_map.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('uses the official OSM tiles with an identifiable app user agent', () {
    expect(
      OpenStreetMapConfig.tileUrl,
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    );
    expect(OpenStreetMapConfig.userAgentPackageName, 'com.subham.bike_buddy');
  });

  test('builds an OSM destination link without implying a local route', () {
    final uri = OpenStreetMapConfig.destinationUri(
      latitude: 27.7172,
      longitude: 85.324,
    );

    expect(uri.scheme, 'https');
    expect(uri.host, 'www.openstreetmap.org');
    expect(uri.path, '/directions');
    expect(uri.queryParameters['to'], '27.717200,85.324000');
    expect(uri.fragment, 'map=17/27.717200/85.324000');
  });
}
