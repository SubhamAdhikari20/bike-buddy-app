import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../app/theme/app_theme.dart';
import '../../../../core/error/app_exception.dart';
import '../../../../core/services/permission_service.dart';
import '../providers/auth_provider.dart';

/// ID verification explained in three visible steps with a progress bar
/// (AUTH-02, H1). A plain-language data-use note appears before the
/// camera opens (TR-03, transparency).
class IdVerificationPage extends ConsumerStatefulWidget {
  const IdVerificationPage({super.key});

  @override
  ConsumerState<IdVerificationPage> createState() => _IdVerificationPageState();
}

class _IdVerificationPageState extends ConsumerState<IdVerificationPage> {
  int _step = 0; // 0 = how it works, 1 = take photo, 2 = review & submit
  XFile? _photo;
  bool _busy = false;
  bool _submitted = false;

  /// Plain-language data-use summary shown before the camera opens
  /// (TR-03, transparency principle).
  Future<bool> _confirmDataUse() async {
    final agreed = await showModalBottomSheet<bool>(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius:
            BorderRadius.vertical(top: Radius.circular(AppRadius.large)),
      ),
      builder: (context) => Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Before you take the photo',
                style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: AppSpacing.md),
            const _StepRow(
              icon: Icons.visibility_outlined,
              title: 'Who sees it',
              subtitle:
                  'Only the Bike Buddy verification team. Never bike owners, never other users.',
            ),
            const _StepRow(
              icon: Icons.storage_outlined,
              title: 'How it is stored',
              subtitle:
                  'Encrypted on our servers and used only to confirm your identity once.',
            ),
            const _StepRow(
              icon: Icons.delete_outline,
              title: 'Your control',
              subtitle:
                  'Delete your account any time and the ID photo is removed with it.',
            ),
            const SizedBox(height: AppSpacing.sm),
            ElevatedButton(
              onPressed: () => Navigator.of(context).pop(true),
              child: const Text('I understand, continue'),
            ),
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text('Not now'),
            ),
          ],
        ),
      ),
    );
    return agreed == true;
  }

  Future<void> _capture(ImageSource source) async {
    final consented = await _confirmDataUse();
    if (!consented || !mounted) return;

    if (source == ImageSource.camera) {
      final granted = await PermissionService.requestCamera(context);
      if (!granted) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text(
                  'Camera not allowed. You can also pick a photo from your gallery.'),
            ),
          );
        }
        return;
      }
    }

    final picker = ImagePicker();
    final photo =
        await picker.pickImage(source: source, maxWidth: 1600, imageQuality: 85);
    if (photo != null && mounted) {
      setState(() {
        _photo = photo;
        _step = 2;
      });
    }
  }

  Future<void> _submit() async {
    if (_photo == null) return;
    setState(() => _busy = true);
    try {
      final notifier = ref.read(authProvider.notifier);
      final url = await notifier.uploadImage(_photo!.path);
      await notifier.submitKyc(url);
      if (mounted) setState(() => _submitted = true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e is AppException
                ? e.message
                : 'Could not submit your ID. Please try again.'),
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

    if (_submitted) {
      return Scaffold(
        appBar: AppBar(title: const Text('ID Verification')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  padding: const EdgeInsets.all(AppSpacing.lg),
                  decoration: const BoxDecoration(
                    color: AppColors.primaryLight,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.hourglass_top,
                      size: 48, color: AppColors.primary),
                ),
                const SizedBox(height: AppSpacing.md),
                Text('ID submitted - under review', style: textTheme.titleLarge),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  'We usually finish the check within 24 hours and will notify you as soon as it is done.',
                  style: textTheme.bodyMedium,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: AppSpacing.lg),
                SizedBox(
                  width: 200,
                  child: ElevatedButton(
                    onPressed: () => context.go('/home?tab=3'),
                    child: const Text('Done'),
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('ID Verification')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Step progress bar (H1 - always show where you are).
              Row(
                children: List.generate(3, (index) {
                  final active = index <= _step;
                  return Expanded(
                    child: Container(
                      margin: EdgeInsets.only(right: index < 2 ? AppSpacing.sm : 0),
                      height: 6,
                      decoration: BoxDecoration(
                        color: active ? AppColors.primary : AppColors.divider,
                        borderRadius: BorderRadius.circular(AppRadius.pill),
                      ),
                    ),
                  );
                }),
              ),
              const SizedBox(height: AppSpacing.xs),
              Text('Step ${_step + 1} of 3', style: textTheme.labelSmall),
              const SizedBox(height: AppSpacing.lg),
              Expanded(child: _buildStep(textTheme)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStep(TextTheme textTheme) {
    switch (_step) {
      case 0:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('How it works', style: textTheme.titleLarge),
            const SizedBox(height: AppSpacing.md),
            const _StepRow(
              icon: Icons.photo_camera_outlined,
              title: 'Take one photo',
              subtitle: 'Citizenship card, licence or passport - any one works.',
            ),
            const _StepRow(
              icon: Icons.lock_outline,
              title: 'Stored securely',
              subtitle:
                  'Your ID is encrypted, used only to confirm who you are, and never shared with owners.',
            ),
            const _StepRow(
              icon: Icons.check_circle_outline,
              title: 'Reviewed within 24 hours',
              subtitle: 'We notify you the moment your ID is approved.',
            ),
            const Spacer(),
            ElevatedButton(
              onPressed: () => setState(() => _step = 1),
              child: const Text('Start'),
            ),
          ],
        );
      case 1:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Take a photo of your ID', style: textTheme.titleLarge),
            const SizedBox(height: AppSpacing.sm),
            Text(
              'Place the ID on a flat surface with good light. Make sure all four corners are visible.',
              style: textTheme.bodyMedium,
            ),
            const SizedBox(height: AppSpacing.lg),
            AspectRatio(
              aspectRatio: 16 / 10,
              child: Container(
                decoration: BoxDecoration(
                  color: AppColors.primaryLight,
                  borderRadius: BorderRadius.circular(AppRadius.large),
                  border: Border.all(color: AppColors.primary, width: 2),
                ),
                child: const Icon(Icons.badge_outlined,
                    size: 72, color: AppColors.primary),
              ),
            ),
            const Spacer(),
            ElevatedButton.icon(
              onPressed: () => _capture(ImageSource.camera),
              icon: const Icon(Icons.photo_camera_outlined),
              label: const Text('Open Camera'),
            ),
            const SizedBox(height: AppSpacing.sm),
            OutlinedButton.icon(
              onPressed: () => _capture(ImageSource.gallery),
              icon: const Icon(Icons.photo_library_outlined),
              label: const Text('Choose from Gallery'),
            ),
          ],
        );
      default:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Check your photo', style: textTheme.titleLarge),
            const SizedBox(height: AppSpacing.sm),
            Text(
              'Is every detail readable? If not, retake it - blurry photos get rejected.',
              style: textTheme.bodyMedium,
            ),
            const SizedBox(height: AppSpacing.lg),
            if (_photo != null)
              ClipRRect(
                borderRadius: BorderRadius.circular(AppRadius.large),
                child: Image.file(File(_photo!.path),
                    height: 220, fit: BoxFit.cover),
              ),
            const Spacer(),
            ElevatedButton(
              onPressed: _busy ? null : _submit,
              child: _busy
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white),
                    )
                  : const Text('Submit for Review'),
            ),
            const SizedBox(height: AppSpacing.sm),
            OutlinedButton(
              onPressed: _busy ? null : () => setState(() => _step = 1),
              child: const Text('Retake Photo'),
            ),
          ],
        );
    }
  }
}

class _StepRow extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;

  const _StepRow({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.md),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(AppSpacing.sm),
            decoration: BoxDecoration(
              color: AppColors.primaryLight,
              borderRadius: BorderRadius.circular(AppRadius.small),
            ),
            child: Icon(icon, color: AppColors.primary),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 2),
                Text(subtitle, style: Theme.of(context).textTheme.bodyMedium),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
