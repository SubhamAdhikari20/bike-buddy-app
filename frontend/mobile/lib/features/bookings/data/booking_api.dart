import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/api/api_endpoints.dart';
import '../../auth/presentation/providers/auth_provider.dart';
import 'booking_model.dart';

final bookingApiProvider = Provider<BookingApi>(
  (ref) => BookingApi(ref.watch(apiClientProvider)),
);

/// The signed-in renter's bookings.
final myBookingsProvider = FutureProvider<List<Booking>>((ref) async {
  final auth = await ref.watch(authProvider.future);
  if (auth == null) return const [];
  return ref.watch(bookingApiProvider).listMine();
});

class BookingApi {
  final ApiClient _client;

  BookingApi(this._client);

  Future<FareQuote> quote({
    required String bikeId,
    required DateTime start,
    required DateTime end,
  }) async {
    final res = await _client.post(
      ApiEndpoints.bookingQuote,
      authenticated: false,
      data: {
        'bikeId': bikeId,
        'startDate': start.toIso8601String(),
        'endDate': end.toIso8601String(),
      },
    );
    return FareQuote.fromJson((res['data'] as Map).cast<String, dynamic>());
  }

  Future<Map<String, dynamic>> availability(String bikeId) async {
    final res = await _client.get(
      ApiEndpoints.bookingAvailability(bikeId),
      authenticated: false,
    );
    return (res['data'] as Map).cast<String, dynamic>();
  }

  Future<Booking> create({
    required String bikeId,
    required DateTime start,
    required DateTime end,
    required String pickupLocation,
  }) async {
    final res = await _client.post(
      ApiEndpoints.bookings,
      data: {
        'bikeId': bikeId,
        'startDate': start.toIso8601String(),
        'endDate': end.toIso8601String(),
        'pickupLocation': pickupLocation,
      },
    );
    return Booking.fromJson((res['data'] as Map).cast<String, dynamic>());
  }

  Future<List<Booking>> listMine() async {
    final res = await _client.get(ApiEndpoints.bookings, query: {'limit': 50});
    final items = (res['data'] as List? ?? const []);
    return items
        .map((item) => Booking.fromJson((item as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<Booking> getBooking(String bookingId) async {
    final res = await _client.get(ApiEndpoints.booking(bookingId));
    return Booking.fromJson((res['data'] as Map).cast<String, dynamic>());
  }

  Future<List<BookingDamageReport>> myDamageReports() async {
    final res = await _client.get(ApiEndpoints.myDamageReports);
    final items = res['data'] as List? ?? const [];
    return items
        .map(
          (item) => BookingDamageReport.fromJson(
            (item as Map).cast<String, dynamic>(),
          ),
        )
        .toList(growable: false);
  }

  Future<Map<String, dynamic>> cancel(String bookingId, String reason) async {
    final res = await _client.patch(
      ApiEndpoints.cancelBooking(bookingId),
      data: {'reason': reason},
    );
    return (res['data'] as Map).cast<String, dynamic>();
  }

  Future<Map<String, dynamic>> confirmCash(String bookingId) async {
    final res = await _client.post(ApiEndpoints.confirmCashBooking(bookingId));
    return (res['data'] as Map).cast<String, dynamic>();
  }

  Future<Map<String, dynamic>> cancellationPolicy(String bookingId) async {
    final res = await _client.get(ApiEndpoints.cancellationPolicy(bookingId));
    return (res['data'] as Map).cast<String, dynamic>();
  }

  Future<void> reschedule(String bookingId, DateTime newStart) async {
    await _client.patch(
      ApiEndpoints.rescheduleBooking(bookingId),
      data: {'startDate': newStart.toIso8601String()},
    );
  }

  Future<PaymentIntent> initiatePayment({
    required String bookingId,
    required String provider,
  }) async {
    final res = await _client.post(
      ApiEndpoints.initiatePayment,
      data: {'bookingId': bookingId, 'provider': provider},
    );
    return PaymentIntent.fromJson((res['data'] as Map).cast<String, dynamic>());
  }

  Future<PaymentStatus> paymentStatus(String paymentId) async {
    final res = await _client.get(ApiEndpoints.paymentStatus(paymentId));
    return PaymentStatus.fromJson((res['data'] as Map).cast<String, dynamic>());
  }

  Future<Map<String, dynamic>> confirmDemoPayment({
    required String paymentId,
    required bool success,
  }) async {
    final res = await _client.post(
      ApiEndpoints.confirmDemoPayment(paymentId),
      data: {'outcome': success ? 'succeeded' : 'failed'},
    );
    return (res['data'] as Map).cast<String, dynamic>();
  }

  Future<void> submitChecklist({
    required String bookingId,
    required List<Map<String, dynamic>> items,
    List<String> photos = const [],
    required bool acknowledged,
  }) async {
    await _client.post(
      ApiEndpoints.bookingChecklist(bookingId),
      data: {'items': items, 'photos': photos, 'acknowledged': acknowledged},
    );
  }

  Future<Map<String, dynamic>> returnPreview(String bookingId) async {
    final res = await _client.get(ApiEndpoints.bookingReturnPreview(bookingId));
    return (res['data'] as Map).cast<String, dynamic>();
  }

  Future<Map<String, dynamic>> extend(String bookingId, int extraHours) async {
    final res = await _client.patch(
      ApiEndpoints.extendBooking(bookingId),
      data: {'extraHours': extraHours},
    );
    return (res['data'] as Map).cast<String, dynamic>();
  }

  Future<Map<String, dynamic>> returnBike(String bookingId) async {
    final res = await _client.post(ApiEndpoints.returnBooking(bookingId));
    return (res['data'] as Map).cast<String, dynamic>();
  }

  Future<void> reportDamage({
    required String bookingId,
    required List<String> photos,
    required String description,
  }) async {
    await _client.post(
      ApiEndpoints.damageReports,
      data: {
        'bookingId': bookingId,
        'photos': photos,
        'description': description,
      },
    );
  }

  Future<Map<String, dynamic>> sendSos({
    String? bookingId,
    double? latitude,
    double? longitude,
  }) async {
    final res = await _client.post(
      ApiEndpoints.sos,
      data: {
        if (bookingId != null) 'bookingId': bookingId,
        if (latitude != null) 'latitude': latitude,
        if (longitude != null) 'longitude': longitude,
      },
    );
    return (res['data'] as Map).cast<String, dynamic>();
  }

  String receiptPdfUrl(String bookingId) =>
      ApiEndpoints.bookingReceiptUrl(bookingId);

  Future<List<int>> downloadReceiptPdf(String bookingId) async {
    final response = await _client.dio.get<List<int>>(
      ApiEndpoints.bookingReceipt(bookingId),
      options: Options(responseType: ResponseType.bytes),
    );
    return response.data ?? const [];
  }
}
