import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_theme.dart';
import '../../../core/error/app_exception.dart';
import '../../auth/presentation/providers/auth_provider.dart';
import '../data/support_api.dart';

/// Report an issue with up to 3 photos and a note (SUP-07). Breakdown
/// reports get the 15-minute priority lane (SUP-02, SUP-06).
class ReportIssuePage extends ConsumerStatefulWidget {
  final String initialType;

  const ReportIssuePage({super.key, this.initialType = 'general'});

  @override
  ConsumerState<ReportIssuePage> createState() => _ReportIssuePageState();
}

class _ReportIssuePageState extends ConsumerState<ReportIssuePage> {
  late String _type = widget.initialType;
  final _subject = TextEditingController();
  final _message = TextEditingController();
  final List<XFile> _photos = [];
  bool _busy = false;

  @override
  void dispose() {
    _subject.dispose();
    _message.dispose();
    super.dispose();
  }

  Future<void> _addPhoto() async {
    if (_photos.length >= 3) return;
    final photo = await ImagePicker()
        .pickImage(source: ImageSource.camera, maxWidth: 1600, imageQuality: 80);
    if (photo != null && mounted) setState(() => _photos.add(photo));
  }

  Future<void> _submit() async {
    if (_subject.text.trim().length < 3 || _message.text.trim().length < 10) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Add a short subject and describe the issue')),
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

      final result = await ref.read(supportApiProvider).createTicket(
            type: _type,
            subject: _subject.text.trim(),
            message: _message.text.trim(),
            photos: urls,
          );

      ref.invalidate(myTicketsProvider);
      if (mounted) {
        final minutes = result['expectedResponseMinutes'] ?? 60;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Ticket created. Expect a reply within $minutes minutes.'),
            backgroundColor: AppColors.success,
          ),
        );
        context.pushReplacement('/support/tickets');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e is AppException
                ? e.message
                : 'Could not create the ticket. Please try again.'),
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
      appBar: AppBar(title: const Text('Report an Issue')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(AppSpacing.lg),
          children: [
            // Expected response time up front (SUP-06).
            Card(
              color: _type == 'breakdown'
                  ? AppColors.accent.withValues(alpha: 0.1)
                  : AppColors.primaryLight,
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.md),
                child: Row(
                  children: [
                    Icon(
                      _type == 'breakdown' ? Icons.bolt : Icons.schedule,
                      color: _type == 'breakdown'
                          ? AppColors.accent
                          : AppColors.primary,
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: Text(
                        _type == 'breakdown'
                            ? 'Breakdown reports are answered within 15 minutes, 24/7.'
                            : 'We usually reply within an hour.',
                        style: const TextStyle(fontWeight: FontWeight.w500),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.md),

            Text('What kind of issue?', style: textTheme.titleMedium),
            const SizedBox(height: AppSpacing.sm),
            Wrap(
              spacing: AppSpacing.sm,
              children: [
                for (final (value, label) in [
                  ('breakdown', 'Breakdown'),
                  ('complaint', 'Complaint'),
                  ('general', 'Something else'),
                ])
                  ChoiceChip(
                    label: Text(label),
                    selected: _type == value,
                    selectedColor:
                        value == 'breakdown' ? AppColors.accent : AppColors.mint,
                    labelStyle: TextStyle(
                      color: _type == value && value == 'breakdown'
                          ? Colors.white
                          : null,
                    ),
                    showCheckmark: false,
                    onSelected: (_) => setState(() => _type = value),
                  ),
              ],
            ),
            const SizedBox(height: AppSpacing.md),

            TextField(
              controller: _subject,
              maxLength: 200,
              decoration: const InputDecoration(
                labelText: 'Subject',
                hintText: 'e.g. Engine died near Patan Durbar Square',
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            TextField(
              controller: _message,
              maxLines: 4,
              maxLength: 500,
              decoration: const InputDecoration(
                labelText: 'Describe the issue',
                alignLabelWithHint: true,
              ),
            ),
            const SizedBox(height: AppSpacing.sm),

            SizedBox(
              height: 84,
              child: ListView(
                scrollDirection: Axis.horizontal,
                children: [
                  if (_photos.length < 3)
                    InkWell(
                      onTap: _addPhoto,
                      child: Container(
                        width: 84,
                        decoration: BoxDecoration(
                          color: AppColors.primaryLight,
                          borderRadius: BorderRadius.circular(AppRadius.medium),
                        ),
                        child: const Icon(Icons.add_a_photo_outlined,
                            color: AppColors.primary),
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
                                width: 84, height: 84, fit: BoxFit.cover),
                          ),
                          Positioned(
                            top: 2,
                            right: 2,
                            child: InkWell(
                              onTap: () => setState(() => _photos.removeAt(i)),
                              child: const CircleAvatar(
                                radius: 11,
                                backgroundColor: Colors.black54,
                                child: Icon(Icons.close,
                                    size: 13, color: Colors.white),
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

            ElevatedButton(
              onPressed: _busy ? null : _submit,
              child: _busy
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white),
                    )
                  : const Text('Submit Ticket'),
            ),
          ],
        ),
      ),
    );
  }
}
