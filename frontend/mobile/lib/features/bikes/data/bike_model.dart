class BikeLocation {
  final String label;
  final String address;
  final String city;
  final String? area;
  final double? latitude;
  final double? longitude;

  const BikeLocation({
    required this.label,
    required this.address,
    required this.city,
    this.area,
    this.latitude,
    this.longitude,
  });

  factory BikeLocation.fromJson(Map<String, dynamic> json) => BikeLocation(
        label: json['label'] as String? ?? '',
        address: json['address'] as String? ?? '',
        city: json['city'] as String? ?? '',
        area: json['area'] as String?,
        latitude: (json['latitude'] as num?)?.toDouble(),
        longitude: (json['longitude'] as num?)?.toDouble(),
      );
}

class Bike {
  final String id;
  final String title;
  final String brand;
  final String model;
  final int year;
  final int engineCc;
  final String fuelType;
  final String transmission;
  final String condition;
  final String? description;
  final double pricePerDay;
  final double? pricePerHour;
  final BikeLocation location;
  final List<String> imageUrls;
  final String status;
  final bool verifiedBike;
  final double averageRating;
  final int ratingCount;
  final double? distanceKm;

  const Bike({
    required this.id,
    required this.title,
    required this.brand,
    required this.model,
    required this.year,
    required this.engineCc,
    required this.fuelType,
    required this.transmission,
    required this.condition,
    this.description,
    required this.pricePerDay,
    this.pricePerHour,
    required this.location,
    required this.imageUrls,
    required this.status,
    required this.verifiedBike,
    required this.averageRating,
    required this.ratingCount,
    this.distanceKm,
  });

  bool get isAvailable => status == 'available';

  factory Bike.fromJson(Map<String, dynamic> json) {
    final images = (json['images'] as List? ?? const [])
        .map((img) => (img as Map)['url'] as String? ?? '')
        .where((url) => url.isNotEmpty)
        .toList();

    return Bike(
      id: (json['_id'] ?? json['id'] ?? '').toString(),
      title: json['title'] as String? ?? '',
      brand: json['brand'] as String? ?? '',
      model: json['model'] as String? ?? '',
      year: (json['year'] as num?)?.toInt() ?? 0,
      engineCc: (json['engineCc'] as num?)?.toInt() ?? 0,
      fuelType: json['fuelType'] as String? ?? 'petrol',
      transmission: json['transmission'] as String? ?? 'manual',
      condition: json['condition'] as String? ?? 'good',
      description: json['description'] as String?,
      pricePerDay: (json['pricePerDay'] as num?)?.toDouble() ?? 0,
      pricePerHour: (json['pricePerHour'] as num?)?.toDouble(),
      location: BikeLocation.fromJson(
        (json['location'] as Map?)?.cast<String, dynamic>() ?? const {},
      ),
      imageUrls: images,
      status: json['status'] as String? ?? 'available',
      verifiedBike: json['verifiedBike'] as bool? ?? false,
      averageRating: (json['averageRating'] as num?)?.toDouble() ?? 0,
      ratingCount: (json['ratingCount'] as num?)?.toInt() ?? 0,
      distanceKm: (json['distanceKm'] as num?)?.toDouble(),
    );
  }
}
