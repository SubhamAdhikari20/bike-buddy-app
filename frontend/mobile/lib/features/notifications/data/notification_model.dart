class NotificationActionTarget {
  final String resource;
  final String id;

  const NotificationActionTarget({required this.resource, required this.id});

  factory NotificationActionTarget.fromJson(Map<String, dynamic> json) {
    return NotificationActionTarget(
      resource: json['resource']?.toString().trim() ?? '',
      id: json['id']?.toString().trim() ?? '',
    );
  }

  bool get isValid => resource.isNotEmpty && id.isNotEmpty;
}

/// A notification addressed to the currently authenticated user.
///
/// The name intentionally avoids Flutter's own [Notification] class.
class BikeBuddyNotification {
  final String id;
  final int sequence;
  final String type;
  final String severity;
  final String title;
  final String message;
  final NotificationActionTarget? action;
  final DateTime? readAt;
  final DateTime createdAt;

  const BikeBuddyNotification({
    required this.id,
    required this.sequence,
    required this.type,
    required this.severity,
    required this.title,
    required this.message,
    required this.action,
    required this.readAt,
    required this.createdAt,
  });

  bool get isRead => readAt != null;

  factory BikeBuddyNotification.fromJson(Map<String, dynamic> json) {
    final rawSequence = json['sequence'];
    final sequence = switch (rawSequence) {
      final num value => value.toInt(),
      final String value => int.tryParse(value) ?? 0,
      _ => 0,
    };
    final rawAction = json['action'];
    final action = rawAction is Map
        ? NotificationActionTarget.fromJson(rawAction.cast<String, dynamic>())
        : null;

    return BikeBuddyNotification(
      id: (json['_id'] ?? json['id'] ?? '').toString(),
      sequence: sequence,
      type: json['type']?.toString() ?? 'general',
      severity: json['severity']?.toString() ?? 'info',
      title: json['title']?.toString() ?? 'Bike Buddy update',
      message: json['message']?.toString() ?? '',
      action: action?.isValid == true ? action : null,
      readAt: _dateOrNull(json['readAt']),
      createdAt: _dateOrNull(json['createdAt']) ?? DateTime.now().toUtc(),
    );
  }

  BikeBuddyNotification withReadAt(DateTime value) {
    return BikeBuddyNotification(
      id: id,
      sequence: sequence,
      type: type,
      severity: severity,
      title: title,
      message: message,
      action: action,
      readAt: value,
      createdAt: createdAt,
    );
  }

  static DateTime? _dateOrNull(Object? value) {
    if (value is! String || value.isEmpty) return null;
    return DateTime.tryParse(value)?.toUtc();
  }
}

class NotificationListPage {
  final List<BikeBuddyNotification> items;
  final int? nextCursor;
  final bool hasMore;
  final int unreadCount;

  const NotificationListPage({
    required this.items,
    required this.nextCursor,
    required this.hasMore,
    required this.unreadCount,
  });

  factory NotificationListPage.fromJson(Map<String, dynamic> json) {
    final rawItems = json['items'] as List? ?? const [];
    final pageInfo = switch (json['pageInfo']) {
      final Map value => value.cast<String, dynamic>(),
      _ => const <String, dynamic>{},
    };
    final rawCursor = pageInfo['nextCursor'];

    return NotificationListPage(
      items: rawItems
          .whereType<Map>()
          .map(
            (item) =>
                BikeBuddyNotification.fromJson(item.cast<String, dynamic>()),
          )
          .where((item) => item.id.isNotEmpty && item.sequence > 0)
          .toList(growable: false),
      nextCursor: switch (rawCursor) {
        final num value => value.toInt(),
        final String value => int.tryParse(value),
        _ => null,
      },
      hasMore: pageInfo['hasMore'] as bool? ?? false,
      unreadCount: (json['unreadCount'] as num?)?.toInt() ?? 0,
    );
  }
}
