import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../error/app_exception.dart';
import '../services/session_service.dart';
import 'api_endpoints.dart';

final apiClientProvider = Provider<ApiClient>((ref) => ApiClient());

/// Thin Dio wrapper. Attaches the bearer token only to authenticated requests
/// and converts every failure into a plain-language [AppException].
class ApiClient {
  static const _authenticatedKey = 'bikeBuddyAuthenticatedRequest';

  /// Backoff between read retries; its length also sets the retry count.
  static const List<Duration> _readRetryDelays = [
    Duration(milliseconds: 350),
    Duration(seconds: 1),
    Duration(seconds: 2),
  ];

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
          if (options.extra[_authenticatedKey] != false) {
            final token = await SessionService.token;
            if (token != null) {
              options.headers['Authorization'] = 'Bearer $token';
            }
          }
          if (kDebugMode) {
            // Do not log query strings, request bodies, headers, or tokens.
            debugPrint(
              '[Bike Buddy API] ${options.method} '
              '${options.baseUrl}${options.path}',
            );
          }
          handler.next(options);
        },
        onResponse: (response, handler) {
          if (kDebugMode) {
            debugPrint(
              '[Bike Buddy API] ${response.statusCode} '
              '${response.requestOptions.method} '
              '${response.requestOptions.path}',
            );
          }
          handler.next(response);
        },
        onError: (error, handler) {
          if (kDebugMode) {
            debugPrint(
              '[Bike Buddy API] ${error.response?.statusCode ?? error.type.name} '
              '${error.requestOptions.method} ${error.requestOptions.path}',
            );
          }
          handler.next(error);
        },
      ),
    );
  }

  Future<Map<String, dynamic>> get(
    String path, {
    Map<String, dynamic>? query,
    bool authenticated = true,
  }) => _run(
    () =>
        dio.get(path, queryParameters: query, options: _options(authenticated)),
    retryConnectionFailure: true,
  );

  Future<Map<String, dynamic>> post(
    String path, {
    Object? data,
    bool authenticated = true,
  }) =>
      _run(() => dio.post(path, data: data, options: _options(authenticated)));

  Future<Map<String, dynamic>> patch(
    String path, {
    Object? data,
    bool authenticated = true,
  }) =>
      _run(() => dio.patch(path, data: data, options: _options(authenticated)));

  Future<Map<String, dynamic>> delete(
    String path, {
    bool authenticated = true,
  }) => _run(() => dio.delete(path, options: _options(authenticated)));

  Future<Map<String, dynamic>> upload(
    String path,
    FormData formData, {
    bool authenticated = true,
  }) => _run(
    () => dio.post(path, data: formData, options: _options(authenticated)),
  );

  Options _options(bool authenticated) =>
      Options(extra: {_authenticatedKey: authenticated});

  Future<Map<String, dynamic>> _run(
    Future<Response<dynamic>> Function() request, {
    bool retryConnectionFailure = false,
  }) async {
    final configurationError = ApiEndpoints.configurationError;
    if (configurationError != null) {
      throw AppException(configurationError, code: 'INVALID_API_BASE_URL');
    }

    // Only reads retry. A phone on Wi-Fi drops packets far more often than an
    // emulator on loopback, but replaying a booking or payment POST would
    // charge the renter twice.
    final attempts = retryConnectionFailure ? _readRetryDelays.length + 1 : 1;
    for (var attempt = 0; attempt < attempts; attempt++) {
      try {
        final response = await request();
        final data = response.data;
        if (data is! Map) {
          throw const AppException(
            'Bike Buddy received an invalid response from the server.',
            code: 'INVALID_SERVER_RESPONSE',
          );
        }
        return data.cast<String, dynamic>();
      } on DioException catch (error) {
        if (attempt + 1 < attempts && _isTransientConnectionFailure(error)) {
          await Future<void>.delayed(_readRetryDelays[attempt]);
          continue;
        }
        throw _toAppException(error);
      }
    }
    throw const AppException('Bike Buddy could not complete the request.');
  }

  bool _isTransientConnectionFailure(DioException error) =>
      switch (error.type) {
        DioExceptionType.connectionTimeout ||
        DioExceptionType.sendTimeout ||
        DioExceptionType.receiveTimeout ||
        DioExceptionType.connectionError => true,
        _ => false,
      };

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
      // Naming the address turns "it just fails" into a one-line fix: either
      // the backend is down or the phone is pointed at the wrong host.
      final endpoint = kDebugMode
          ? '\nServer: ${ApiEndpoints.serverUrl}'
                '\nOn a physical device this must be the computer\'s LAN '
                'address (ApiEndpoints.physicalDeviceHost or '
                '--dart-define=API_BASE_URL).'
          : '';
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
