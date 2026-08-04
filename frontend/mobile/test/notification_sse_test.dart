import 'dart:convert';

import 'package:bike_buddy/features/notifications/data/notification_model.dart';
import 'package:bike_buddy/features/notifications/data/sse_parser.dart';
import 'package:bike_buddy/features/notifications/presentation/notification_routes.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test(
    'SSE parser handles split UTF-8, CRLF, comments and persistent IDs',
    () async {
      const body =
          'id: 41\r\n'
          'event: notification\r\n'
          'data: {"title":"Ride ready 🏍️"}\r\n'
          '\r\n'
          ': heartbeat\n'
          'event: ready\n'
          'data: {"latestSequence":41,\n'
          'data: "unreadCount":1}\n\n';
      final bytes = utf8.encode(body);
      final motorcycleStart = bytes.indexOf(0xF0);
      expect(motorcycleStart, greaterThan(0));

      final chunks = <List<int>>[
        bytes.sublist(0, motorcycleStart + 1),
        bytes.sublist(motorcycleStart + 1, motorcycleStart + 3),
        bytes.sublist(motorcycleStart + 3),
      ];
      final events = await const SseParser()
          .bind(Stream<List<int>>.fromIterable(chunks))
          .toList();

      expect(events, hasLength(2));
      expect(events.first.event, 'notification');
      expect(events.first.id, '41');
      expect(events.first.data, '{"title":"Ride ready 🏍️"}');
      expect(events.last.event, 'ready');
      expect(events.last.id, '41');
      expect(events.last.data, '{"latestSequence":41,\n"unreadCount":1}');
    },
  );

  test(
    'SSE parser retains a final complete data event on clean close',
    () async {
      final events = await const SseParser()
          .bind(Stream.value(utf8.encode('event: ready\ndata: {}')))
          .toList();
      expect(events, hasLength(1));
      expect(events.single.event, 'ready');
      expect(events.single.data, '{}');
    },
  );

  test('notification DTO and action routes use only expected targets', () {
    final notification = BikeBuddyNotification.fromJson({
      '_id': '507f1f77bcf86cd799439011',
      'sequence': 12,
      'type': 'booking.approved',
      'severity': 'success',
      'title': 'Booking approved',
      'message': 'Review the pickup details.',
      'action': {'resource': 'booking', 'id': '507f1f77bcf86cd799439012'},
      'readAt': null,
      'createdAt': '2030-01-01T00:00:00.000Z',
    });

    expect(notification.sequence, 12);
    expect(notification.isRead, isFalse);
    expect(
      notificationRoute(notification.action),
      '/booking/507f1f77bcf86cd799439012',
    );
    expect(
      notificationRoute(
        const NotificationActionTarget(resource: 'booking', id: '../admin'),
      ),
      isNull,
    );
  });
}
