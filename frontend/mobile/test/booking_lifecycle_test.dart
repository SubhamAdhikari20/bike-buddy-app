import 'package:bike_buddy/core/api/api_client.dart';
import 'package:bike_buddy/features/bookings/data/booking_model.dart';
import 'package:bike_buddy/features/bookings/data/booking_api.dart';
import 'package:bike_buddy/features/auth/presentation/providers/auth_provider.dart';
import 'package:bike_buddy/features/auth/data/session_user.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

class _FakeBookingApi extends BookingApi {
  _FakeBookingApi() : super(ApiClient());

  int listMineCalls = 0;
  List<Booking> bookings = const [];

  @override
  Future<List<Booking>> listMine() async {
    listMineCalls += 1;
    return bookings;
  }
}

class _StaticAuthNotifier extends AuthNotifier {
  _StaticAuthNotifier(this._user);

  final SessionUser? _user;

  @override
  Future<SessionUser?> build() async => _user;
}

void main() {
  test('guest sessions do not fetch bookings', () async {
    final fakeApi = _FakeBookingApi();
    final container = ProviderContainer(
      overrides: [
        authProvider.overrideWith(() => _StaticAuthNotifier(null)),
        bookingApiProvider.overrideWithValue(fakeApi),
      ],
    );
    addTearDown(container.dispose);

    final bookings = await container.read(myBookingsProvider.future);

    expect(bookings, isEmpty);
    expect(fakeApi.listMineCalls, 0);
  });

  test(
    'signed-in renters fetch their bookings through the active session',
    () async {
      final fakeApi = _FakeBookingApi()
        ..bookings = [
          Booking.fromJson({
            '_id': 'booking-session',
            'bikeId': 'bike-1',
            'startDate': '2030-01-01T10:00:00.000Z',
            'endDate': '2030-01-01T12:00:00.000Z',
            'pickupLocation': 'Thamel',
            'status': 'confirmed',
            'paymentStatus': 'paid',
            'totalAmount': 4200,
          }),
        ];
      final container = ProviderContainer(
        overrides: [
          authProvider.overrideWith(
            () => _StaticAuthNotifier(
              const SessionUser(
                id: 'user-1',
                email: 'renter@example.com',
                role: 'renter',
                isVerified: true,
                fullName: 'Renter One',
              ),
            ),
          ),
          bookingApiProvider.overrideWithValue(fakeApi),
        ],
      );
      addTearDown(container.dispose);

      final bookings = await container.read(myBookingsProvider.future);

      expect(bookings, hasLength(1));
      expect(bookings.single.id, 'booking-session');
      expect(fakeApi.listMineCalls, 1);
    },
  );

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
