class Review {
  final String id;
  final int rating;
  final String comment;
  final bool isVerifiedRide;
  final DateTime? createdAt;

  const Review({
    required this.id,
    required this.rating,
    required this.comment,
    required this.isVerifiedRide,
    this.createdAt,
  });

  factory Review.fromJson(Map<String, dynamic> json) => Review(
        id: (json['_id'] ?? '').toString(),
        rating: (json['rating'] as num?)?.toInt() ?? 0,
        comment: json['comment'] as String? ?? '',
        isVerifiedRide: json['isVerifiedRide'] as bool? ?? false,
        createdAt: DateTime.tryParse(json['createdAt'] as String? ?? ''),
      );
}
