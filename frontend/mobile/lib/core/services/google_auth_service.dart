import 'package:google_sign_in/google_sign_in.dart';

import '../constants/app_constants.dart';
import '../error/app_exception.dart';

/// Obtains a verifiable Google ID token. The backend verifies its signature,
/// issuer, expiry and audience before creating a renter-only Bike Buddy session.
class GoogleAuthService {
  GoogleAuthService._();

  static final GoogleSignIn _googleSignIn = GoogleSignIn.instance;
  static Future<void>? _initialization;

  static Future<void> _initialize() {
    if (AppConstants.googleServerClientId.isEmpty) {
      throw const AppException(
        'Google sign-in is not configured on this build. '
        'Add GOOGLE_SERVER_CLIENT_ID and try again.',
        code: 'GOOGLE_AUTH_NOT_CONFIGURED',
      );
    }

    return _initialization ??= _googleSignIn.initialize(
      clientId: AppConstants.googlePlatformClientId.isEmpty
          ? null
          : AppConstants.googlePlatformClientId,
      serverClientId: AppConstants.googleServerClientId,
    );
  }

  static Future<String> authenticate() async {
    await _initialize();

    if (!_googleSignIn.supportsAuthenticate()) {
      throw const AppException(
        'Google sign-in is not available on this device.',
        code: 'GOOGLE_AUTH_UNAVAILABLE',
      );
    }

    try {
      final account = await _googleSignIn.authenticate();
      final idToken = account.authentication.idToken;
      if (idToken == null || idToken.isEmpty) {
        throw const AppException(
          'Google did not return a secure sign-in token. Please try again.',
          code: 'GOOGLE_TOKEN_MISSING',
        );
      }
      return idToken;
    } on GoogleSignInException catch (error) {
      if (error.code == GoogleSignInExceptionCode.canceled) {
        throw const AppException(
          'Google sign-in was cancelled.',
          code: 'GOOGLE_AUTH_CANCELLED',
        );
      }
      throw const AppException(
        'Google sign-in could not be completed. Please try again.',
        code: 'GOOGLE_AUTH_FAILED',
      );
    }
  }

  static Future<void> signOut() async {
    if (_initialization == null) return;
    await _googleSignIn.signOut();
  }
}
