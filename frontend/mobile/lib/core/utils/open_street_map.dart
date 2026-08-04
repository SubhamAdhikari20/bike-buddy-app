/// Configuration and links for Bike Buddy's OpenStreetMap demo maps.
class OpenStreetMapConfig {
  OpenStreetMapConfig._();

  /// The community tile service is suitable for this low-traffic coursework
  /// demo. It can be replaced at build time without changing app code.
  static const String tileUrl = String.fromEnvironment(
    'OSM_TILE_URL',
    defaultValue: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  );

  /// Required identification for native requests to the public OSM server.
  static const String userAgentPackageName = 'com.subham.bike_buddy';

  static const String attributionUrl =
      'https://www.openstreetmap.org/copyright';

  /// Opens the selected pickup point in OSM's directions screen. OSM asks the
  /// renter for an origin; Bike Buddy never claims its straight guide line is
  /// a calculated walking route.
  static Uri destinationUri({
    required double latitude,
    required double longitude,
  }) {
    final lat = latitude.toStringAsFixed(6);
    final lng = longitude.toStringAsFixed(6);
    return Uri(
      scheme: 'https',
      host: 'www.openstreetmap.org',
      path: '/directions',
      queryParameters: {'to': '$lat,$lng'},
      fragment: 'map=17/$lat/$lng',
    );
  }
}
