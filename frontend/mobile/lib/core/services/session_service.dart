import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Persists the auth session securely so users on a trusted device stay
/// signed in for 30 days (AUTH-04).
class SessionService {
  static const _storage = FlutterSecureStorage();

  static const _kToken = 'access_token';
  static const _kUser = 'session_user';

  static Future<void> saveSession({
    required String token,
    required Map<String, dynamic> user,
  }) async {
    await _storage.write(key: _kToken, value: token);
    await _storage.write(key: _kUser, value: jsonEncode(user));
  }

  static Future<String?> get token => _storage.read(key: _kToken);

  static Future<Map<String, dynamic>?> get user async {
    final raw = await _storage.read(key: _kUser);
    if (raw == null) return null;
    try {
      return jsonDecode(raw) as Map<String, dynamic>;
    } catch (_) {
      return null;
    }
  }

  static Future<void> clear() async {
    await _storage.delete(key: _kToken);
    await _storage.delete(key: _kUser);
  }
}
