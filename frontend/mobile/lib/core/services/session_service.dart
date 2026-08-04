import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

abstract interface class SessionStorage {
  Future<String?> read(String key);

  Future<void> write(String key, String value);

  Future<void> delete(String key);
}

class _FlutterSessionStorage implements SessionStorage {
  const _FlutterSessionStorage();

  static const _storage = FlutterSecureStorage();

  @override
  Future<String?> read(String key) => _storage.read(key: key);

  @override
  Future<void> write(String key, String value) =>
      _storage.write(key: key, value: value);

  @override
  Future<void> delete(String key) => _storage.delete(key: key);
}

/// Persists the auth session securely so users on a trusted device stay
/// signed in for 30 days (AUTH-04).
class SessionService {
  static SessionStorage _storage = const _FlutterSessionStorage();

  static const _kToken = 'access_token';
  static const _kUser = 'session_user';
  static String? _memoryToken;
  static Map<String, dynamic>? _memoryUser;

  static Future<void> saveSession({
    required String token,
    required Map<String, dynamic> user,
  }) async {
    final encodedUser = jsonEncode(user);
    _memoryToken = token;
    _memoryUser = Map<String, dynamic>.from(user);
    try {
      await _storage.write(_kToken, token);
      await _storage.write(_kUser, encodedUser);
    } catch (_) {
      // Avoid leaving a half-written credential pair. The complete session is
      // still usable in memory until this app process exits.
      await _discardPersistedSession();
    }
  }

  static Future<String?> get token async {
    try {
      final stored = await _storage.read(_kToken);
      if (stored != null) _memoryToken = stored;
      return stored ?? _memoryToken;
    } catch (_) {
      await _discardPersistedSession();
      return _memoryToken;
    }
  }

  static Future<Map<String, dynamic>?> get user async {
    String? raw;
    try {
      raw = await _storage.read(_kUser);
    } catch (_) {
      await _discardPersistedSession();
      return _memoryUser == null
          ? null
          : Map<String, dynamic>.from(_memoryUser!);
    }
    if (raw == null) {
      return _memoryUser == null
          ? null
          : Map<String, dynamic>.from(_memoryUser!);
    }
    try {
      final decoded = (jsonDecode(raw) as Map).cast<String, dynamic>();
      _memoryUser = decoded;
      return Map<String, dynamic>.from(decoded);
    } catch (_) {
      await _safeDelete(_kUser);
      return _memoryUser == null
          ? null
          : Map<String, dynamic>.from(_memoryUser!);
    }
  }

  static Future<void> clear() async {
    _memoryToken = null;
    _memoryUser = null;
    await _discardPersistedSession();
  }

  static Future<void> _discardPersistedSession() async {
    await _safeDelete(_kToken);
    await _safeDelete(_kUser);
  }

  static Future<void> _safeDelete(String key) async {
    try {
      await _storage.delete(key);
    } catch (_) {
      // A broken/restored keystore can also reject deletes. Never let that
      // platform failure escape into app startup or logout.
    }
  }

  @visibleForTesting
  static void debugUseStorage(SessionStorage storage) {
    _storage = storage;
    _memoryToken = null;
    _memoryUser = null;
  }

  @visibleForTesting
  static void debugResetStorage() {
    _storage = const _FlutterSessionStorage();
    _memoryToken = null;
    _memoryUser = null;
  }
}
