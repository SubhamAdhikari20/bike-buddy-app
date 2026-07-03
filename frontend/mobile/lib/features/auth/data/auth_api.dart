import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';

final authApiProvider = Provider<AuthApi>(
  (ref) => AuthApi(ref.watch(apiClientProvider)),
);

class AuthApi {
  final ApiClient _client;

  AuthApi(this._client);

  Future<Map<String, dynamic>> login(String email, String password) async {
    final res = await _client.post('/auth/login', data: {
      'email': email,
      'password': password,
    });
    return (res['data'] as Map).cast<String, dynamic>();
  }

  Future<Map<String, dynamic>> registerRenter({
    required String fullName,
    required String email,
    String? phoneNumber,
    required String password,
    required bool terms,
  }) async {
    final res = await _client.post('/auth/register/renter', data: {
      'fullName': fullName,
      'email': email,
      if (phoneNumber != null && phoneNumber.isNotEmpty) 'phoneNumber': phoneNumber,
      'password': password,
      'terms': terms,
    });
    return (res['data'] as Map).cast<String, dynamic>();
  }

  Future<Map<String, dynamic>> sendOtp(String email) async {
    final res = await _client.post('/auth/send-otp', data: {'email': email});
    return (res['data'] as Map).cast<String, dynamic>();
  }

  Future<Map<String, dynamic>> verifyOtp(String email, String code) async {
    final res = await _client.post('/auth/verify-otp', data: {
      'email': email,
      'code': code,
    });
    return (res['data'] as Map).cast<String, dynamic>();
  }

  Future<Map<String, dynamic>> me() async {
    final res = await _client.get('/auth/me');
    return (res['data'] as Map).cast<String, dynamic>();
  }

  Future<Map<String, dynamic>> updateProfile(Map<String, dynamic> payload) async {
    final res = await _client.patch('/auth/profile', data: payload);
    return (res['data'] as Map).cast<String, dynamic>();
  }

  Future<String> uploadImage(String filePath) async {
    final formData = FormData.fromMap({
      'file': await MultipartFile.fromFile(filePath),
    });
    final res = await _client.upload('/uploads', formData);
    final data = (res['data'] as Map).cast<String, dynamic>();
    return data['url'] as String;
  }

  Future<Map<String, dynamic>> submitKyc(String idDocumentUrl) async {
    final res = await _client.post('/auth/kyc', data: {
      'idDocumentUrl': idDocumentUrl,
    });
    return (res['data'] as Map).cast<String, dynamic>();
  }

  Future<Map<String, dynamic>> kycStatus() async {
    final res = await _client.get('/auth/kyc');
    return (res['data'] as Map).cast<String, dynamic>();
  }

  Future<void> logout() async {
    await _client.post('/auth/logout');
  }

  Future<void> deleteAccount() async {
    await _client.delete('/auth/account');
  }
}
