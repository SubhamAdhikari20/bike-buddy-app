import 'package:flutter/material.dart';

import '../../app/theme/app_colors.dart';
import '../../app/theme/app_theme.dart';

/// Explains the current checkout mode without implying a live provider
/// integration or asking the rider to trust an unsupported security claim.
class SecureBadge extends StatelessWidget {
  const SecureBadge({super.key});

  void _showDetails(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.large),
        ),
        icon: const Icon(
          Icons.science_outlined,
          size: 40,
          color: AppColors.warning,
        ),
        title: const Text('Coursework demo mode'),
        content: const Text(
          'This build simulates an eSewa or Khalti result without contacting '
          'either provider. It never asks for a wallet PIN and no money is '
          'charged. Live payments stay disabled until a verified server-side '
          'provider adapter and merchant credentials are configured.',
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
          horizontal: AppSpacing.md,
          vertical: AppSpacing.sm,
        ),
        decoration: BoxDecoration(
          color: AppColors.warning.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(AppRadius.pill),
        ),
        child: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.science_outlined, size: 16, color: AppColors.warning),
            SizedBox(width: 6),
            Text(
              'Demo mode',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: AppColors.warning,
              ),
            ),
            SizedBox(width: 4),
            Icon(Icons.info_outline, size: 14, color: AppColors.warning),
          ],
        ),
      ),
    );
  }
}
