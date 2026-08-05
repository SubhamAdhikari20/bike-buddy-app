import 'package:bike_buddy/features/bookings/data/booking_model.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('active bookings follow ride start and return timestamps', () {
    final active = Booking.fromJson({
      '_id': 'booking-active',
      'bikeId': 'bike-1',
      'startDate': '2030-01-01T10:00:00.000Z',
      'endDate': '2030-01-01T12:00:00.000Z',
      'pickupLocation': 'Thamel',
      'status': 'confirmed',
      'paymentStatus': 'paid',
      'rideStartedAt': '2030-01-01T09:30:00.000Z',
      'totalAmount': 4200,
    });

    final returned = Booking.fromJson({
      '_id': 'booking-returned',
      'bikeId': 'bike-1',
      'startDate': '2030-01-01T10:00:00.000Z',
      'endDate': '2030-01-01T12:00:00.000Z',
      'pickupLocation': 'Thamel',
      'status': 'completed',
      'paymentStatus': 'paid',
      'rideStartedAt': '2030-01-01T09:30:00.000Z',
      'returnedAt': '2030-01-01T12:15:00.000Z',
      'totalAmount': 4200,
    });

    expect(active.hasStartedRide, isTrue);
    expect(active.isActive, isTrue);
    expect(active.isUpcoming, isFalse);
    expect(returned.hasReturnedRide, isTrue);
    expect(returned.isActive, isFalse);
    expect(returned.isPast, isTrue);
  });

  test('confirmed paid bookings are ready to start before handover begins', () {
    final ready = Booking.fromJson({
      '_id': 'booking-ready',
      'bikeId': 'bike-1',
      'startDate': '2030-01-01T10:00:00.000Z',
      'endDate': '2030-01-01T12:00:00.000Z',
      'pickupLocation': 'Thamel',
      'status': 'confirmed',
      'paymentStatus': 'paid',
      'totalAmount': 4200,
    });

    expect(ready.isRideReadyToStart, isTrue);
    expect(ready.isActive, isTrue);
    expect(ready.isUpcoming, isFalse);
  });
}
