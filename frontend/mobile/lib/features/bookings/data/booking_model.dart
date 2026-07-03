import '../../bikes/data/bike_model.dart';

class PriceBreakdown {
  final double pricePerDay;
  final int rentalDays;
  final double baseAmount;
  final double serviceFee;
  final double securityDeposit;
  final double total;

  const PriceBreakdown({
    required this.pricePerDay,
    required this.rentalDays,
    required this.baseAmount,
    required this.serviceFee,
    required this.securityDeposit,
    required this.total,
  });

  factory PriceBreakdown.fromJson(Map<String, dynamic> json) => PriceBreakdown(
        pricePerDay: (json['pricePerDay'] as num?)?.toDouble() ?? 0,
        rentalDays: (json['rentalDays'] as num?)?.toInt() ?? 0,
        baseAmount: (json['baseAmount'] as num?)?.toDouble() ?? 0,
        serviceFee: (json['serviceFee'] as num?)?.toDouble() ?? 0,
        securityDeposit: (json['securityDeposit'] as num?)?.toDouble() ?? 0,
        total: (json['total'] as num?)?.toDouble() ?? 0,
      );
}

class Booking {
  final String id;
  final String bikeId;
  final Bike? bike;
  final DateTime startDate;
  final DateTime endDate;
  final String pickupLocation;
  final String status;
  final String paymentStatus;
  final double totalAmount;
  final PriceBreakdown? priceBreakdown;
  final DateTime? priceLockedAt;
  final DateTime? createdAt;
  final bool checklistDone;
  final DateTime? returnedAt;
  final int lateMinutes;
  final double lateFeeAmount;

  const Booking({
    required this.id,
    required this.bikeId,
    this.bike,
    required this.startDate,
    required this.endDate,
    required this.pickupLocation,
    required this.status,
    required this.paymentStatus,
    required this.totalAmount,
    this.priceBreakdown,
    this.priceLockedAt,
    this.createdAt,
    this.checklistDone = false,
    this.returnedAt,
    this.lateMinutes = 0,
    this.lateFeeAmount = 0,
  });

  bool get isActive {
    final now = DateTime.now();
    return status == 'confirmed' &&
        now.isAfter(startDate) &&
        now.isBefore(endDate);
  }

  bool get isUpcoming =>
      (status == 'confirmed' || status == 'pending') &&
      DateTime.now().isBefore(startDate);

  bool get isPast =>
      status == 'completed' ||
      status == 'cancelled' ||
      status == 'rejected' ||
      DateTime.now().isAfter(endDate);

  factory Booking.fromJson(Map<String, dynamic> json) {
    final bikeField = json['bikeId'];
    return Booking(
      id: (json['_id'] ?? '').toString(),
      bikeId: bikeField is Map
          ? (bikeField['_id'] ?? '').toString()
          : (bikeField ?? '').toString(),
      bike: bikeField is Map
          ? Bike.fromJson(bikeField.cast<String, dynamic>())
          : null,
      startDate:
          DateTime.tryParse(json['startDate'] as String? ?? '') ?? DateTime.now(),
      endDate:
          DateTime.tryParse(json['endDate'] as String? ?? '') ?? DateTime.now(),
      pickupLocation: json['pickupLocation'] as String? ?? '',
      status: json['status'] as String? ?? 'pending',
      paymentStatus: json['paymentStatus'] as String? ?? 'unpaid',
      totalAmount: (json['totalAmount'] as num?)?.toDouble() ?? 0,
      priceBreakdown: json['priceBreakdown'] is Map
          ? PriceBreakdown.fromJson(
              (json['priceBreakdown'] as Map).cast<String, dynamic>())
          : null,
      priceLockedAt:
          DateTime.tryParse(json['priceLockedAt'] as String? ?? ''),
      createdAt: DateTime.tryParse(json['createdAt'] as String? ?? ''),
      checklistDone:
          (json['preRideChecklist'] as Map?)?['completedAt'] != null,
      returnedAt: DateTime.tryParse(json['returnedAt'] as String? ?? ''),
      lateMinutes: (json['lateMinutes'] as num?)?.toInt() ?? 0,
      lateFeeAmount: (json['lateFeeAmount'] as num?)?.toDouble() ?? 0,
    );
  }
}

class FareQuote {
  final PriceBreakdown breakdown;
  final double? pricePerHour;

  const FareQuote({required this.breakdown, this.pricePerHour});

  factory FareQuote.fromJson(Map<String, dynamic> json) => FareQuote(
        breakdown: PriceBreakdown.fromJson(json),
        pricePerHour: (json['pricePerHour'] as num?)?.toDouble(),
      );
}

class PaymentIntent {
  final String paymentId;
  final String transactionRef;
  final double amount;
  final String provider;
  final String? paymentUrl;

  const PaymentIntent({
    required this.paymentId,
    required this.transactionRef,
    required this.amount,
    required this.provider,
    this.paymentUrl,
  });

  factory PaymentIntent.fromJson(Map<String, dynamic> json) => PaymentIntent(
        paymentId: (json['paymentId'] ?? '').toString(),
        transactionRef: json['transactionRef'] as String? ?? '',
        amount: (json['amount'] as num?)?.toDouble() ?? 0,
        provider: json['provider'] as String? ?? '',
        paymentUrl: json['paymentUrl'] as String?,
      );
}
