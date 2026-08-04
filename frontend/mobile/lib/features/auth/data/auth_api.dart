import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/api/api_endpoints.dart';

final authApiProvider = Provider<AuthApi>(
  (ref) => AuthApi(ref.watch(apiClientProvider)),
);

class AuthApi {
  final ApiClient _client;

  AuthApi(this._client);

  Future<Map<String, dynamic>> login(String email, String password) async {
    final res = await _client.post(
      ApiEndpoints.login,
      data: {'email': email, 'password': password},
    );
    return (res['data'] as Map).cast<String, dynamic>();
  }

  Future<Map<String, dynamic>> registerRenter({
    required String fullName,
    required String email,
    String? phoneNumber,
    required String password,
    required bool terms,
  }) async {
    final res = await _client.post(
      ApiEndpoints.registerRenter,
      data: {
        'fullName': fullName,
        'email': email,
        if (phoneNumber != null && phoneNumber.isNotEmpty)
          'phoneNumber': phoneNumber,
        'password': password,
        'terms': terms,
      },
    );
    return (res['data'] as Map).cast<String, dynamic>();
  }

  Future<Map<String, dynamic>> googleRenter(String idToken) async {
    final res = await _client.post(
      ApiEndpoints.googleRenter,
      data: {'idToken': idToken, 'terms': true},
    );
    return (res['data'] as Map).cast<String, dynamic>();
  }

  Future<Map<String, dynamic>> forgotPassword(String email) async {
    final res = await _client.post(
      ApiEndpoints.forgotPassword,
      data: {'email': email},
    );
    return (res['data'] as Map).cast<String, dynamic>();
  }

  Future<void> resetPassword({
    required String email,
    required String code,
    required String password,
  }) async {
    await _client.post(
      ApiEndpoints.resetPassword,
      data: {'email': email, 'code': code, 'password': password},
    );
  }

  Future<Map<String, dynamic>> sendOtp(String email) async {
    final res = await _client.post(
      ApiEndpoints.sendOtp,
      data: {'email': email},
    );
    return (res['data'] as Map).cast<String, dynamic>();
  }

  Future<Map<String, dynamic>> verifyOtp(String email, String code) async {
    final res = await _client.post(
      ApiEndpoints.verifyOtp,
      data: {'email': email, 'code': code},
    );
    return (res['data'] as Map).cast<String, dynamic>();
  }

  Future<Map<String, dynamic>> me() async {
    final res = await _client.get(ApiEndpoints.currentUser);
    return (res['data'] as Map).cast<String, dynamic>();
  }

  Future<Map<String, dynamic>> updateProfile(
    Map<String, dynamic> payload,
  ) async {
    final res = await _client.patch(ApiEndpoints.profile, data: payload);
    return (res['data'] as Map).cast<String, dynamic>();
  }

  Future<Map<String, dynamic>> submitKyc(String idDocumentUrl) async {
    final res = await _client.post(
      ApiEndpoints.kyc,
      data: {'idDocumentUrl': idDocumentUrl},
    );
    return (res['data'] as Map).cast<String, dynamic>();
  }

  Future<Map<String, dynamic>> kycStatus() async {
    final res = await _client.get(ApiEndpoints.kyc);
    return (res['data'] as Map).cast<String, dynamic>();
  }

  Future<void> logout() async {
    await _client.post(ApiEndpoints.logout);
  }

  Future<void> deleteAccount() async {
    await _client.delete(ApiEndpoints.account);
  }
}
