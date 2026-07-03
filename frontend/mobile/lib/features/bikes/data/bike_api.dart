import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import 'bike_model.dart';

final bikeApiProvider = Provider<BikeApi>(
  (ref) => BikeApi(ref.watch(apiClientProvider)),
);

class BikeApi {
  final ApiClient _client;

  BikeApi(this._client);

  Future<List<Bike>> listBikes({
    String? search,
    String? status,
    String? category,
    String? city,
    double? minPrice,
    double? maxPrice,
    String? sortBy,
    String? sortOrder,
    double? lat,
    double? lng,
    double? radiusKm,
    bool includeUnavailable = false,
    int page = 1,
    int limit = 20,
  }) async {
    final res = await _client.get('/bikes', query: {
      'page': page,
      'limit': limit,
      if (search != null && search.isNotEmpty) 'search': search,
      'status': ?status,
      'category': ?category,
      'city': ?city,
      'minPrice': ?minPrice,
      'maxPrice': ?maxPrice,
      'sortBy': ?sortBy,
      'sortOrder': ?sortOrder,
      'lat': ?lat,
      'lng': ?lng,
      'radiusKm': ?radiusKm,
      if (includeUnavailable) 'includeUnavailable': true,
    });

    final items = (res['data'] as List? ?? const []);
    return items
        .map((item) => Bike.fromJson((item as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<Bike> getBike(String bikeId) async {
    final res = await _client.get('/bikes/$bikeId');
    return Bike.fromJson((res['data'] as Map).cast<String, dynamic>());
  }

  /// Compare 2-3 bikes side by side (UI-04).
  Future<List<Bike>> compareBikes(List<String> ids) async {
    final res = await _client.get('/bikes/compare', query: {'ids': ids.join(',')});
    final items = (res['data'] as List? ?? const []);
    return items
        .map((item) => Bike.fromJson((item as Map).cast<String, dynamic>()))
        .toList();
  }
}
