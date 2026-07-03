import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/app.dart';
import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_theme.dart';
import '../../../core/services/local_store.dart';
import '../../auth/presentation/providers/auth_provider.dart';

/// Profile tab: account header, ID verification status, and clearly
/// grouped settings. Support stays two taps away at most (SUP-03).
class ProfileTab extends ConsumerWidget {
  const ProfileTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final textTheme = Theme.of(context).textTheme;
    final auth = ref.watch(authProvider).valueOrNull;

    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(AppSpacing.md),
        children: [
          Text('Profile', style: textTheme.displayLarge),
          const SizedBox(height: AppSpacing.md),

          if (auth == null)
            Card(
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.lg),
                child: Column(
                  children: [
                    const Icon(Icons.person_outline,
                        size: 48, color: AppColors.primary),
                    const SizedBox(height: AppSpacing.sm),
                    Text('You are browsing as a guest',
                        style: textTheme.titleMedium),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      'Sign in to book bikes, track rentals and get support faster.',
                      style: textTheme.bodyMedium,
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: AppSpacing.md),
                    ElevatedButton(
                      onPressed: () => context.push('/auth'),
                      child: const Text('Sign In or Create Account'),
                    ),
                  ],
                ),
              ),
            )
          else ...[
            Card(
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.md),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 28,
                      backgroundColor: AppColors.primaryLight,
                      backgroundImage: auth.profilePictureUrl != null
                          ? CachedNetworkImageProvider(auth.profilePictureUrl!)
                          : null,
                      child: auth.profilePictureUrl == null
                          ? const Icon(Icons.person, color: AppColors.primary)
                          : null,
                    ),
                    const SizedBox(width: AppSpacing.md),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            auth.fullName.isEmpty ? 'Bike Buddy user' : auth.fullName,
                            style: textTheme.titleMedium,
                          ),
                          Text(auth.email, style: textTheme.bodyMedium),
                          const SizedBox(height: 4),
                          _KycChip(status: auth.kycStatus),
                        ],
                      ),
                    ),
                    IconButton(
                      tooltip: 'Edit profile',
                      onPressed: () => context.push('/profile/edit'),
                      icon: const Icon(Icons.edit_outlined),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            if (auth.isRenter && !auth.isKycApproved)
              Card(
                color: auth.isKycPending
                    ? AppColors.primaryLight
                    : const Color(0xFFFFF7E6),
                child: ListTile(
                  leading: Icon(
                    auth.isKycPending
                        ? Icons.hourglass_top
                        : Icons.badge_outlined,
                    color: auth.isKycPending
                        ? AppColors.primary
                        : AppColors.warning,
                  ),
                  title: Text(
                    auth.isKycPending
                        ? 'ID under review'
                        : 'Verify your ID to book bikes',
                  ),
                  subtitle: Text(
                    auth.isKycPending
                        ? 'We usually finish within 24 hours. We will notify you.'
                        : 'Takes about 2 minutes. You only do this once.',
                  ),
                  trailing: auth.isKycPending
                      ? null
                      : const Icon(Icons.chevron_right),
                  onTap:
                      auth.isKycPending ? null : () => context.push('/verify-id'),
                ),
              ),
          ],
          const SizedBox(height: AppSpacing.md),

          // Grouped settings (law of proximity).
          Card(
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.support_agent, color: AppColors.primary),
                  title: const Text('Help & Support'),
                  subtitle: const Text('24/7 phone and chat'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push('/support'),
                ),
                const Divider(height: 1),
                ListTile(
                  leading: const Icon(Icons.replay, color: AppColors.primary),
                  title: const Text('Replay the quick tour'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push('/onboarding'),
                ),
                if (auth != null) ...[
                  const Divider(height: 1),
                  ListTile(
                    leading: const Icon(Icons.confirmation_number_outlined,
                        color: AppColors.primary),
                    title: const Text('My Support Tickets'),
                    subtitle: const Text('Track your reported issues'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => context.push('/support/tickets'),
                  ),
                  const Divider(height: 1),
                  ListTile(
                    leading: const Icon(Icons.privacy_tip_outlined,
                        color: AppColors.primary),
                    title: const Text('Privacy & Account'),
                    subtitle: const Text('Your data, downloads and deletion'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => context.push('/profile/privacy'),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.md),

          // Appearance: system, light or dark (UI-05).
          Card(
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.dark_mode_outlined,
                          color: AppColors.primary),
                      const SizedBox(width: AppSpacing.sm),
                      Text('Appearance', style: textTheme.titleMedium),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  SegmentedButton<ThemeMode>(
                    segments: const [
                      ButtonSegment(
                          value: ThemeMode.system,
                          icon: Icon(Icons.brightness_auto, size: 18),
                          label: Text('System')),
                      ButtonSegment(
                          value: ThemeMode.light,
                          icon: Icon(Icons.light_mode, size: 18),
                          label: Text('Light')),
                      ButtonSegment(
                          value: ThemeMode.dark,
                          icon: Icon(Icons.dark_mode, size: 18),
                          label: Text('Dark')),
                    ],
                    selected: {ref.watch(themeModeProvider)},
                    showSelectedIcon: false,
                    onSelectionChanged: (selection) {
                      final mode = selection.first;
                      ref.read(themeModeProvider.notifier).state = mode;
                      LocalStore.setThemeMode(switch (mode) {
                        ThemeMode.light => 'light',
                        ThemeMode.dark => 'dark',
                        _ => 'system',
                      });
                    },
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.md),

          if (auth != null)
            OutlinedButton.icon(
              onPressed: () async {
                await ref.read(authProvider.notifier).logout();
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Signed out. See you soon!')),
                  );
                }
              },
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.error,
                side: const BorderSide(color: AppColors.error),
              ),
              icon: const Icon(Icons.logout),
              label: const Text('Sign Out'),
            ),
          const SizedBox(height: AppSpacing.xxl),
        ],
      ),
    );
  }
}

class _KycChip extends StatelessWidget {
  final String status;

  const _KycChip({required this.status});

  @override
  Widget build(BuildContext context) {
    final (label, color) = switch (status) {
      'approved' => ('ID Verified', AppColors.success),
      'pending' => ('ID Under Review', AppColors.warning),
      'rejected' => ('ID Rejected - resubmit', AppColors.error),
      _ => ('ID Not Verified', AppColors.textMuted),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(AppRadius.pill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            status == 'approved' ? Icons.verified : Icons.info_outline,
            size: 13,
            color: color,
          ),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
                fontSize: 11, color: color, fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }
}
