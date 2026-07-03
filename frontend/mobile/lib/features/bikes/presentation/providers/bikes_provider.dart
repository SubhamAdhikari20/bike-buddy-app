import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/bike_api.dart';
import '../../data/bike_model.dart';

/// One simple filter model feeds the whole discovery experience:
/// category chips, search bar and the filter sheet (Hick's law).
class BikeQuery {
  final String? search;
  final String? category; // backend enum value, null = all
  final String? city;
  final double? minPrice;
  final double? maxPrice;
  final String sortBy;
  final String sortOrder;
  final bool availableOnly;

  const BikeQuery({
    this.search,
    this.category,
    this.city,
    this.minPrice,
    this.maxPrice,
    this.sortBy = 'createdAt',
    this.sortOrder = 'desc',
    this.availableOnly = true,
  });

  static const categoryLabels = <String, String?>{
    'All Bikes': null,
    'Commuter': 'commuter',
    'Scooters': 'scooter',
    'Cruisers': 'cruiser',
    'Sports': 'sports',
    'Electric': 'electric',
    'Mountain': 'mountain',
  };

  int get activeFilterCount => [
        if (category != null) 1,
        if (city != null) 1,
        if (minPrice != null || maxPrice != null) 1,
        if (!availableOnly) 1,
      ].length;

  BikeQuery copyWith({
    Object? search = _sentinel,
    Object? category = _sentinel,
    Object? city = _sentinel,
    Object? minPrice = _sentinel,
    Object? maxPrice = _sentinel,
    String? sortBy,
    String? sortOrder,
    bool? availableOnly,
  }) =>
      BikeQuery(
        search: search == _sentinel ? this.search : search as String?,
        category: category == _sentinel ? this.category : category as String?,
        city: city == _sentinel ? this.city : city as String?,
        minPrice: minPrice == _sentinel ? this.minPrice : minPrice as double?,
        maxPrice: maxPrice == _sentinel ? this.maxPrice : maxPrice as double?,
        sortBy: sortBy ?? this.sortBy,
        sortOrder: sortOrder ?? this.sortOrder,
        availableOnly: availableOnly ?? this.availableOnly,
      );

  static const _sentinel = Object();

  @override
  bool operator ==(Object other) =>
      other is BikeQuery &&
      other.search == search &&
      other.category == category &&
      other.city == city &&
      other.minPrice == minPrice &&
      other.maxPrice == maxPrice &&
      other.sortBy == sortBy &&
      other.sortOrder == sortOrder &&
      other.availableOnly == availableOnly;

  @override
  int get hashCode => Object.hash(
      search, category, city, minPrice, maxPrice, sortBy, sortOrder, availableOnly);
}

final bikeQueryProvider = StateProvider<BikeQuery>((ref) => const BikeQuery());

final bikesProvider = FutureProvider<List<Bike>>((ref) {
  final query = ref.watch(bikeQueryProvider);
  final api = ref.watch(bikeApiProvider);

  return api.listBikes(
    search: query.search,
    status: query.availableOnly ? 'available' : null,
    category: query.category,
    city: query.city,
    minPrice: query.minPrice,
    maxPrice: query.maxPrice,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
  );
});

/// Single bike with populated owner for the detail page.
final bikeDetailProvider = FutureProvider.family<Bike, String>((ref, bikeId) {
  return ref.watch(bikeApiProvider).getBike(bikeId);
});

/// Bikes picked for comparison from the search results (UI-04).
final compareSelectionProvider = StateProvider<List<Bike>>((ref) => []);
