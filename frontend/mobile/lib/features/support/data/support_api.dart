import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';

final supportApiProvider = Provider<SupportApi>(
  (ref) => SupportApi(ref.watch(apiClientProvider)),
);

final faqProvider = FutureProvider<List<({String q, String a})>>((ref) {
  return ref.watch(supportApiProvider).faq();
});

final myTicketsProvider = FutureProvider<List<SupportTicket>>((ref) {
  return ref.watch(supportApiProvider).myTickets();
});

class SupportTicket {
  final String id;
  final String type;
  final String subject;
  final String message;
  final String status;
  final int? rating;
  final DateTime? createdAt;

  const SupportTicket({
    required this.id,
    required this.type,
    required this.subject,
    required this.message,
    required this.status,
    this.rating,
    this.createdAt,
  });

  factory SupportTicket.fromJson(Map<String, dynamic> json) => SupportTicket(
        id: (json['_id'] ?? '').toString(),
        type: json['type'] as String? ?? 'general',
        subject: json['subject'] as String? ?? '',
        message: json['message'] as String? ?? '',
        status: json['status'] as String? ?? 'open',
        rating: (json['rating'] as num?)?.toInt(),
        createdAt: DateTime.tryParse(json['createdAt'] as String? ?? ''),
      );
}

class SupportApi {
  final ApiClient _client;

  SupportApi(this._client);

  Future<List<({String q, String a})>> faq() async {
    final res = await _client.get('/support/faq');
    final items = (res['data'] as List? ?? const []);
    return items
        .map((item) => (
              q: (item as Map)['q'] as String? ?? '',
              a: item['a'] as String? ?? '',
            ))
        .toList();
  }

  Future<Map<String, dynamic>> createTicket({
    required String type,
    required String subject,
    required String message,
    List<String> photos = const [],
    String? bookingId,
  }) async {
    final res = await _client.post('/support/tickets', data: {
      'type': type,
      'subject': subject,
      'message': message,
      'photos': photos,
      'bookingId': ?bookingId,
    });
    return (res['data'] as Map).cast<String, dynamic>();
  }

  Future<List<SupportTicket>> myTickets() async {
    final res = await _client.get('/support/tickets/mine');
    final items = (res['data'] as List? ?? const []);
    return items
        .map((item) =>
            SupportTicket.fromJson((item as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<void> rateTicket(String ticketId, int rating, String? comment) async {
    await _client.post('/support/tickets/$ticketId/rate', data: {
      'rating': rating,
      'comment': ?comment,
    });
  }
}
