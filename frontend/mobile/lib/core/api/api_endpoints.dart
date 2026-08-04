import 'package:flutter/foundation.dart';

/// Single source of truth for Bike Buddy server addresses and API paths.
///
/// Host selection:
/// - Android emulator: [androidEmulatorServerUrl] (the default on Android).
/// - iOS simulator, desktop and web: [localServerUrl].
/// - Physical Android over USB: run `adb reverse tcp:5050 tcp:5050` and pass
///   `--dart-define=API_BASE_URL=http://127.0.0.1:5050`.
/// - Physical Android/iPhone over Wi-Fi: pass the computer's reachable LAN
///   address reported by the launch helper; never commit a changing LAN IP.
///
/// A compile-time value is intentional: a phone cannot reliably discover
/// which computer on its network is running the coursework backend. Do not
/// add a source-code `isPhysicalDevice` switch; use the checked-in launch
/// profiles so device-specific addresses never become stale application code.
class ApiEndpoints {
  ApiEndpoints._();

  static const String androidEmulatorServerUrl = 'http://10.0.2.2:5050';
  static const String usbPhysicalDeviceServerUrl = 'http://127.0.0.1:5050';
  static const String localServerUrl = 'http://localhost:5050';
  static const String apiPrefix = '/api/v1';

  static const String _configuredServerUrl = String.fromEnvironment(
    'API_BASE_URL',
  );

  static String get defaultServerUrl {
    if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
      return androidEmulatorServerUrl;
    }
    return localServerUrl;
  }

  /// Returns a normalized server origin, accepting an optional trailing
  /// `/api/v1` to be forgiving of values copied from older projects.
  ///
  /// Invalid values return `null` instead of throwing during widget/provider
  /// construction. [configurationError] then lets the API client present an
  /// actionable error in the UI rather than making the app appear to crash.
  @visibleForTesting
  static String? normalizeServerOrigin(String value) {
    final selected = value.trim();
    if (selected.isEmpty) return null;

    final uri = Uri.tryParse(selected);
    if (uri == null) return null;

    try {
      // Accessing host/port validates malformed bracketed hosts; Dart URI
      // parsing otherwise permits TCP ports outside the usable range.
      final host = uri.host;
      final port = uri.hasPort ? uri.port : null;
      if (!uri.hasAuthority ||
          host.isEmpty ||
          (port != null && (port < 1 || port > 65535)) ||
          (uri.scheme != 'http' && uri.scheme != 'https') ||
          uri.userInfo.isNotEmpty ||
          uri.hasQuery ||
          uri.hasFragment) {
        return null;
      }
    } on FormatException {
      return null;
    }

    final normalizedPath = uri.path.replaceFirst(RegExp(r'/+$'), '');
    if (normalizedPath.isNotEmpty && normalizedPath != apiPrefix) return null;

    return uri
        .replace(path: '', query: null, fragment: null)
        .toString()
        .replaceFirst(RegExp(r'/+$'), '');
  }

  static String? get configurationError {
    final configured = _configuredServerUrl.trim();
    if (configured.isEmpty || normalizeServerOrigin(configured) != null) {
      return null;
    }
    return 'API_BASE_URL is invalid. Use an http(s) server origin. A trailing '
        '/api/v1 is accepted, but credentials, other paths, queries and '
        'fragments are not. Check the selected launch profile and relaunch.';
  }

  static String get serverUrl =>
      normalizeServerOrigin(_configuredServerUrl) ?? defaultServerUrl;

  static String get baseUrl => '$serverUrl$apiPrefix';
  static String get mediaServerUrl => serverUrl;
  static String get healthUrl => '$serverUrl/health';

  static const Duration connectionTimeout = Duration(seconds: 10);
  static const Duration receiveTimeout = Duration(seconds: 15);

  static String absoluteUrl(String endpoint) {
    if (!endpoint.startsWith('/')) {
      throw ArgumentError.value(endpoint, 'endpoint', 'Must start with /.');
    }
    return '$baseUrl$endpoint';
  }

  /// Accepts HTTPS wallet pages and this configured Bike Buddy server only.
  /// Loopback URLs returned by a locally configured backend are rewritten to
  /// the host the current emulator or physical device can actually reach.
  static Uri? trustedCheckoutUri(String? value) {
    var uri = Uri.tryParse(value?.trim() ?? '');
    if (uri == null || uri.userInfo.isNotEmpty) return null;

    final server = Uri.parse(serverUrl);
    if (!uri.hasAuthority && uri.path.startsWith('/')) {
      uri = server.resolveUri(uri);
    }

    const loopbackHosts = {'localhost', '127.0.0.1', '::1', '10.0.2.2'};
    if (uri.hasAuthority && loopbackHosts.contains(uri.host)) {
      uri = uri.replace(
        scheme: server.scheme,
        host: server.host,
        port: server.hasPort ? server.port : null,
      );
    }

    if (!uri.hasAuthority) return null;
    if (uri.scheme == 'https') return uri;
    if (uri.scheme == 'http' &&
        server.scheme == 'http' &&
        uri.host == server.host &&
        uri.port == server.port) {
      return uri;
    }
    return null;
  }

  static String _segment(String value) => Uri.encodeComponent(value);

  // Authentication and renter profile.
  static const String login = '/auth/login';
  static const String registerRenter = '/auth/register/renter';
  static const String googleRenter = '/auth/google/renter';
  static const String forgotPassword = '/auth/forgot-password';
  static const String resetPassword = '/auth/reset-password';
  static const String sendOtp = '/auth/send-otp';
  static const String verifyOtp = '/auth/verify-otp';
  static const String currentUser = '/auth/me';
  static const String profile = '/auth/profile';
  static const String kyc = '/auth/kyc';
  static const String logout = '/auth/logout';
  static const String account = '/auth/account';

  // Bike discovery.
  static const String bikes = '/bikes';
  static const String compareBikes = '/bikes/compare';
  static String bike(String bikeId) => '/bikes/${_segment(bikeId)}';

  // Bookings, handover and returns.
  static const String bookings = '/bookings';
  static const String bookingQuote = '/bookings/quote';
  static String booking(String bookingId) => '/bookings/${_segment(bookingId)}';
  static String bookingAvailability(String bikeId) =>
      '/bookings/availability/${_segment(bikeId)}';
  static String cancelBooking(String bookingId) =>
      '${booking(bookingId)}/cancel';
  static String confirmCashBooking(String bookingId) =>
      '${booking(bookingId)}/confirm-cash';
  static String cancellationPolicy(String bookingId) =>
      '${booking(bookingId)}/cancellation-policy';
  static String rescheduleBooking(String bookingId) =>
      '${booking(bookingId)}/reschedule';
  static String bookingChecklist(String bookingId) =>
      '${booking(bookingId)}/checklist';
  static String bookingReturnPreview(String bookingId) =>
      '${booking(bookingId)}/return-preview';
  static String extendBooking(String bookingId) =>
      '${booking(bookingId)}/extend';
  static String returnBooking(String bookingId) =>
      '${booking(bookingId)}/return';
  static String bookingReceipt(String bookingId) =>
      '${booking(bookingId)}/receipt.pdf';
  static String bookingReceiptUrl(String bookingId) =>
      absoluteUrl(bookingReceipt(bookingId));

  // Sandbox wallets.
  static const String initiatePayment = '/payments/initiate';
  static String paymentStatus(String paymentId) =>
      '/payments/${_segment(paymentId)}/status';
  static String confirmDemoPayment(String paymentId) =>
      '/payments/${_segment(paymentId)}/demo-confirm';

  // Reviews and ride safety.
  static const String reviews = '/reviews';
  static String reviewsForBike(String bikeId) =>
      '/reviews/bike/${_segment(bikeId)}';
  static const String damageReports = '/safety/damage-reports';
  static const String myDamageReports = '/safety/damage-reports/mine';
  static const String sos = '/safety/sos';

  // Manual live notifications (SSE).
  static const String notifications = '/notifications';
  static const String markAllNotificationsRead = '/notifications/read-all';
  static const String notificationStream = '/notifications/stream';
  static String markNotificationRead(String notificationId) =>
      '/notifications/${_segment(notificationId)}/read';

  // Support.
  static const String faq = '/support/faq';
  static const String supportTickets = '/support/tickets';
  static const String mySupportTickets = '/support/tickets/mine';
  static String rateSupportTicket(String ticketId) =>
      '/support/tickets/${_segment(ticketId)}/rate';

  // Multer uploads. Public bike/profile paths returned by the backend resolve
  // against [mediaServerUrl]; protected KYC/evidence paths stay under API v1.
  static const String uploadProfile = '/uploads/profile';
  static const String uploadKyc = '/uploads/kyc';
  static const String uploadEvidence = '/uploads/evidence';
  static const String uploadBike = '/uploads/bike';
  static String upload(String kind) => switch (kind) {
    'profile' => uploadProfile,
    'kyc' => uploadKyc,
    'evidence' => uploadEvidence,
    'bike' => uploadBike,
    _ => throw ArgumentError.value(kind, 'kind', 'Unknown upload kind.'),
  };

  static const String publicProfileMediaPrefix = '/uploads/profile';
  static const String publicBikeMediaPrefix = '/uploads/bike';
  static String protectedKycMedia(String filename) =>
      '/uploads/kyc/${_segment(filename)}';
  static String protectedEvidenceMedia(String filename) =>
      '/uploads/evidence/${_segment(filename)}';
}
