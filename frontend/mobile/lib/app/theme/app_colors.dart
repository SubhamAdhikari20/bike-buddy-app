import 'package:flutter/material.dart';

/// Bike Buddy colour palette. Trustworthy blue with a warm orange accent
/// reserved for safety-critical actions (SOS, warnings).
class AppColors {
  AppColors._();

  static const Color primary = Color(0xFF1A56DB);
  static const Color primaryLight = Color(0xFFEBF5FF);

  /// Amber used for the main call-to-action buttons (from the prototype
  /// design system's "Action" colour).
  static const Color action = Color(0xFFF59E0B);

  /// Reserved for SOS and safety-critical warnings only.
  static const Color accent = Color(0xFFF05A22);

  /// Mint highlight for the selected nav tab and active chips.
  static const Color mint = Color(0xFFA7F3D0);
  static const Color teal = Color(0xFF0D9488);

  static const Color success = Color(0xFF0E9F6E);
  static const Color warning = Color(0xFFE3A008);
  static const Color error = Color(0xFFF05252);

  static const Color surface = Color(0xFFFFFFFF);
  static const Color background = Color(0xFFF9FAFB);
  static const Color cardBg = Color(0xFFFFFFFF);

  static const Color textPrimary = Color(0xFF111928);
  static const Color textSecondary = Color(0xFF6B7280);
  static const Color textMuted = Color(0xFF9CA3AF);
  static const Color divider = Color(0xFFE5E7EB);

  // Dark mode (Sprint 5)
  static const Color darkBackground = Color(0xFF111827);
  static const Color darkSurface = Color(0xFF1F2937);
  static const Color darkCard = Color(0xFF374151);
}
