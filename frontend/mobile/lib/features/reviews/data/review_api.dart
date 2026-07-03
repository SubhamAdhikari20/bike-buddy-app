import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import 'review_model.dart';

final reviewApiProvider = Provider<ReviewApi>(
  (ref) => ReviewApi(ref.watch(apiClientProvider)),
);

/// Reviews for a bike; only renters with a completed booking can write
/// one, so every review is a verified ride (TR-02).
final bikeReviewsProvider =
    FutureProvider.family<List<Review>, String>((ref, bikeId) {
  return ref.watch(reviewApiProvider).listByBike(bikeId);
});

class ReviewApi {
  final ApiClient _client;

  ReviewApi(this._client);

  Future<List<Review>> listByBike(String bikeId) async {
    final res = await _client.get('/reviews/bike/$bikeId');
    final items = (res['data'] as List? ?? const []);
    return items
        .map((item) => Review.fromJson((item as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<void> create({
    required String bikeId,
    required String bookingId,
    required int rating,
    required String comment,
  }) async {
    await _client.post('/reviews', data: {
      'bikeId': bikeId,
      'bookingId': bookingId,
      'rating': rating,
      'comment': comment,
    });
  }
}
