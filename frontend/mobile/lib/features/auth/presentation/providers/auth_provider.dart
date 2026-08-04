import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/services/session_service.dart';
import '../../../../core/services/google_auth_service.dart';
import '../../../../core/error/app_exception.dart';
import '../../data/auth_api.dart';
import '../../data/session_user.dart';

/// Global auth state. `null` means guest browsing (UI-01) — the app is
/// fully usable without an account until the user tries to book.
final authProvider = AsyncNotifierProvider<AuthNotifier, SessionUser?>(
  AuthNotifier.new,
);

class AuthNotifier extends AsyncNotifier<SessionUser?> {
  AuthApi get _api => ref.read(authApiProvider);

  @override
  Future<SessionUser?> build() async {
    // Trusted device: restore the saved session so the user lands on
    // home already signed in (AUTH-04).
    final token = await SessionService.token;
    if (token == null) return null;

    try {
      final currentSession = await _api.me();
      final user = SessionUser.fromSession(currentSession);
      if (!user.isRenter) {
        await SessionService.clear();
        return null;
      }
      await SessionService.saveSession(token: token, user: user.toJson());
      return user;
    } catch (_) {
      await SessionService.clear();
      return null;
    }
  }

  Future<void> _storeSession(Map<String, dynamic> session) async {
    final user = SessionUser.fromSession(session);
    if (!user.isRenter) {
      await SessionService.clear();
      throw const AppException(
        'Owner and administrator accounts use the Bike Buddy web portal.',
        statusCode: 403,
        code: 'MOBILE_RENTER_ONLY',
      );
    }
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

  Future<void> continueWithGoogle() async {
    final idToken = await GoogleAuthService.authenticate();
    final session = await _api.googleRenter(idToken);
    await _storeSession(session);
  }

  Future<Map<String, dynamic>> forgotPassword(String email) =>
      _api.forgotPassword(email);

  Future<void> resetPassword({
    required String email,
    required String code,
    required String password,
  }) => _api.resetPassword(email: email, code: code, password: password);

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
    await GoogleAuthService.signOut();
    state = const AsyncData(null);
  }

  Future<void> deleteAccount() async {
    await _api.deleteAccount();
    await SessionService.clear();
    state = const AsyncData(null);
  }
}
