import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_theme.dart';
import '../../../core/error/app_exception.dart';
import '../../auth/presentation/providers/auth_provider.dart';
import '../../bookings/data/booking_api.dart';

/// Post-return damage report with photo evidence (BC-04). Reports are
/// acknowledged within 24 hours.
class DamageReportPage extends ConsumerStatefulWidget {
  final String bookingId;

  const DamageReportPage({super.key, required this.bookingId});

  @override
  ConsumerState<DamageReportPage> createState() => _DamageReportPageState();
}

class _DamageReportPageState extends ConsumerState<DamageReportPage> {
  final _description = TextEditingController();
  final List<XFile> _photos = [];
  bool _busy = false;

  @override
  void dispose() {
    _description.dispose();
    super.dispose();
  }

  Future<void> _addPhoto(ImageSource source) async {
    if (_photos.length >= 3) return;
    final photo = await ImagePicker()
        .pickImage(source: source, maxWidth: 1600, imageQuality: 80);
    if (photo != null && mounted) setState(() => _photos.add(photo));
  }

  Future<void> _submit() async {
    if (_photos.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Add at least one photo of the damage')),
      );
      return;
    }
    if (_description.text.trim().length < 10) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Describe what happened in a few words')),
      );
      return;
    }

    setState(() => _busy = true);
    try {
      final auth = ref.read(authProvider.notifier);
      final urls = <String>[];
      for (final photo in _photos) {
        urls.add(await auth.uploadImage(photo.path));
      }

      await ref.read(bookingApiProvider).reportDamage(
            bookingId: widget.bookingId,
            photos: urls,
            description: _description.text.trim(),
          );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
                'Report submitted. We will acknowledge it within 24 hours.'),
            backgroundColor: AppColors.success,
          ),
        );
        context.pop();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e is AppException
                ? e.message
                : 'Could not submit the report. Please try again.'),
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
      appBar: AppBar(title: const Text('Report Damage')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(AppSpacing.lg),
          children: [
            Text('What happened?', style: textTheme.titleLarge),
            const SizedBox(height: AppSpacing.xs),
            Text(
              'Photos and an honest description protect both you and the owner. Your report goes straight to our team, not the owner.',
              style: textTheme.bodyMedium,
            ),
            const SizedBox(height: AppSpacing.md),
            SizedBox(
              height: 96,
              child: ListView(
                scrollDirection: Axis.horizontal,
                children: [
                  if (_photos.length < 3)
                    InkWell(
                      onTap: () => _addPhoto(ImageSource.camera),
                      child: Container(
                        width: 96,
                        decoration: BoxDecoration(
                          color: AppColors.primaryLight,
                          borderRadius:
                              BorderRadius.circular(AppRadius.medium),
                        ),
                        child: const Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.photo_camera_outlined,
                                color: AppColors.primary),
                            SizedBox(height: 4),
                            Text('Add Photo',
                                style: TextStyle(
                                    fontSize: 12, color: AppColors.primary)),
                          ],
                        ),
                      ),
                    ),
                  for (var i = 0; i < _photos.length; i++)
                    Padding(
                      padding: const EdgeInsets.only(left: AppSpacing.sm),
                      child: Stack(
                        children: [
                          ClipRRect(
                            borderRadius:
                                BorderRadius.circular(AppRadius.medium),
                            child: Image.file(File(_photos[i].path),
                                width: 96, height: 96, fit: BoxFit.cover),
                          ),
                          Positioned(
                            top: 2,
                            right: 2,
                            child: InkWell(
                              onTap: () =>
                                  setState(() => _photos.removeAt(i)),
                              child: const CircleAvatar(
                                radius: 12,
                                backgroundColor: Colors.black54,
                                child: Icon(Icons.close,
                                    size: 14, color: Colors.white),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
            Text('Up to 3 photos', style: textTheme.labelSmall),
            const SizedBox(height: AppSpacing.md),
            TextField(
              controller: _description,
              maxLines: 5,
              maxLength: 500,
              decoration: const InputDecoration(
                hintText:
                    'e.g. The left mirror cracked when the bike tipped over while parked...',
                alignLabelWithHint: true,
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            ElevatedButton(
              onPressed: _busy ? null : _submit,
              child: _busy
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white),
                    )
                  : const Text('Submit Report'),
            ),
          ],
        ),
      ),
    );
  }
}
