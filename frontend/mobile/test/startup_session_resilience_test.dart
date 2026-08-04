import 'dart:async';
import 'dart:convert';

import 'package:bike_buddy/core/api/api_client.dart';
import 'package:bike_buddy/core/error/app_exception.dart';
import 'package:bike_buddy/core/services/local_store.dart';
import 'package:bike_buddy/core/services/session_service.dart';
import 'package:bike_buddy/features/auth/data/auth_api.dart';
import 'package:bike_buddy/features/auth/presentation/providers/auth_provider.dart';
import 'package:bike_buddy/main.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

const _cachedRenter = {
  'user': {
    'id': 'user-1',
    'email': 'renter@example.com',
    'role': 'renter',
    'isVerified': true,
  },
  'profile': {'_id': 'renter-1', 'fullName': 'Cached Renter'},
};

class _MemorySessionStorage implements SessionStorage {
  final Map<String, String> values;
  final bool failReads;
  final bool failWrites;

  _MemorySessionStorage({
    Map<String, String>? values,
    this.failReads = false,
    this.failWrites = false,
  }) : values = values ?? {};

  @override
  Future<void> delete(String key) async {
    values.remove(key);
  }

  @override
  Future<String?> read(String key) async {
    if (failReads) throw StateError('unreadable secure storage');
    return values[key];
  }

  @override
  Future<void> write(String key, String value) async {
    if (failWrites) throw StateError('unwritable secure storage');
    values[key] = value;
  }
}

class _FailingAuthApi extends AuthApi {
  final Object failure;

  _FailingAuthApi(this.failure) : super(ApiClient());

  @override
  Future<Map<String, dynamic>> me() async => throw failure;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  tearDown(SessionService.debugResetStorage);

  testWidgets(
    'bootstrap replaces the native splash while storage initializes',
    (tester) async {
      final initialization = Completer<void>();
      await tester.pumpWidget(
        BikeBuddyBootstrap(
          initialization: initialization.future,
          app: const MaterialApp(home: Text('App ready')),
        ),
      );

      expect(find.text('Preparing Bike Buddy...'), findsOneWidget);
      initialization.complete();
      await tester.pump();
      await tester.pump();
      expect(find.text('App ready'), findsOneWidget);
    },
  );

  test('local preferences time out into a usable in-memory store', () async {
    await initializeLocalStore(
      initialize: () => Completer<void>().future,
      timeout: Duration.zero,
    );

    await LocalStore.setOnboardingSeen(true);
    await LocalStore.setThemeMode('dark');
    expect(LocalStore.onboardingSeen, isTrue);
    expect(LocalStore.themeMode, 'dark');
  });

  test(
    'unreadable secure storage is treated as a signed-out session',
    () async {
      SessionService.debugUseStorage(_MemorySessionStorage(failReads: true));

      expect(await SessionService.token, isNull);
      expect(await SessionService.user, isNull);
    },
  );

  test(
    'corrupt cached user JSON is discarded without losing the token',
    () async {
      final storage = _MemorySessionStorage(
        values: {'access_token': 'saved-token', 'session_user': '{bad json'},
      );
      SessionService.debugUseStorage(storage);

      expect(await SessionService.user, isNull);
      expect(await SessionService.token, 'saved-token');
      expect(storage.values.containsKey('session_user'), isFalse);
    },
  );

  test(
    'failed secure persistence keeps the complete session in memory',
    () async {
      final storage = _MemorySessionStorage(failWrites: true);
      SessionService.debugUseStorage(storage);

      await SessionService.saveSession(
        token: 'memory-token',
        user: _cachedRenter,
      );

      expect(await SessionService.token, 'memory-token');
      expect(await SessionService.user, _cachedRenter);
      expect(storage.values, isEmpty);
    },
  );

  test('transient API failure preserves a cached renter session', () async {
    SessionService.debugUseStorage(
      _MemorySessionStorage(
        values: {
          'access_token': 'saved-token',
          'session_user': jsonEncode(_cachedRenter),
        },
      ),
    );
    final container = ProviderContainer(
      overrides: [
        authApiProvider.overrideWithValue(
          _FailingAuthApi(const AppException('Backend unavailable')),
        ),
      ],
    );
    addTearDown(container.dispose);

    final user = await container.read(authProvider.future);
    expect(user?.fullName, 'Cached Renter');
    expect(await SessionService.token, 'saved-token');
  });

  test('an authenticated 401 clears the cached renter session', () async {
    SessionService.debugUseStorage(
      _MemorySessionStorage(
        values: {
          'access_token': 'expired-token',
          'session_user': jsonEncode(_cachedRenter),
        },
      ),
    );
    final container = ProviderContainer(
      overrides: [
        authApiProvider.overrideWithValue(
          _FailingAuthApi(const AppException('Expired', statusCode: 401)),
        ),
      ],
    );
    addTearDown(container.dispose);

    expect(await container.read(authProvider.future), isNull);
    expect(await SessionService.token, isNull);
  });
}
