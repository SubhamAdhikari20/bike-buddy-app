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
    final uri = Uri(scheme: 'tel', path: AppConstants.supportPhone);
    final ok = await canLaunchUrl(uri) && await launchUrl(uri);
    if (!ok && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Call us any time: ${AppConstants.supportPhone}'),
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
                  Icon(Icons.access_time_filled, color: AppColors.teal),
                  SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Text(
                      'We are available 24/7 - day rides, night rides, breakdowns.',
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
                        child: const Icon(Icons.call,
                            size: 32, color: AppColors.primary),
                      ),
                      const SizedBox(width: AppSpacing.md),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Call us now', style: textTheme.titleLarge),
                            const SizedBox(height: 2),
                            Text(
                              AppConstants.supportPhone,
                              style: textTheme.bodyLarge
                                  ?.copyWith(color: AppColors.primary),
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
                        child: const Icon(Icons.chat_bubble_outline,
                            size: 32, color: AppColors.teal),
                      ),
                      const SizedBox(width: AppSpacing.md),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Chat with support', style: textTheme.titleLarge),
                            const SizedBox(height: 2),
                            Text('Avg response: 5 min',
                                style: textTheme.bodyMedium),
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
