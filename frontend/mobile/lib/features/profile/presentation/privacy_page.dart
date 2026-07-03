import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_theme.dart';
import '../../../core/error/app_exception.dart';
import '../../auth/presentation/providers/auth_provider.dart';

/// Privacy overview and account deletion with an explicit confirmation
/// step (AUTH-05, transparency + user control).
class PrivacyPage extends ConsumerStatefulWidget {
  const PrivacyPage({super.key});

  @override
  ConsumerState<PrivacyPage> createState() => _PrivacyPageState();
}

class _PrivacyPageState extends ConsumerState<PrivacyPage> {
  bool _busy = false;

  Future<void> _confirmDelete() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.large)),
        icon: const Icon(Icons.warning_amber_rounded,
            size: 40, color: AppColors.error),
        title: const Text('Delete your account?'),
        content: const Text(
          'This removes your profile, ID document and history for good. '
          'It cannot be undone. A confirmation email will be sent once the data is removed.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Keep my account'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.error),
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Delete forever'),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    setState(() => _busy = true);
    try {
      await ref.read(authProvider.notifier).deleteAccount();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Your account and data were deleted.')),
        );
        context.go('/home');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e is AppException
                ? e.message
                : 'Could not delete the account. Please try again.'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;

    return Scaffold(
      appBar: AppBar(title: const Text('Privacy & Account')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(AppSpacing.lg),
          children: [
            Text('What we store', style: textTheme.titleLarge),
            const SizedBox(height: AppSpacing.sm),
            const _PrivacyRow(
              icon: Icons.person_outline,
              text: 'Your name, email and phone - to run your account.',
            ),
            const _PrivacyRow(
              icon: Icons.badge_outlined,
              text:
                  'Your ID photo - only to verify you once. Never shared with bike owners.',
            ),
            const _PrivacyRow(
              icon: Icons.location_on_outlined,
              text:
                  'Your location - only while you use the map. Never in the background.',
            ),
            const _PrivacyRow(
              icon: Icons.receipt_long_outlined,
              text: 'Your bookings and receipts - so you have proof of every ride.',
            ),
            const SizedBox(height: AppSpacing.lg),
            Text('Your controls', style: textTheme.titleLarge),
            const SizedBox(height: AppSpacing.sm),
            Card(
              child: ListTile(
                leading:
                    const Icon(Icons.delete_outline, color: AppColors.error),
                title: const Text('Delete account and data'),
                subtitle: const Text(
                    'Removes everything permanently. Confirmed by email.'),
                trailing: _busy
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.chevron_right),
                onTap: _busy ? null : _confirmDelete,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PrivacyRow extends StatelessWidget {
  final IconData icon;
  final String text;

  const _PrivacyRow({required this.icon, required this.text});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 20, color: AppColors.primary),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(text, style: Theme.of(context).textTheme.bodyMedium),
          ),
        ],
      ),
    );
  }
}
