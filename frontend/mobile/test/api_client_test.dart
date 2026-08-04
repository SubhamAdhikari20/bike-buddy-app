import 'dart:convert';
import 'dart:typed_data';

import 'package:bike_buddy/core/api/api_client.dart';
import 'package:bike_buddy/core/error/app_exception.dart';
import 'package:bike_buddy/core/services/session_service.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

class _MemorySessionStorage implements SessionStorage {
  final Map<String, String> values;
  int reads = 0;

  _MemorySessionStorage([Map<String, String>? values]) : values = values ?? {};

  @override
  Future<void> delete(String key) async => values.remove(key);

  @override
  Future<String?> read(String key) async {
    reads += 1;
    return values[key];
  }

  @override
  Future<void> write(String key, String value) async => values[key] = value;
}

class _StubAdapter implements HttpClientAdapter {
  final Future<ResponseBody> Function(RequestOptions options, int attempt)
  respond;
  int attempts = 0;
  final List<RequestOptions> requests = [];

  _StubAdapter(this.respond);

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) {
    requests.add(options);
    attempts += 1;
    return respond(options, attempts);
  }

  @override
  void close({bool force = false}) {}
}

ResponseBody _jsonResponse([Map<String, dynamic>? body]) =>
    ResponseBody.fromString(
      jsonEncode(body ?? const {'data': <String, dynamic>{}}),
      200,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );

void main() {
  tearDown(SessionService.debugResetStorage);

  test(
    'public requests neither read nor attach the saved bearer token',
    () async {
      final storage = _MemorySessionStorage({'access_token': 'secret-token'});
      SessionService.debugUseStorage(storage);
      final adapter = _StubAdapter((_, _) async => _jsonResponse());
      final client = ApiClient()..dio.httpClientAdapter = adapter;

      await client.get('/public', authenticated: false);

      expect(storage.reads, 0);
      expect(adapter.requests.single.headers['Authorization'], isNull);
    },
  );

  test('authenticated requests attach the saved bearer token', () async {
    final storage = _MemorySessionStorage({'access_token': 'secret-token'});
    SessionService.debugUseStorage(storage);
    final adapter = _StubAdapter((_, _) async => _jsonResponse());
    final client = ApiClient()..dio.httpClientAdapter = adapter;

    await client.get('/private');

    expect(storage.reads, 1);
    expect(
      adapter.requests.single.headers['Authorization'],
      'Bearer secret-token',
    );
  });

  test('GET retries one transient connection failure', () async {
    SessionService.debugUseStorage(_MemorySessionStorage());
    final adapter = _StubAdapter((options, attempt) async {
      if (attempt == 1) {
        throw DioException(
          requestOptions: options,
          type: DioExceptionType.connectionError,
          error: StateError('temporarily unavailable'),
        );
      }
      return _jsonResponse();
    });
    final client = ApiClient()..dio.httpClientAdapter = adapter;

    await client.get('/bikes', authenticated: false);

    expect(adapter.attempts, 2);
  });

  test('POST does not retry a connection failure', () async {
    SessionService.debugUseStorage(_MemorySessionStorage());
    final adapter = _StubAdapter((options, _) async {
      throw DioException(
        requestOptions: options,
        type: DioExceptionType.connectionError,
        error: StateError('unavailable'),
      );
    });
    final client = ApiClient()..dio.httpClientAdapter = adapter;

    await expectLater(
      client.post('/bookings', authenticated: false),
      throwsA(isA<AppException>()),
    );
    expect(adapter.attempts, 1);
  });
}
