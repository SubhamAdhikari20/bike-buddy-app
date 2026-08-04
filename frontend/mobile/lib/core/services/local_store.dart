import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../constants/app_constants.dart';

/// Lightweight key-value storage for non-sensitive app state:
/// onboarding flag, recent searches (UI-07) and the crash-safe
/// booking draft (UI-06).
class LocalStore {
  LocalStore._();

  static SharedPreferences? _prefs;
  static final Map<String, Object> _memory = {};
  static final Set<String> _removedKeys = {};
  static int _initializationGeneration = 0;

  static const _kOnboardingSeen = 'onboarding_seen';
  static const _kRecentSearches = 'recent_searches';
  static const _kBookingDraft = 'booking_draft';
  static const _kThemeMode = 'theme_mode';
  static const _kNotificationSequences = 'notification_sequences';

  static Future<void> init() async {
    final generation = ++_initializationGeneration;
    final preferences = await SharedPreferences.getInstance();
    if (generation != _initializationGeneration) return;
    _prefs = preferences;
    _memory.clear();
    _removedKeys.clear();
  }

  /// Invalidates any still-running platform initialization and switches every
  /// preference operation to a safe in-memory implementation.
  static void useInMemoryFallback() {
    _initializationGeneration += 1;
    _prefs = null;
  }

  static Object? _value(String key) {
    if (_memory.containsKey(key)) return _memory[key];
    if (_removedKeys.contains(key)) return null;
    return _prefs?.get(key);
  }

  static Future<void> _write(
    String key,
    Object value,
    Future<bool> Function(SharedPreferences preferences) persist,
  ) async {
    _memory[key] = value;
    _removedKeys.remove(key);
    final preferences = _prefs;
    if (preferences == null) return;
    try {
      await persist(preferences);
    } catch (_) {
      // The in-memory value remains authoritative for this process.
    }
  }

  static Future<void> _remove(String key) async {
    _memory.remove(key);
    _removedKeys.add(key);
    final preferences = _prefs;
    if (preferences == null) return;
    try {
      await preferences.remove(key);
    } catch (_) {
      // The in-memory tombstone prevents a failed delete from resurfacing.
    }
  }

  // --- Onboarding (UI-02) ---

  static bool get onboardingSeen => _value(_kOnboardingSeen) as bool? ?? false;

  static Future<void> setOnboardingSeen(bool value) => _write(
    _kOnboardingSeen,
    value,
    (prefs) => prefs.setBool(_kOnboardingSeen, value),
  );

  // --- Recent searches (UI-07) ---

  static List<String> get recentSearches =>
      List<String>.from(_value(_kRecentSearches) as List<String>? ?? const []);

  static Future<void> addRecentSearch(String term) async {
    final trimmed = term.trim();
    if (trimmed.isEmpty) return;
    final searches = [...recentSearches];
    searches.removeWhere((s) => s.toLowerCase() == trimmed.toLowerCase());
    searches.insert(0, trimmed);
    final updated = searches.take(8).toList(growable: false);
    await _write(
      _kRecentSearches,
      updated,
      (prefs) => prefs.setStringList(_kRecentSearches, updated),
    );
  }

  static Future<void> clearRecentSearches() => _remove(_kRecentSearches);

  // --- Booking draft for crash recovery (UI-06) ---

  static Future<void> saveBookingDraft(Map<String, dynamic> draft) async {
    draft['savedAt'] = DateTime.now().toIso8601String();
    final encoded = jsonEncode(draft);
    await _write(
      _kBookingDraft,
      encoded,
      (prefs) => prefs.setString(_kBookingDraft, encoded),
    );
  }

  /// Returns the saved draft, or null when none exists or it is older
  /// than [AppConstants.bookingDraftMinutes].
  static Map<String, dynamic>? get bookingDraft {
    final raw = _value(_kBookingDraft) as String?;
    if (raw == null) return null;
    try {
      final draft = jsonDecode(raw) as Map<String, dynamic>;
      final savedAt = DateTime.tryParse(draft['savedAt'] as String? ?? '');
      if (savedAt == null ||
          DateTime.now().difference(savedAt).inMinutes >
              AppConstants.bookingDraftMinutes) {
        _remove(_kBookingDraft);
        return null;
      }
      return draft;
    } catch (_) {
      _remove(_kBookingDraft);
      return null;
    }
  }

  static Future<void> clearBookingDraft() => _remove(_kBookingDraft);

  // --- Appearance (UI-05): system, light or dark ---

  static String get themeMode => _value(_kThemeMode) as String? ?? 'system';

  static Future<void> setThemeMode(String mode) =>
      _write(_kThemeMode, mode, (prefs) => prefs.setString(_kThemeMode, mode));

  // --- Foreground notification stream resume cursor ---

  /// Last SSE sequence accepted for each signed-in renter. Keeping this
  /// per-account prevents a shared device from applying one renter's cursor
  /// to another renter's notification stream.
  static int? notificationLastSequence(String userId) {
    final raw = _value(_kNotificationSequences) as String?;
    if (raw == null) return null;
    try {
      final values = (jsonDecode(raw) as Map).cast<String, dynamic>();
      return (values[userId] as num?)?.toInt();
    } catch (_) {
      return null;
    }
  }

  static Future<void> setNotificationLastSequence(
    String userId,
    int sequence,
  ) async {
    if (userId.isEmpty || sequence <= 0) return;

    final values = <String, dynamic>{};
    final raw = _value(_kNotificationSequences) as String?;
    if (raw != null) {
      try {
        values.addAll((jsonDecode(raw) as Map).cast<String, dynamic>());
      } catch (_) {
        // A malformed non-sensitive cursor cache can safely be replaced.
      }
    }

    final previous = (values[userId] as num?)?.toInt() ?? 0;
    if (sequence <= previous) return;
    values[userId] = sequence;
    final encoded = jsonEncode(values);
    await _write(
      _kNotificationSequences,
      encoded,
      (prefs) => prefs.setString(_kNotificationSequences, encoded),
    );
  }
}
