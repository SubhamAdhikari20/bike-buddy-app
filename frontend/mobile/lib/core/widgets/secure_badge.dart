import 'package:flutter/material.dart';

import '../../app/theme/app_colors.dart';
import '../../app/theme/app_theme.dart';

/// "Secure & Encrypted" badge shown wherever money or personal data is
/// entered (TR-05). Tapping it explains the protection in plain words.
class SecureBadge extends StatelessWidget {
  const SecureBadge({super.key});

  void _showDetails(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.large)),
        icon: const Icon(Icons.lock, size: 40, color: AppColors.success),
        title: const Text('Your payment is protected'),
        content: const Text(
          'All payment details travel over an encrypted SSL connection. '
          'Bike Buddy never stores your wallet PIN or card number - payments '
          'are completed by eSewa or Khalti on their own secure pages.',
        ),
        actions: [
          ElevatedButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Got it'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () => _showDetails(context),
      borderRadius: BorderRadius.circular(AppRadius.pill),
      child: Container(
        padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md, vertical: AppSpacing.sm),
        decoration: BoxDecoration(
          color: AppColors.success.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(AppRadius.pill),
        ),
        child: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.lock, size: 16, color: AppColors.success),
            SizedBox(width: 6),
            Text(
              'Secure & Encrypted',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: AppColors.success,
              ),
            ),
            SizedBox(width: 4),
            Icon(Icons.info_outline, size: 14, color: AppColors.success),
          ],
        ),
      ),
    );
  }
}
