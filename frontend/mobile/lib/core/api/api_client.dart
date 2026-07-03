import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../constants/app_constants.dart';
import '../error/app_exception.dart';
import '../services/session_service.dart';

final apiClientProvider = Provider<ApiClient>((ref) => ApiClient());

/// Thin Dio wrapper. Attaches the bearer token when present and converts
/// every failure into a plain-language [AppException].
class ApiClient {
  late final Dio dio;

  ApiClient() {
    dio = Dio(
      BaseOptions(
        baseUrl: AppConstants.apiBaseUrl,
        connectTimeout: const Duration(seconds: 10),
        receiveTimeout: const Duration(seconds: 15),
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
  }) =>
      _run(() => dio.get(path, queryParameters: query));

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
      serverMessage = data['message'] as String?;
      code = data['code'] as String?;
    }

    if (status == null) {
      return const AppException(
        'Could not reach Bike Buddy. Check your internet connection and try again.',
      );
    }

    return AppException(
      serverMessage ?? 'Something went wrong. Please try again.',
      statusCode: status,
      code: code,
    );
  }
}
