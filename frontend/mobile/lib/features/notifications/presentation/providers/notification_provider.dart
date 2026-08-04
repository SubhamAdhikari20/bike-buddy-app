import 'dart:async';
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/services/local_store.dart';
import '../../../auth/data/session_user.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
import '../../data/notification_api.dart';
import '../../data/notification_model.dart';
import '../../data/sse_parser.dart';

enum NotificationConnectionStatus { idle, connecting, live, reconnecting }

class LiveNotificationEvent {
  final int serial;
  final BikeBuddyNotification notification;

  const LiveNotificationEvent(this.serial, this.notification);
}

class NotificationState {
  final List<BikeBuddyNotification> items;
  final int unreadCount;
  final NotificationConnectionStatus connectionStatus;
  final bool initialLoading;
  final bool refreshing;
  final bool loadingMore;
  final bool markingAllRead;
  final Set<String> pendingReadIds;
  final bool hasMore;
  final String? error;
  final LiveNotificationEvent? liveEvent;

  const NotificationState({
    this.items = const [],
    this.unreadCount = 0,
    this.connectionStatus = NotificationConnectionStatus.idle,
    this.initialLoading = false,
    this.refreshing = false,
    this.loadingMore = false,
    this.markingAllRead = false,
    this.pendingReadIds = const {},
    this.hasMore = false,
    this.error,
    this.liveEvent,
  });

  NotificationState copyWith({
    List<BikeBuddyNotification>? items,
    int? unreadCount,
    NotificationConnectionStatus? connectionStatus,
    bool? initialLoading,
    bool? refreshing,
    bool? loadingMore,
    bool? markingAllRead,
    Set<String>? pendingReadIds,
    bool? hasMore,
    String? error,
    bool clearError = false,
    LiveNotificationEvent? liveEvent,
  }) {
    return NotificationState(
      items: items ?? this.items,
      unreadCount: unreadCount ?? this.unreadCount,
      connectionStatus: connectionStatus ?? this.connectionStatus,
      initialLoading: initialLoading ?? this.initialLoading,
      refreshing: refreshing ?? this.refreshing,
      loadingMore: loadingMore ?? this.loadingMore,
      markingAllRead: markingAllRead ?? this.markingAllRead,
      pendingReadIds: pendingReadIds ?? this.pendingReadIds,
      hasMore: hasMore ?? this.hasMore,
      error: clearError ? null : error ?? this.error,
      liveEvent: liveEvent ?? this.liveEvent,
    );
  }
}

final notificationProvider =
    NotifierProvider<NotificationNotifier, NotificationState>(
      NotificationNotifier.new,
    );

class NotificationNotifier extends Notifier<NotificationState>
    with WidgetsBindingObserver {
  NotificationApi get _api => ref.read(notificationApiProvider);

  String? _userId;
  int _lastSequence = 0;
  int? _nextCursor;
  int _generation = 0;
  int _streamSerial = 0;
  int _liveEventSerial = 0;
  bool _foreground = true;
  bool _streamReady = false;
  bool _disposed = false;
  CancelToken? _cancelToken;

  @override
  NotificationState build() {
    WidgetsBinding.instance.addObserver(this);
    ref.onDispose(() {
      _disposed = true;
      WidgetsBinding.instance.removeObserver(this);
      _cancelStream();
    });
    ref.listen<AsyncValue<SessionUser?>>(authProvider, (previous, next) {
      unawaited(_switchUser(next.valueOrNull));
    });
    scheduleMicrotask(() => _switchUser(ref.read(authProvider).valueOrNull));
    return const NotificationState();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _foreground = true;
      unawaited(_resume());
      return;
    }
    if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.hidden ||
        state == AppLifecycleState.detached) {
      _foreground = false;
      _streamReady = false;
      _cancelStream();
      this.state = this.state.copyWith(
        connectionStatus: NotificationConnectionStatus.idle,
      );
    }
  }

  Future<void> _switchUser(SessionUser? user) async {
    final nextUserId = user?.isRenter == true ? user!.id : null;
    if (_userId == nextUserId) return;

    _generation += 1;
    final generation = _generation;
    _cancelStream();
    _userId = nextUserId;
    _lastSequence = nextUserId == null
        ? 0
        : LocalStore.notificationLastSequence(nextUserId) ?? 0;
    _nextCursor = null;
    state = nextUserId == null
        ? const NotificationState()
        : NotificationState(
            initialLoading: true,
            connectionStatus: _foreground
                ? NotificationConnectionStatus.connecting
                : NotificationConnectionStatus.idle,
          );
    if (nextUserId == null) return;

    await _refreshFirstPage(generation, initial: true);
    if (_isActive(generation) && _foreground) _startStream(generation);
  }

  Future<void> _resume() async {
    if (_userId == null) return;
    final generation = _generation;
    state = state.copyWith(
      connectionStatus: NotificationConnectionStatus.connecting,
    );
    await _refreshFirstPage(generation);
    if (_isActive(generation)) _startStream(generation);
  }

  bool _isActive(int generation, [int? streamSerial]) {
    return !_disposed &&
        generation == _generation &&
        _userId != null &&
        _foreground &&
        (streamSerial == null || streamSerial == _streamSerial);
  }

  void _cancelStream() {
    _streamSerial += 1;
    _cancelToken?.cancel('Notification stream closed');
    _cancelToken = null;
  }

  void _startStream(int generation) {
    _cancelStream();
    final serial = _streamSerial;
    unawaited(_runStream(generation, serial));
  }

  Future<void> _runStream(int generation, int streamSerial) async {
    var attempt = 0;
    while (_isActive(generation, streamSerial)) {
      _streamReady = false;
      state = state.copyWith(
        connectionStatus: attempt == 0
            ? NotificationConnectionStatus.connecting
            : NotificationConnectionStatus.reconnecting,
      );
      final token = CancelToken();
      _cancelToken = token;
      try {
        await for (final event in _api.stream(
          after: _lastSequence,
          cancelToken: token,
        )) {
          if (!_isActive(generation, streamSerial)) return;
          await _handleEvent(event, generation, streamSerial);
        }
        if (!_isActive(generation, streamSerial) || token.isCancelled) return;
      } catch (error) {
        if (!_isActive(generation, streamSerial) || token.isCancelled) return;
        state = state.copyWith(error: _messageFor(error));
      }

      attempt += 1;
      state = state.copyWith(
        connectionStatus: NotificationConnectionStatus.reconnecting,
      );
      final delaySeconds = (1 << attempt.clamp(0, 4)).clamp(2, 15).toInt();
      await Future<void>.delayed(Duration(seconds: delaySeconds));
    }
  }

  Future<void> _handleEvent(
    SseEvent event,
    int generation,
    int streamSerial,
  ) async {
    final decoded = _decodeObject(event.data);
    if (decoded == null) return;

    if (event.event == 'notification') {
      final notification = BikeBuddyNotification.fromJson(decoded);
      if (notification.id.isEmpty || notification.sequence <= 0) return;
      final known = state.items.any((item) => item.id == notification.id);
      _merge([notification]);
      await _rememberSequence(notification.sequence);
      if (!_isActive(generation, streamSerial)) return;
      if (_streamReady && !known && !notification.isRead) {
        _liveEventSerial += 1;
        state = state.copyWith(
          unreadCount: state.unreadCount + 1,
          liveEvent: LiveNotificationEvent(_liveEventSerial, notification),
        );
      }
      return;
    }

    if (event.event == 'resync') {
      _streamReady = false;
      state = state.copyWith(
        connectionStatus: NotificationConnectionStatus.reconnecting,
      );
      await _refreshFirstPage(generation);
      return;
    }

    if (event.event == 'ready') {
      final unread = (decoded['unreadCount'] as num?)?.toInt();
      final latest = (decoded['latestSequence'] as num?)?.toInt() ?? 0;
      if (latest > _lastSequence) await _refreshFirstPage(generation);
      if (!_isActive(generation, streamSerial)) return;
      _streamReady = true;
      state = state.copyWith(
        unreadCount: unread?.clamp(0, 0x7fffffff).toInt(),
        connectionStatus: NotificationConnectionStatus.live,
        clearError: true,
      );
    }
  }

  Map<String, dynamic>? _decodeObject(String raw) {
    try {
      final value = jsonDecode(raw);
      return value is Map ? value.cast<String, dynamic>() : null;
    } catch (_) {
      return null;
    }
  }

  void _merge(Iterable<BikeBuddyNotification> incoming) {
    final byId = <String, BikeBuddyNotification>{
      for (final item in state.items) item.id: item,
    };
    for (final item in incoming) {
      byId[item.id] = item;
    }
    final items = byId.values.toList()
      ..sort((left, right) => right.sequence.compareTo(left.sequence));
    state = state.copyWith(items: List.unmodifiable(items));
  }

  Future<void> _rememberSequence(int sequence) async {
    if (sequence <= _lastSequence) return;
    _lastSequence = sequence;
    final userId = _userId;
    if (userId != null) {
      await LocalStore.setNotificationLastSequence(userId, sequence);
    }
  }

  Future<void> _refreshFirstPage(int generation, {bool initial = false}) async {
    try {
      final page = await _api.list(limit: 50);
      if (generation != _generation || _disposed) return;
      _merge(page.items);
      _nextCursor = page.nextCursor;
      state = state.copyWith(
        unreadCount: page.unreadCount,
        hasMore: page.hasMore && page.nextCursor != null,
        initialLoading: false,
        refreshing: false,
        clearError: true,
      );
      if (page.items.isNotEmpty) {
        await _rememberSequence(page.items.first.sequence);
      }
    } catch (error) {
      if (generation != _generation || _disposed) return;
      state = state.copyWith(
        initialLoading: false,
        refreshing: false,
        error: _messageFor(error),
      );
    } finally {
      if (initial && generation == _generation && !_disposed) {
        state = state.copyWith(initialLoading: false);
      }
    }
  }

  Future<void> refresh() async {
    if (_userId == null || state.refreshing) return;
    state = state.copyWith(refreshing: true);
    await _refreshFirstPage(_generation);
  }

  Future<void> loadMore() async {
    final cursor = _nextCursor;
    if (_userId == null || cursor == null || state.loadingMore) return;
    final generation = _generation;
    state = state.copyWith(loadingMore: true);
    try {
      final page = await _api.list(before: cursor, limit: 20);
      if (generation != _generation || _disposed) return;
      _merge(page.items);
      _nextCursor = page.nextCursor;
      state = state.copyWith(
        unreadCount: page.unreadCount,
        hasMore: page.hasMore && page.nextCursor != null,
        loadingMore: false,
        clearError: true,
      );
    } catch (error) {
      if (generation != _generation || _disposed) return;
      state = state.copyWith(loadingMore: false, error: _messageFor(error));
      rethrow;
    }
  }

  Future<void> markRead(String notificationId) async {
    final existing = state.items
        .where((item) => item.id == notificationId)
        .firstOrNull;
    if (existing == null ||
        existing.isRead ||
        state.pendingReadIds.contains(notificationId)) {
      return;
    }
    state = state.copyWith(
      pendingReadIds: {...state.pendingReadIds, notificationId},
    );
    try {
      final updated = await _api.markRead(notificationId);
      _merge([updated]);
      state = state.copyWith(
        unreadCount: (state.unreadCount - 1).clamp(0, 0x7fffffff).toInt(),
        pendingReadIds: {...state.pendingReadIds}..remove(notificationId),
        clearError: true,
      );
    } catch (error) {
      state = state.copyWith(
        pendingReadIds: {...state.pendingReadIds}..remove(notificationId),
        error: _messageFor(error),
      );
      rethrow;
    }
  }

  Future<int> markAllRead() async {
    if (_userId == null || state.markingAllRead) return 0;
    state = state.copyWith(markingAllRead: true);
    try {
      final result = await _api.markAllRead();
      state = state.copyWith(
        items: state.items
            .map((item) => item.isRead ? item : item.withReadAt(result.readAt))
            .toList(growable: false),
        unreadCount: 0,
        markingAllRead: false,
        clearError: true,
      );
      return result.updatedCount;
    } catch (error) {
      state = state.copyWith(markingAllRead: false, error: _messageFor(error));
      rethrow;
    }
  }

  String _messageFor(Object error) {
    final message = error.toString().replaceFirst('AppException: ', '').trim();
    return message.isEmpty
        ? 'Notifications could not be updated. Please try again.'
        : message;
  }
}
