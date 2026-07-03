class BikeLocation {
  final String label;
  final String address;
  final String city;
  final String? area;
  final String? landmark;
  final double? latitude;
  final double? longitude;

  const BikeLocation({
    required this.label,
    required this.address,
    required this.city,
    this.area,
    this.landmark,
    this.latitude,
    this.longitude,
  });

  factory BikeLocation.fromJson(Map<String, dynamic> json) => BikeLocation(
        label: json['label'] as String? ?? '',
        address: json['address'] as String? ?? '',
        city: json['city'] as String? ?? '',
        area: json['area'] as String?,
        landmark: json['landmark'] as String?,
        latitude: (json['latitude'] as num?)?.toDouble(),
        longitude: (json['longitude'] as num?)?.toDouble(),
      );
}

/// Owner summary as populated in bike responses. Backs the verified
/// owner badge and its detail modal (TR-01).
class BikeOwner {
  final String id;
  final String fullName;
  final String ownerStatus;
  final DateTime? verifiedAt;
  final String? bio;
  final String? profilePictureUrl;

  const BikeOwner({
    required this.id,
    required this.fullName,
    required this.ownerStatus,
    this.verifiedAt,
    this.bio,
    this.profilePictureUrl,
  });

  bool get isVerified => ownerStatus == 'verified';

  factory BikeOwner.fromJson(Map<String, dynamic> json) => BikeOwner(
        id: (json['_id'] ?? '').toString(),
        fullName: json['fullName'] as String? ?? 'Bike owner',
        ownerStatus: json['ownerStatus'] as String? ?? 'none',
        verifiedAt: DateTime.tryParse(json['ownerVerificationDate'] as String? ?? ''),
        bio: json['bio'] as String?,
        profilePictureUrl: json['profilePictureUrl'] as String?,
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
  final String category;
  final double securityDeposit;
  final BikeOwner? owner;
  final bool isBestValue;
  final double? weightKg;
  final double? mileageKmPerL;
  final bool helmetIncluded;
  final DateTime? serviceDate;
  final int? odometerKm;
  final List<({String url, DateTime? takenAt})> conditionPhotos;

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
    this.category = 'commuter',
    this.securityDeposit = 0,
    this.owner,
    this.isBestValue = false,
    this.weightKg,
    this.mileageKmPerL,
    this.helmetIncluded = false,
    this.serviceDate,
    this.odometerKm,
    this.conditionPhotos = const [],
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
      category: json['category'] as String? ?? 'commuter',
      securityDeposit: (json['securityDeposit'] as num?)?.toDouble() ?? 0,
      owner: json['ownerId'] is Map
          ? BikeOwner.fromJson((json['ownerId'] as Map).cast<String, dynamic>())
          : null,
      isBestValue: json['isBestValue'] as bool? ?? false,
      weightKg: ((json['specs'] as Map?)?['weightKg'] as num?)?.toDouble(),
      mileageKmPerL:
          ((json['specs'] as Map?)?['mileageKmPerL'] as num?)?.toDouble(),
      helmetIncluded:
          (json['specs'] as Map?)?['helmetIncluded'] as bool? ?? false,
      serviceDate: DateTime.tryParse(
          (json['conditionInfo'] as Map?)?['serviceDate'] as String? ?? ''),
      odometerKm:
          ((json['conditionInfo'] as Map?)?['odometerKm'] as num?)?.toInt(),
      conditionPhotos:
          ((json['conditionInfo'] as Map?)?['photos'] as List? ?? const [])
              .map((photo) => (
                    url: (photo as Map)['url'] as String? ?? '',
                    takenAt:
                        DateTime.tryParse(photo['takenAt'] as String? ?? ''),
                  ))
              .where((photo) => photo.url.isNotEmpty)
              .toList(),
    );
  }
}
