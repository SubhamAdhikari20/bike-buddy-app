import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../error/app_exception.dart';
import '../services/session_service.dart';
import 'api_endpoints.dart';

final apiClientProvider = Provider<ApiClient>((ref) => ApiClient());

/// Thin Dio wrapper. Attaches the bearer token when present and converts
/// every failure into a plain-language [AppException].
class ApiClient {
  late final Dio dio;

  ApiClient() {
    dio = Dio(
      BaseOptions(
        baseUrl: ApiEndpoints.baseUrl,
        connectTimeout: ApiEndpoints.connectionTimeout,
        receiveTimeout: ApiEndpoints.receiveTimeout,
        headers: {'Accept': 'application/json'},
      ),
    );

    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await SessionService.token;
          if (token != null) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
      ),
    );
  }

  Future<Map<String, dynamic>> get(
    String path, {
    Map<String, dynamic>? query,
  }) => _run(() => dio.get(path, queryParameters: query));

  Future<Map<String, dynamic>> post(String path, {Object? data}) =>
      _run(() => dio.post(path, data: data));

  Future<Map<String, dynamic>> patch(String path, {Object? data}) =>
      _run(() => dio.patch(path, data: data));

  Future<Map<String, dynamic>> delete(String path) =>
      _run(() => dio.delete(path));

  Future<Map<String, dynamic>> upload(String path, FormData formData) =>
      _run(() => dio.post(path, data: formData));

  Future<Map<String, dynamic>> _run(
    Future<Response<dynamic>> Function() request,
  ) async {
    try {
      final response = await request();
      return (response.data as Map).cast<String, dynamic>();
    } on DioException catch (e) {
      throw _toAppException(e);
    }
  }

  AppException _toAppException(DioException e) {
    final status = e.response?.statusCode;
    final data = e.response?.data;

    String? serverMessage;
    String? code;
    if (data is Map) {
      final rawMessage = data['message'];
      final rawCode = data['code'];
      if (rawMessage is String) serverMessage = rawMessage;
      if (rawCode is String) code = rawCode;
    } else if (data is String && data.trim().isNotEmpty) {
      serverMessage = data.trim();
    }

    if (status == null) {
      final endpoint = kDebugMode ? '\nServer: ${ApiEndpoints.serverUrl}' : '';
      final message = switch (e.type) {
        DioExceptionType.connectionTimeout ||
        DioExceptionType.sendTimeout ||
        DioExceptionType.receiveTimeout =>
          'Bike Buddy took too long to respond. Check that the backend is running and your device can reach it.$endpoint',
        DioExceptionType.connectionError =>
          'Could not connect to Bike Buddy. Check the selected emulator, USB-device, or LAN setup.$endpoint',
        DioExceptionType.badCertificate =>
          'Bike Buddy could not verify the server connection.',
        DioExceptionType.cancel => 'The request was cancelled.',
        _ => 'Bike Buddy could not complete the request. Please try again.',
      };
      return AppException(message);
    }

    return AppException(
      serverMessage ??
          (status == 429
              ? 'Too many requests. Please wait a moment and try again.'
              : 'Something went wrong. Please try again.'),
      statusCode: status,
      code: code,
    );
  }
}
