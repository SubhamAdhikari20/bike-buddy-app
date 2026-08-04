import '../constants/app_constants.dart';

/// Rewrites the host of a Bike Buddy media URL so it is reachable from the
/// device the app is running on.
///
/// New uploads are stored as portable paths such as
/// `/uploads/bike/photo.jpg`. The app resolves those paths against the same
/// host used for API calls. Legacy loopback URLs are also rewritten because
/// Android emulators cannot reach a computer's backend through `localhost`.
///
/// Only loopback hosts are rewritten. A real remote image (an Unsplash URL,
/// for example) is returned untouched.
String resolveMediaUrl(String url) {
  if (url.isEmpty) return url;

  final parsed = Uri.tryParse(url);
  if (parsed == null) return url;

  final apiBase = Uri.parse(AppConstants.baseUrl);
  if (!parsed.hasScheme) {
    if (!url.startsWith('/')) return url;
    return apiBase
        .replace(path: '', query: null, fragment: null)
        .resolve(url)
        .toString();
  }

  const loopbackHosts = {'localhost', '127.0.0.1', '::1'};
  if (!loopbackHosts.contains(parsed.host)) return url;

  if (apiBase.scheme == parsed.scheme &&
      apiBase.host == parsed.host &&
      apiBase.port == parsed.port) {
    return url;
  }

  return parsed
      .replace(scheme: apiBase.scheme, host: apiBase.host, port: apiBase.port)
      .toString();
}
