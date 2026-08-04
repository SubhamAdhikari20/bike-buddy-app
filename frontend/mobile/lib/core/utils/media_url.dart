import '../constants/app_constants.dart';

/// Rewrites the host of a Bike Buddy media URL so it is reachable from the
/// device the app is running on.
///
/// Files uploaded through the owner portal are stored with an absolute URL
/// built from the backend's own address, which in local development is
/// `http://localhost:5050`. On an Android emulator "localhost" is the
/// emulator itself, so those photos would never load. Pointing the URL at the
/// same host the app already uses for API calls fixes that without changing
/// what is stored in the database.
///
/// Only loopback hosts are rewritten. A real remote image (an Unsplash URL,
/// for example) is returned untouched.
String resolveMediaUrl(String url) {
  if (url.isEmpty) return url;

  final parsed = Uri.tryParse(url);
  if (parsed == null || !parsed.hasScheme) return url;

  const loopbackHosts = {'localhost', '127.0.0.1', '::1'};
  if (!loopbackHosts.contains(parsed.host)) return url;

  final apiBase = Uri.parse(AppConstants.baseUrl);
  if (apiBase.host == parsed.host) return url;

  return parsed
      .replace(scheme: apiBase.scheme, host: apiBase.host, port: apiBase.port)
      .toString();
}
