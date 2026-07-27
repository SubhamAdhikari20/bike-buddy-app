import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_theme.dart';
import '../../../core/constants/app_constants.dart';

/// Help screen with two large action cards - Phone and Chat - exactly as
/// the backlog asks (SUP-03). Both are reachable in two taps from
/// anywhere and sized well past the 48px minimum (Fitts's law).
class SupportPage extends StatelessWidget {
  const SupportPage({super.key});

  Future<void> _call(BuildContext context) async {
    if (!AppConstants.hasSupportPhone) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'No staffed support phone is configured in this coursework build.',
          ),
        ),
      );
      return;
    }
    final uri = Uri(scheme: 'tel', path: AppConstants.supportPhone);
    final ok = await canLaunchUrl(uri) && await launchUrl(uri);
    if (!ok && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Could not open the phone app. Number: ${AppConstants.supportPhone}',
          ),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;

    return Scaffold(
      appBar: AppBar(title: const Text('Help & Support')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(AppSpacing.lg),
          children: [
            Container(
              padding: const EdgeInsets.all(AppSpacing.md),
              decoration: BoxDecoration(
                color: AppColors.mint,
                borderRadius: BorderRadius.circular(AppRadius.medium),
              ),
              child: const Row(
                children: [
                  Icon(Icons.info_outline, color: AppColors.teal),
                  SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Text(
                      'For immediate danger, contact the appropriate local '
                      'emergency service. Bike Buddy support is not an '
                      'emergency-response service.',
                      style: TextStyle(fontWeight: FontWeight.w500),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.lg),

            // Two big equal cards: phone and chat (SUP-03).
            Card(
              clipBehavior: Clip.antiAlias,
              child: InkWell(
                onTap: () => _call(context),
                child: Padding(
                  padding: const EdgeInsets.all(AppSpacing.lg),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(AppSpacing.md),
                        decoration: const BoxDecoration(
                          color: AppColors.primaryLight,
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          Icons.call,
                          size: 32,
                          color: AppColors.primary,
                        ),
                      ),
                      const SizedBox(width: AppSpacing.md),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              AppConstants.hasSupportPhone
                                  ? 'Call Bike Buddy support'
                                  : 'Support phone not configured',
                              style: textTheme.titleLarge,
                            ),
                            const SizedBox(height: 2),
                            Text(
                              AppConstants.hasSupportPhone
                                  ? AppConstants.supportPhone
                                  : 'Configure SUPPORT_PHONE at build time',
                              style: textTheme.bodyLarge?.copyWith(
                                color: AppColors.primary,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const Icon(Icons.chevron_right),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            Card(
              clipBehavior: Clip.antiAlias,
              child: InkWell(
                onTap: () => context.push('/support/chat'),
                child: Padding(
                  padding: const EdgeInsets.all(AppSpacing.lg),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(AppSpacing.md),
                        decoration: const BoxDecoration(
                          color: AppColors.mint,
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          Icons.chat_bubble_outline,
                          size: 32,
                          color: AppColors.teal,
                        ),
                      ),
                      const SizedBox(width: AppSpacing.md),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Chat with support',
                              style: textTheme.titleLarge,
                            ),
                            const SizedBox(height: 2),
                            Text(
                              'Coursework preview — messages stay on this device',
                              style: textTheme.bodyMedium,
                            ),
                          ],
                        ),
                      ),
                      const Icon(Icons.chevron_right),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
