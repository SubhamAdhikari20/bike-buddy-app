/// App-wide constants.
class AppConstants {
  AppConstants._();

  /// Backend base URL.
  /// Android emulator reaches the host machine through 10.0.2.2.
  /// Use your PC's LAN IP when running on a physical device.
  static const String baseUrl = 'http://10.0.2.2:5050';
  static const String apiBaseUrl = '$baseUrl/api/v1';

  /// 24/7 support line shown across the app (SUP-03).
  static const String supportPhone = '+977-9800000000';

  /// Session lifetime on a trusted device (AUTH-04).
  static const int trustedDeviceDays = 30;

  /// A booking draft older than this is discarded (UI-06).
  static const int bookingDraftMinutes = 30;

  /// Default map centre: Kathmandu, used when location is unavailable.
  static const double defaultLat = 27.7172;
  static const double defaultLng = 85.3240;

  /// Default nearby search radius in km (MAP-05).
  static const double defaultRadiusKm = 5;
}
