import 'package:intl/intl.dart';

/// Money and time formatting helpers. All money is Nepali Rupees and all
/// times shown to users are Nepal Standard Time (UTC+5:45).
class Formatters {
  Formatters._();

  static final _npr = NumberFormat('#,##0', 'en_US');

  static String npr(num amount) => 'NPR ${_npr.format(amount)}';

  static String nptTime(DateTime utc) {
    final npt = utc.toUtc().add(const Duration(hours: 5, minutes: 45));
    return DateFormat('d MMM yyyy, h:mm a').format(npt);
  }

  static String walkingMinutes(double distanceKm) {
    // Average walking speed ~5 km/h.
    final minutes = (distanceKm / 5 * 60).round();
    return minutes < 1 ? 'Less than 1 min walk' : '$minutes min walk';
  }
}
