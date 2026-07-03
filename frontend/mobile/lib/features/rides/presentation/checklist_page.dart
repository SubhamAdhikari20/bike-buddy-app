import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';

import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_theme.dart';
import '../../../core/error/app_exception.dart';
import '../../auth/presentation/providers/auth_provider.dart';
import '../../bookings/data/booking_api.dart';
import '../../bookings/data/booking_model.dart';

class _ChecklistItem {
  final String key;
  final String title;
  final String hint;
  final IconData icon;
  bool ok;
  String? note;

  _ChecklistItem(this.key, this.title, this.hint, this.icon) : ok = false;
}

/// Pre-ride handover checklist (BC-02) styled after the prototype:
/// inspection cards, condition photo evidence and an acknowledgement
/// before the ride starts (H5 - error prevention).
class ChecklistPage extends ConsumerStatefulWidget {
  final String bookingId;

  const ChecklistPage({super.key, required this.bookingId});

  @override
  ConsumerState<ChecklistPage> createState() => _ChecklistPageState();
}

class _ChecklistPageState extends ConsumerState<ChecklistPage> {
  final _items = [
    _ChecklistItem('brakes', 'Tires & Brakes',
        'Tread looks fine, no visible damage, brake levers feel firm.', Icons.tire_repair),
    _ChecklistItem('lights', 'Lights & Indicators',
        'Headlight, taillight, brake light and both indicators work.', Icons.lightbulb_outline),
    _ChecklistItem('fuel', 'Fuel Level',
        'Note the fuel level. Return at the same level to avoid charges.', Icons.local_gas_station),
    _ChecklistItem('body', 'Body & Mirrors',
        'Check for existing scratches or dents and photograph them below.', Icons.two_wheeler),
  ];

  final List<XFile> _photos = [];
  bool _acknowledged = false;
  bool _busy = false;
  Booking? _booking;

  @override
  void initState() {
    super.initState();
    ref
        .read(bookingApiProvider)
        .getBooking(widget.bookingId)
        .then((booking) => mounted ? setState(() => _booking = booking) : null)
        .catchError((_) {});
  }

  Future<void> _addPhoto() async {
    final photo = await ImagePicker()
        .pickImage(source: ImageSource.camera, maxWidth: 1600, imageQuality: 80);
    if (photo != null && mounted) setState(() => _photos.add(photo));
  }

  Future<void> _reportIssue(_ChecklistItem item) async {
    final controller = TextEditingController(text: item.note);
    final note = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.large)),
        title: Text('Issue with ${item.title}?'),
        content: TextField(
          controller: controller,
          maxLines: 3,
          maxLength: 300,
          autofocus: true,
          decoration: const InputDecoration(
              hintText: 'Describe the problem, e.g. "front brake feels weak"'),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () => Navigator.of(context).pop(controller.text.trim()),
            child: const Text('Save issue'),
          ),
        ],
      ),
    );
    if (note != null && mounted) {
      setState(() => item.note = note.isEmpty ? null : note);
    }
  }

  Future<void> _confirm() async {
    setState(() => _busy = true);
    try {
      // Upload evidence photos first, then submit the checklist.
      final auth = ref.read(authProvider.notifier);
      final photoUrls = <String>[];
      for (final photo in _photos) {
        photoUrls.add(await auth.uploadImage(photo.path));
      }

      await ref.read(bookingApiProvider).submitChecklist(
            bookingId: widget.bookingId,
            items: _items
                .map((item) =>
                    {'key': item.key, 'ok': item.ok, 'note': item.note})
                .toList(),
            photos: photoUrls,
            acknowledged: _acknowledged,
          );

      ref.invalidate(myBookingsProvider);
      if (mounted) context.pushReplacement('/ride/${widget.bookingId}');
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e is AppException
                ? e.message
                : 'Could not save the checklist. Please try again.'),
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
    final allChecked = _items.every((item) => item.ok || item.note != null);
    final booking = _booking;

    return Scaffold(
      appBar: AppBar(title: const Text('Handover Checklist')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(AppSpacing.md),
          children: [
            if (booking != null)
              Card(
                child: ListTile(
                  leading: const Icon(Icons.two_wheeler,
                      size: 36, color: AppColors.primary),
                  title: Text(booking.bike?.title ?? 'Your bike'),
                  subtitle: Text(
                    'Booking #${booking.id.substring(booking.id.length - 6).toUpperCase()}\n'
                    'Pick-up: ${DateFormat('EEE, d MMM h:mm a').format(booking.startDate)}',
                  ),
                  isThreeLine: true,
                ),
              ),
            const SizedBox(height: AppSpacing.md),
            Text('PRE-RIDE INSPECTION',
                style: textTheme.labelSmall?.copyWith(letterSpacing: 1.2)),
            const SizedBox(height: AppSpacing.sm),

            for (final item in _items)
              Card(
                margin: const EdgeInsets.only(bottom: AppSpacing.sm),
                shape: item.note != null
                    ? RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(AppRadius.large),
                        side: const BorderSide(color: AppColors.warning),
                      )
                    : null,
                child: CheckboxListTile(
                  value: item.ok,
                  onChanged: (value) =>
                      setState(() => item.ok = value ?? false),
                  controlAffinity: ListTileControlAffinity.leading,
                  title: Row(
                    children: [
                      Icon(item.icon, size: 20, color: AppColors.primary),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(child: Text(item.title)),
                    ],
                  ),
                  subtitle: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(item.hint, style: const TextStyle(fontSize: 12)),
                      Align(
                        alignment: Alignment.centerLeft,
                        child: TextButton.icon(
                          style: TextButton.styleFrom(
                            padding: EdgeInsets.zero,
                            foregroundColor: item.note != null
                                ? AppColors.warning
                                : AppColors.primary,
                          ),
                          onPressed: () => _reportIssue(item),
                          icon: Icon(
                            item.note != null
                                ? Icons.report_problem
                                : Icons.report_problem_outlined,
                            size: 16,
                          ),
                          label: Text(item.note != null
                              ? 'Issue noted: ${item.note}'
                              : 'Report Issue'),
                        ),
                      ),
                    ],
                  ),
                ),
              ),

            const SizedBox(height: AppSpacing.sm),
            Text('CONDITION EVIDENCE',
                style: textTheme.labelSmall?.copyWith(letterSpacing: 1.2)),
            const SizedBox(height: AppSpacing.xs),
            Text(
              'Photograph the bike, especially any existing scratches or dents. These photos protect you in a dispute.',
              style: textTheme.bodyMedium,
            ),
            const SizedBox(height: AppSpacing.sm),
            SizedBox(
              height: 96,
              child: ListView(
                scrollDirection: Axis.horizontal,
                children: [
                  InkWell(
                    onTap: _addPhoto,
                    child: Container(
                      width: 96,
                      decoration: BoxDecoration(
                        color: AppColors.primaryLight,
                        borderRadius: BorderRadius.circular(AppRadius.medium),
                        border: Border.all(
                            color: AppColors.primary,
                            style: BorderStyle.solid),
                      ),
                      child: const Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.add_a_photo_outlined,
                              color: AppColors.primary),
                          SizedBox(height: 4),
                          Text('Add Photo',
                              style: TextStyle(
                                  fontSize: 12, color: AppColors.primary)),
                        ],
                      ),
                    ),
                  ),
                  for (final photo in _photos)
                    Padding(
                      padding: const EdgeInsets.only(left: AppSpacing.sm),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(AppRadius.medium),
                        child: Image.file(File(photo.path),
                            width: 96, height: 96, fit: BoxFit.cover),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.md),

            Card(
              color: AppColors.primaryLight,
              child: CheckboxListTile(
                value: _acknowledged,
                onChanged: (value) =>
                    setState(() => _acknowledged = value ?? false),
                controlAffinity: ListTileControlAffinity.leading,
                title: const Text(
                  'I confirm the condition above is accurate and accept responsibility for new damage during my rental.',
                  style: TextStyle(fontSize: 13),
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.md),

            ElevatedButton.icon(
              onPressed:
                  allChecked && _acknowledged && !_busy ? _confirm : null,
              icon: _busy
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white),
                    )
                  : const Icon(Icons.check_circle_outline),
              label: const Text('Confirm Handover'),
            ),
            if (!allChecked)
              Padding(
                padding: const EdgeInsets.only(top: AppSpacing.sm),
                child: Text(
                  'Tick every item (or note an issue) to continue.',
                  style: textTheme.labelSmall,
                  textAlign: TextAlign.center,
                ),
              ),
            const SizedBox(height: AppSpacing.xl),
          ],
        ),
      ),
    );
  }
}
