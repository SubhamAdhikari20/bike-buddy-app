import '../data/notification_model.dart';

final _mongoId = RegExp(r'^[a-f\d]{24}$', caseSensitive: false);

String? notificationRoute(NotificationActionTarget? action) {
  if (action == null || !_mongoId.hasMatch(action.id)) return null;
  final id = Uri.encodeComponent(action.id);
  return switch (action.resource) {
    'booking' || 'payment' => '/booking/$id',
    'bike' || 'review' => '/bike/$id',
    'profile' => '/home?tab=3',
    'support_ticket' => '/support/tickets',
    'damage_report' => '/home?tab=2',
    'sos_alert' => '/support',
    _ => null,
  };
}
