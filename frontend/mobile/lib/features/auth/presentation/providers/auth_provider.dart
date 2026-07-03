import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/services/session_service.dart';
import '../../data/auth_api.dart';
import '../../data/session_user.dart';

/// Global auth state. `null` means guest browsing (UI-01) — the app is
/// fully usable without an account until the user tries to book.
final authProvider =
    AsyncNotifierProvider<AuthNotifier, SessionUser?>(AuthNotifier.new);

class AuthNotifier extends AsyncNotifier<SessionUser?> {
  AuthApi get _api => ref.read(authApiProvider);

  @override
  Future<SessionUser?> build() async {
    // Trusted device: restore the saved session so the user lands on
    // home already signed in (AUTH-04).
    final token = await SessionService.token;
    if (token == null) return null;

    final saved = await SessionService.user;
    if (saved == null) return null;
    return SessionUser.fromSession(saved);
  }

  Future<void> _storeSession(Map<String, dynamic> session) async {
    final user = SessionUser.fromSession(session);
    await SessionService.saveSession(
      token: session['token'] as String,
      user: user.toJson(),
    );
    state = AsyncData(user);
  }

  Future<void> loginWithPassword(String email, String password) async {
    final session = await _api.login(email, password);
    await _storeSession(session);
  }

  Future<Map<String, dynamic>> sendOtp(String email) => _api.sendOtp(email);

  Future<void> verifyOtp(String email, String code) async {
    final session = await _api.verifyOtp(email, code);
    await _storeSession(session);
  }

  Future<void> registerRenter({
    required String fullName,
    required String email,
    String? phoneNumber,
    required String password,
  }) async {
    final session = await _api.registerRenter(
      fullName: fullName,
      email: email,
      phoneNumber: phoneNumber,
      password: password,
      terms: true,
    );
    await _storeSession(session);
  }

  /// Re-fetches the profile from the server (e.g. after editing).
  Future<void> refresh() async {
    final me = await _api.me();
    final current = state.valueOrNull;
    if (current == null) return;
    final token = await SessionService.token;
    if (token == null) return;
    final user = SessionUser.fromSession(me);
    await SessionService.saveSession(token: token, user: user.toJson());
    state = AsyncData(user);
  }

  Future<void> updateProfile(Map<String, dynamic> payload) async {
    await _api.updateProfile(payload);
    await refresh();
  }

  Future<String> uploadImage(String filePath) => _api.uploadImage(filePath);

  Future<Map<String, dynamic>> submitKyc(String idDocumentUrl) async {
    final result = await _api.submitKyc(idDocumentUrl);
    await refresh();
    return result;
  }

  Future<void> logout() async {
    try {
      await _api.logout();
    } catch (_) {
      // Even if the server call fails we still clear the local session.
    }
    await SessionService.clear();
    state = const AsyncData(null);
  }

  Future<void> deleteAccount() async {
    await _api.deleteAccount();
    await SessionService.clear();
    state = const AsyncData(null);
  }
}
