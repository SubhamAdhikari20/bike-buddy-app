/// A user-presentable error. Every API failure is converted into one of
/// these so screens can show a plain-language message (H9, error recovery).
class AppException implements Exception {
  final String message;
  final int? statusCode;
  final String? code;

  const AppException(this.message, {this.statusCode, this.code});

  bool get isNetworkError => statusCode == null;
  bool get isAuthError => statusCode == 401 || statusCode == 403;

  @override
  String toString() => message;
}
