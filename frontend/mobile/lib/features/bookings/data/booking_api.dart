import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/constants/app_constants.dart';
import 'booking_model.dart';

final bookingApiProvider = Provider<BookingApi>(
  (ref) => BookingApi(ref.watch(apiClientProvider)),
);

/// The signed-in user's bookings.
final myBookingsProvider = FutureProvider<List<Booking>>((ref) {
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
    final res = await _client.post('/bookings/quote', data: {
      'bikeId': bikeId,
      'startDate': start.toIso8601String(),
      'endDate': end.toIso8601String(),
    });
    return FareQuote.fromJson((res['data'] as Map).cast<String, dynamic>());
  }

  Future<Map<String, dynamic>> availability(String bikeId) async {
    final res = await _client.get('/bookings/availability/$bikeId');
    return (res['data'] as Map).cast<String, dynamic>();
  }

  Future<Booking> create({
    required String bikeId,
    required DateTime start,
    required DateTime end,
    required String pickupLocation,
  }) async {
    final res = await _client.post('/bookings', data: {
      'bikeId': bikeId,
      'startDate': start.toIso8601String(),
      'endDate': end.toIso8601String(),
      'pickupLocation': pickupLocation,
    });
    return Booking.fromJson((res['data'] as Map).cast<String, dynamic>());
  }

  Future<List<Booking>> listMine() async {
    final res = await _client.get('/bookings', query: {'limit': 50});
    final items = (res['data'] as List? ?? const []);
    return items
        .map((item) => Booking.fromJson((item as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<Booking> getBooking(String bookingId) async {
    final res = await _client.get('/bookings/$bookingId');
    return Booking.fromJson((res['data'] as Map).cast<String, dynamic>());
  }

  Future<void> cancel(String bookingId, String reason) async {
    await _client.patch('/bookings/$bookingId/cancel', data: {'reason': reason});
  }

  Future<PaymentIntent> initiatePayment({
    required String bookingId,
    required String provider,
  }) async {
    final res = await _client.post('/payments/initiate', data: {
      'bookingId': bookingId,
      'provider': provider,
    });
    return PaymentIntent.fromJson((res['data'] as Map).cast<String, dynamic>());
  }

  Future<Map<String, dynamic>> verifyPayment({
    required String paymentId,
    required bool success,
    String? gatewayMessage,
  }) async {
    final res = await _client.post('/payments/$paymentId/verify', data: {
      'status': success ? 'succeeded' : 'failed',
      'gatewayMessage': ?gatewayMessage,
    });
    return (res['data'] as Map).cast<String, dynamic>();
  }

  String receiptPdfUrl(String bookingId) =>
      '${AppConstants.apiBaseUrl}/bookings/$bookingId/receipt.pdf';

  Future<List<int>> downloadReceiptPdf(String bookingId) async {
    final response = await _client.dio.get<List<int>>(
      '/bookings/$bookingId/receipt.pdf',
      options: Options(responseType: ResponseType.bytes),
    );
    return response.data ?? const [];
  }
}
