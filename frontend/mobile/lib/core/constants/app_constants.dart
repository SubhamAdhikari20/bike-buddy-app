/// App-wide constants.
class AppConstants {
  AppConstants._();

  /// Backend base URL.
  /// Android emulator reaches the host machine through 10.0.2.2.
  /// Use your PC's LAN IP when running on a physical device.
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:5050',
  );
  static const String apiBaseUrl = '$baseUrl/api/v1';

  /// OAuth web client ID used as the server audience for Google ID tokens.
  /// Supply with:
  /// `flutter run --dart-define=GOOGLE_SERVER_CLIENT_ID=...apps.googleusercontent.com`
  static const String googleServerClientId = String.fromEnvironment(
    'GOOGLE_SERVER_CLIENT_ID',
  );
  static const String googlePlatformClientId = String.fromEnvironment(
    'GOOGLE_PLATFORM_CLIENT_ID',
  );

  /// Optional Bike Buddy support line. A coursework build must not display a
  /// made-up emergency number; configure a real staffed line at build time.
  static const String supportPhone = String.fromEnvironment('SUPPORT_PHONE');
  static bool get hasSupportPhone => supportPhone.trim().isNotEmpty;

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
