import 'package:flutter_test/flutter_test.dart';

import 'package:bike_buddy/core/api/api_endpoints.dart';

void main() {
  test('server and API base URLs remain separate and normalized', () {
    expect(ApiEndpoints.serverUrl.endsWith('/'), isFalse);
    expect(ApiEndpoints.baseUrl, '${ApiEndpoints.serverUrl}/api/v1');
    expect(ApiEndpoints.mediaServerUrl, ApiEndpoints.serverUrl);
    expect(ApiEndpoints.healthUrl, '${ApiEndpoints.serverUrl}/health');
  });

  test('copied API origins normalize without crashing app startup', () {
    expect(
      ApiEndpoints.normalizeServerOrigin(' http://192.168.1.73:5050/ '),
      'http://192.168.1.73:5050',
    );
    expect(
      ApiEndpoints.normalizeServerOrigin('http://192.168.1.73:5050/api/v1'),
      'http://192.168.1.73:5050',
    );
    expect(
      ApiEndpoints.normalizeServerOrigin('http://localhost:5050/other'),
      isNull,
    );
    expect(
      ApiEndpoints.normalizeServerOrigin('http://user:password@localhost:5050'),
      isNull,
    );
    expect(
      ApiEndpoints.normalizeServerOrigin('http://localhost:99999'),
      isNull,
    );
  });

  test('dynamic endpoint builders encode untrusted path segments', () {
    expect(ApiEndpoints.bike('bike/one'), '/bikes/bike%2Fone');
    expect(
      ApiEndpoints.markNotificationRead('notice one'),
      '/notifications/notice%20one/read',
    );
    expect(
      ApiEndpoints.bookingReceiptUrl('booking one'),
      '${ApiEndpoints.baseUrl}/bookings/booking%20one/receipt.pdf',
    );
    expect(ApiEndpoints.upload('bike'), ApiEndpoints.uploadBike);
    expect(
      ApiEndpoints.protectedEvidenceMedia('damage one.png'),
      '/uploads/evidence/damage%20one.png',
    );
    expect(() => ApiEndpoints.upload('unknown'), throwsArgumentError);
  });

  test('provider return URLs are recognised, checkout URLs are not', () {
    final server = Uri.parse(ApiEndpoints.serverUrl);
    Uri onServer(String path) => server.replace(path: path);

    expect(
      ApiEndpoints.isPaymentCallbackUrl(onServer('/api/v1/payments/callback/khalti')),
      isTrue,
    );
    expect(
      ApiEndpoints.isPaymentCallbackUrl(
        onServer('/api/v1/payments/callback/esewa/BB-1'),
      ),
      isTrue,
    );
    // The eSewa bridge lives on the same origin; closing the checkout view on
    // it would abort the payment before the provider ever saw it.
    expect(
      ApiEndpoints.isPaymentCallbackUrl(
        onServer('/api/v1/payments/checkout/esewa/abc'),
      ),
      isFalse,
    );
    expect(
      ApiEndpoints.isPaymentCallbackUrl(
        Uri.parse('https://evil.example/api/v1/payments/callback/khalti'),
      ),
      isFalse,
    );

    expect(
      ApiEndpoints.isPaymentCancelledCallbackUrl(
        onServer('/api/v1/payments/callback/esewa/BB-1/failure'),
      ),
      isTrue,
    );
    expect(
      ApiEndpoints.isPaymentCancelledCallbackUrl(
        onServer(
          '/api/v1/payments/callback/khalti',
        ).replace(queryParameters: {'status': 'User canceled'}),
      ),
      isTrue,
    );
    expect(
      ApiEndpoints.isPaymentCancelledCallbackUrl(
        onServer(
          '/api/v1/payments/callback/khalti',
        ).replace(queryParameters: {'status': 'Completed'}),
      ),
      isFalse,
    );
  });

  test('checkout URLs allow HTTPS and only configured local HTTP', () {
    final local = Uri.parse(ApiEndpoints.serverUrl);
    final rewritten = ApiEndpoints.trustedCheckoutUri(
      'http://localhost:5050/api/v1/payments/demo',
    );

    expect(rewritten, isNotNull);
    expect(rewritten!.host, local.host);
    expect(rewritten.port, local.port);
    expect(
      ApiEndpoints.trustedCheckoutUri('https://test-pay.khalti.example/pay'),
      Uri.parse('https://test-pay.khalti.example/pay'),
    );
    expect(
      ApiEndpoints.trustedCheckoutUri('http://wallet.example/pay'),
      isNull,
    );
    expect(ApiEndpoints.trustedCheckoutUri('javascript:alert(1)'), isNull);
  });
}
