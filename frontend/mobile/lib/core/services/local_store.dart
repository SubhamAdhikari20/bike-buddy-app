import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../constants/app_constants.dart';

/// Lightweight key-value storage for non-sensitive app state:
/// onboarding flag, recent searches (UI-07) and the crash-safe
/// booking draft (UI-06).
class LocalStore {
  LocalStore._();

  static late SharedPreferences _prefs;

  static const _kOnboardingSeen = 'onboarding_seen';
  static const _kRecentSearches = 'recent_searches';
  static const _kBookingDraft = 'booking_draft';
  static const _kThemeMode = 'theme_mode';

  static Future<void> init() async {
    _prefs = await SharedPreferences.getInstance();
  }

  // --- Onboarding (UI-02) ---

  static bool get onboardingSeen => _prefs.getBool(_kOnboardingSeen) ?? false;

  static Future<void> setOnboardingSeen(bool value) =>
      _prefs.setBool(_kOnboardingSeen, value);

  // --- Recent searches (UI-07) ---

  static List<String> get recentSearches =>
      _prefs.getStringList(_kRecentSearches) ?? const [];

  static Future<void> addRecentSearch(String term) async {
    final trimmed = term.trim();
    if (trimmed.isEmpty) return;
    final searches = [...recentSearches];
    searches.removeWhere((s) => s.toLowerCase() == trimmed.toLowerCase());
    searches.insert(0, trimmed);
    await _prefs.setStringList(_kRecentSearches, searches.take(8).toList());
  }

  static Future<void> clearRecentSearches() =>
      _prefs.remove(_kRecentSearches);

  // --- Booking draft for crash recovery (UI-06) ---

  static Future<void> saveBookingDraft(Map<String, dynamic> draft) async {
    draft['savedAt'] = DateTime.now().toIso8601String();
    await _prefs.setString(_kBookingDraft, jsonEncode(draft));
  }

  /// Returns the saved draft, or null when none exists or it is older
  /// than [AppConstants.bookingDraftMinutes].
  static Map<String, dynamic>? get bookingDraft {
    final raw = _prefs.getString(_kBookingDraft);
    if (raw == null) return null;
    try {
      final draft = jsonDecode(raw) as Map<String, dynamic>;
      final savedAt = DateTime.tryParse(draft['savedAt'] as String? ?? '');
      if (savedAt == null ||
          DateTime.now().difference(savedAt).inMinutes >
              AppConstants.bookingDraftMinutes) {
        _prefs.remove(_kBookingDraft);
        return null;
      }
      return draft;
    } catch (_) {
      _prefs.remove(_kBookingDraft);
      return null;
    }
  }

  static Future<void> clearBookingDraft() => _prefs.remove(_kBookingDraft);

  // --- Appearance (UI-05): system, light or dark ---

  static String get themeMode => _prefs.getString(_kThemeMode) ?? 'system';

  static Future<void> setThemeMode(String mode) =>
      _prefs.setString(_kThemeMode, mode);
}
