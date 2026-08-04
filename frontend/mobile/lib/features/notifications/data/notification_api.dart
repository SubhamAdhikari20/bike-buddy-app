import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/error/app_exception.dart';
import 'notification_model.dart';
import 'sse_parser.dart';

final notificationApiProvider = Provider<NotificationApi>(
  (ref) => NotificationApi(ref.watch(apiClientProvider)),
);

class NotificationApi {
  final ApiClient _client;

  const NotificationApi(this._client);

  Future<NotificationListPage> list({
    int? before,
    int limit = 20,
    bool unreadOnly = false,
  }) async {
    final response = await _client.get(
      '/notifications',
      query: {
        'limit': limit.clamp(1, 50),
        'unreadOnly': unreadOnly,
        if (before != null && before > 0) 'before': before,
      },
    );
    return NotificationListPage.fromJson(
      (response['data'] as Map).cast<String, dynamic>(),
    );
  }

  Future<BikeBuddyNotification> markRead(String notificationId) async {
    final response = await _client.patch(
      '/notifications/${Uri.encodeComponent(notificationId)}/read',
    );
    return BikeBuddyNotification.fromJson(
      (response['data'] as Map).cast<String, dynamic>(),
    );
  }

  Future<({int updatedCount, DateTime readAt})> markAllRead() async {
    final response = await _client.patch('/notifications/read-all');
    final data = (response['data'] as Map).cast<String, dynamic>();
    return (
      updatedCount: (data['updatedCount'] as num?)?.toInt() ?? 0,
      readAt:
          DateTime.tryParse(data['readAt']?.toString() ?? '')?.toUtc() ??
          DateTime.now().toUtc(),
    );
  }

  Stream<SseEvent> stream({
    required int after,
    required CancelToken cancelToken,
  }) async* {
    try {
      final response = await _client.dio.get<ResponseBody>(
        '/notifications/stream',
        queryParameters: {'after': after.clamp(0, 0x7fffffff)},
        cancelToken: cancelToken,
        options: Options(
          responseType: ResponseType.stream,
          receiveTimeout: Duration.zero,
          headers: const {
            'Accept': 'text/event-stream',
            'Cache-Control': 'no-cache',
          },
        ),
      );
      final body = response.data;
      if (body == null) {
        throw const AppException('The notification stream returned no data.');
      }
      yield* const SseParser().bind(body.stream);
    } on DioException catch (error) {
      if (CancelToken.isCancel(error)) return;
      final response = error.response;
      final data = response?.data;
      final message = data is Map && data['message'] is String
          ? data['message'] as String
          : response == null
          ? 'Could not reach Bike Buddy for live notifications.'
          : 'The live notification connection was interrupted.';
      throw AppException(
        message,
        statusCode: response?.statusCode,
        code: data is Map ? data['code'] as String? : null,
      );
    }
  }
}
