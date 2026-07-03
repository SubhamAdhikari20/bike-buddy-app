import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/bike_api.dart';
import '../../data/bike_model.dart';

/// Query for the bike list. Category chips and the search bar both feed
/// into this (Hick's law: one simple filter model in Sprint 1).
class BikeQuery {
  final String? search;
  final String? category;
  final bool availableOnly;

  const BikeQuery({this.search, this.category, this.availableOnly = true});

  BikeQuery copyWith({String? search, String? category, bool? availableOnly}) =>
      BikeQuery(
        search: search ?? this.search,
        category: category ?? this.category,
        availableOnly: availableOnly ?? this.availableOnly,
      );

  @override
  bool operator ==(Object other) =>
      other is BikeQuery &&
      other.search == search &&
      other.category == category &&
      other.availableOnly == availableOnly;

  @override
  int get hashCode => Object.hash(search, category, availableOnly);
}

final bikeQueryProvider = StateProvider<BikeQuery>((ref) => const BikeQuery());

final bikesProvider = FutureProvider<List<Bike>>((ref) async {
  final query = ref.watch(bikeQueryProvider);
  final api = ref.watch(bikeApiProvider);

  final bikes = await api.listBikes(
    search: query.search,
    status: query.availableOnly ? 'available' : null,
  );

  // Category chips: electric maps to fuel type, the rest match on
  // tags/title until dedicated categories arrive in Sprint 2.
  final category = query.category;
  if (category == null || category == 'All Bikes') return bikes;

  final needle = category.toLowerCase().replaceAll(RegExp(r's$'), '');
  return bikes.where((bike) {
    if (needle == 'electric') return bike.fuelType == 'electric';
    final haystack = '${bike.title} ${bike.brand} ${bike.model}'.toLowerCase();
    return haystack.contains(needle);
  }).toList();
});
