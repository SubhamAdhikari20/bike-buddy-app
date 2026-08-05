import '../../../core/api/api_endpoints.dart';
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
  final String? paymentMode;
  final String? paymentMethod;
  final String? cashReference;
  final DateTime? cashReceivedAt;
  final double totalAmount;
  final PriceBreakdown? priceBreakdown;
  final DateTime? priceLockedAt;
  final DateTime? createdAt;
  final DateTime? rideStartedAt;
  final bool checklistDone;
  final int checklistItemCount;
  final int checklistPhotoCount;
  final bool checklistAcknowledged;
  final DateTime? checklistCompletedAt;
  final String? cancellationReason;
  final DateTime? returnedAt;
  final int lateMinutes;
  final double lateFeeAmount;
  final int extensionHours;
  final double extensionAmount;

  const Booking({
    required this.id,
    required this.bikeId,
    this.bike,
    required this.startDate,
    required this.endDate,
    required this.pickupLocation,
    required this.status,
    required this.paymentStatus,
    this.paymentMode,
    this.paymentMethod,
    this.cashReference,
    this.cashReceivedAt,
    required this.totalAmount,
    this.priceBreakdown,
    this.priceLockedAt,
    this.createdAt,
    this.rideStartedAt,
    this.checklistDone = false,
    this.checklistItemCount = 0,
    this.checklistPhotoCount = 0,
    this.checklistAcknowledged = false,
    this.checklistCompletedAt,
    this.cancellationReason,
    this.returnedAt,
    this.lateMinutes = 0,
    this.lateFeeAmount = 0,
    this.extensionHours = 0,
    this.extensionAmount = 0,
  });

  bool get hasStartedRide => rideStartedAt != null;

  bool get hasReturnedRide => returnedAt != null || status == 'completed';

  bool get isRideInProgress => hasStartedRide && !hasReturnedRide;

  bool get isRideReadyToStart =>
      status == 'confirmed' &&
      paymentStatus == 'paid' &&
      !hasStartedRide &&
      !hasReturnedRide;

  bool get isActive {
    return isRideInProgress || isRideReadyToStart;
  }

  bool get isUpcoming =>
      (status == 'pending' ||
          (status == 'confirmed' && paymentStatus != 'paid')) &&
      !hasStartedRide &&
      !hasReturnedRide &&
      DateTime.now().isBefore(startDate);

  bool get isPast =>
      hasReturnedRide ||
      status == 'completed' ||
      status == 'cancelled' ||
      status == 'rejected' ||
      status == 'expired';

  factory Booking.fromJson(Map<String, dynamic> json) {
    final bikeField = json['bikeId'];
    final checklist = (json['preRideChecklist'] as Map?)
        ?.cast<String, dynamic>();
    return Booking(
      id: (json['_id'] ?? '').toString(),
      bikeId: bikeField is Map
          ? (bikeField['_id'] ?? '').toString()
          : (bikeField ?? '').toString(),
      bike: bikeField is Map
          ? Bike.fromJson(bikeField.cast<String, dynamic>())
          : null,
      startDate:
          DateTime.tryParse(json['startDate'] as String? ?? '') ??
          DateTime.now(),
      endDate:
          DateTime.tryParse(json['endDate'] as String? ?? '') ?? DateTime.now(),
      pickupLocation: json['pickupLocation'] as String? ?? '',
      status: json['status'] as String? ?? 'pending',
      paymentStatus: json['paymentStatus'] as String? ?? 'unpaid',
      paymentMode: json['paymentMode'] as String?,
      paymentMethod: json['paymentMethod'] as String?,
      cashReference: json['cashReference'] as String?,
      cashReceivedAt: DateTime.tryParse(
        json['cashReceivedAt'] as String? ?? '',
      ),
      totalAmount: (json['totalAmount'] as num?)?.toDouble() ?? 0,
      priceBreakdown: json['priceBreakdown'] is Map
          ? PriceBreakdown.fromJson(
              (json['priceBreakdown'] as Map).cast<String, dynamic>(),
            )
          : null,
      priceLockedAt: DateTime.tryParse(json['priceLockedAt'] as String? ?? ''),
      createdAt: DateTime.tryParse(json['createdAt'] as String? ?? ''),
      rideStartedAt: DateTime.tryParse(json['rideStartedAt'] as String? ?? ''),
      checklistDone: checklist?['completedAt'] != null,
      checklistItemCount: (checklist?['items'] as List?)?.length ?? 0,
      checklistPhotoCount: (checklist?['photos'] as List?)?.length ?? 0,
      checklistAcknowledged: checklist?['acknowledged'] as bool? ?? false,
      checklistCompletedAt: DateTime.tryParse(
        checklist?['completedAt'] as String? ?? '',
      ),
      cancellationReason: json['cancellationReason'] as String?,
      returnedAt: DateTime.tryParse(json['returnedAt'] as String? ?? ''),
      lateMinutes: (json['lateMinutes'] as num?)?.toInt() ?? 0,
      lateFeeAmount: (json['lateFeeAmount'] as num?)?.toDouble() ?? 0,
      extensionHours: (json['extensionHours'] as num?)?.toInt() ?? 0,
      extensionAmount: (json['extensionAmount'] as num?)?.toDouble() ?? 0,
    );
  }
}

class BookingDamageReport {
  final String id;
  final String bookingId;
  final String description;
  final String status;
  final int photoCount;
  final DateTime? createdAt;
  final DateTime? resolvedAt;

  const BookingDamageReport({
    required this.id,
    required this.bookingId,
    required this.description,
    required this.status,
    required this.photoCount,
    this.createdAt,
    this.resolvedAt,
  });

  factory BookingDamageReport.fromJson(Map<String, dynamic> json) =>
      BookingDamageReport(
        id: (json['_id'] ?? '').toString(),
        bookingId: (json['bookingId'] ?? '').toString(),
        description: json['description'] as String? ?? '',
        status: json['status'] as String? ?? 'open',
        photoCount: (json['photos'] as List?)?.length ?? 0,
        createdAt: DateTime.tryParse(json['createdAt'] as String? ?? ''),
        resolvedAt: DateTime.tryParse(json['resolvedAt'] as String? ?? ''),
      );
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
  final String currency;
  final String provider;
  final String mode;
  final String? paymentUrl;
  final bool demoConfirmationRequired;
  final String? notice;

  const PaymentIntent({
    required this.paymentId,
    required this.transactionRef,
    required this.amount,
    required this.currency,
    required this.provider,
    required this.mode,
    this.paymentUrl,
    required this.demoConfirmationRequired,
    this.notice,
  });

  factory PaymentIntent.fromJson(Map<String, dynamic> json) => PaymentIntent(
    paymentId: (json['paymentId'] ?? '').toString(),
    transactionRef: json['transactionRef'] as String? ?? '',
    amount: (json['amount'] as num?)?.toDouble() ?? 0,
    currency: json['currency'] as String? ?? 'NPR',
    provider: json['provider'] as String? ?? '',
    mode: json['mode'] as String? ?? 'demo',
    paymentUrl: json['paymentUrl'] as String?,
    demoConfirmationRequired:
        json['demoConfirmationRequired'] as bool? ?? false,
    notice: json['notice'] as String?,
  );

  bool get isDemo => mode.toLowerCase() == 'demo';

  bool get isSandbox => mode.toLowerCase() == 'sandbox';

  Uri? get checkoutUri => ApiEndpoints.trustedCheckoutUri(paymentUrl);
}

class PaymentStatus {
  final String paymentId;
  final String bookingId;
  final String provider;
  final String mode;
  final String status;
  final bool paid;
  final bool terminal;
  final String message;

  const PaymentStatus({
    required this.paymentId,
    required this.bookingId,
    required this.provider,
    required this.mode,
    required this.status,
    required this.paid,
    required this.terminal,
    required this.message,
  });

  factory PaymentStatus.fromJson(Map<String, dynamic> json) => PaymentStatus(
    paymentId: (json['paymentId'] ?? '').toString(),
    bookingId: (json['bookingId'] ?? '').toString(),
    provider: json['provider'] as String? ?? '',
    mode: json['mode'] as String? ?? '',
    status: json['status'] as String? ?? 'pending',
    paid: json['paid'] as bool? ?? false,
    terminal: json['terminal'] as bool? ?? false,
    message: json['message'] as String? ?? 'Payment is still pending.',
  );

  /// A browser redirect is never treated as proof of payment. Both the
  /// server's paid flag and a successful terminal state must agree.
  bool get isSucceeded {
    final normalized = status.toLowerCase();
    return paid &&
        terminal &&
        (normalized == 'succeeded' ||
            normalized == 'paid' ||
            normalized == 'completed');
  }

  bool get isCancelled => status.toLowerCase() == 'cancelled';

  bool get isFailed => terminal && !isSucceeded && !isCancelled;
}
