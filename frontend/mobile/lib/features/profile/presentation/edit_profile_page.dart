import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_theme.dart';
import '../../../core/api/media_upload_api.dart';
import '../../../core/error/app_exception.dart';
import '../../auth/presentation/providers/auth_provider.dart';

/// Edit profile with every field pre-filled (AUTH-03). On failure the
/// inputs keep their values so nothing is retyped (H5 error prevention).
class EditProfilePage extends ConsumerStatefulWidget {
  const EditProfilePage({super.key});

  @override
  ConsumerState<EditProfilePage> createState() => _EditProfilePageState();
}

class _EditProfilePageState extends ConsumerState<EditProfilePage> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _name;
  late final TextEditingController _phone;
  late final TextEditingController _bio;
  final _picker = ImagePicker();
  XFile? _avatar;
  bool _removeAvatar = false;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    final auth = ref.read(authProvider).valueOrNull;
    _name = TextEditingController(text: auth?.fullName ?? '');
    _phone = TextEditingController(text: auth?.phoneNumber ?? '');
    _bio = TextEditingController(text: auth?.bio ?? '');
  }

  Future<void> _pickAvatar() async {
    final picked = await _picker.pickImage(
      source: ImageSource.gallery,
      imageQuality: 82,
      maxWidth: 1200,
      maxHeight: 1200,
    );
    if (picked == null) return;
    if (await picked.length() > 5 * 1024 * 1024) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Choose a photo smaller than 5 MB.')),
        );
      }
      return;
    }
    if (mounted) {
      setState(() {
        _avatar = picked;
        _removeAvatar = false;
      });
    }
  }

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _bio.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _busy = true);
    try {
      final auth = ref.read(authProvider).valueOrNull;
      String? avatarUrl = _removeAvatar ? null : auth?.profilePictureUrl;
      if (_avatar != null) {
        avatarUrl = await ref
            .read(mediaUploadApiProvider)
            .uploadOne(UploadKind.profile, _avatar!.path);
      }
      await ref.read(authProvider.notifier).updateProfile({
        'fullName': _name.text.trim(),
        'phoneNumber': _phone.text.trim().isEmpty ? null : _phone.text.trim(),
        'bio': _bio.text.trim().isEmpty ? null : _bio.text.trim(),
        'profilePictureUrl': avatarUrl,
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Profile saved'),
            backgroundColor: AppColors.success,
          ),
        );
        context.pop();
      }
    } catch (e) {
      // Inputs are intentionally left untouched on failure.
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              e is AppException
                  ? e.message
                  : 'Could not save. Your changes are still here - try again.',
            ),
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
    final auth = ref.watch(authProvider).valueOrNull;
    final ImageProvider<Object>? avatarImage = _avatar != null
        ? FileImage(File(_avatar!.path))
        : !_removeAvatar && auth?.profilePictureUrl != null
        ? NetworkImage(auth!.profilePictureUrl!)
        : null;

    return Scaffold(
      appBar: AppBar(title: const Text('Edit Profile')),
      body: auth == null
          ? const Center(child: Text('Sign in to edit your profile.'))
          : SafeArea(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(AppSpacing.lg),
                child: Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Center(
                        child: Stack(
                          clipBehavior: Clip.none,
                          children: [
                            CircleAvatar(
                              radius: 48,
                              backgroundColor: AppColors.primaryLight,
                              backgroundImage: avatarImage,
                              child: avatarImage == null
                                  ? const Icon(
                                      Icons.person,
                                      size: 44,
                                      color: AppColors.primary,
                                    )
                                  : null,
                            ),
                            Positioned(
                              right: -8,
                              bottom: -8,
                              child: IconButton.filled(
                                tooltip: 'Choose profile picture',
                                onPressed: _busy ? null : _pickAvatar,
                                icon: const Icon(Icons.photo_camera_outlined),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: AppSpacing.md),
                      if (avatarImage != null)
                        TextButton.icon(
                          onPressed: _busy
                              ? null
                              : () => setState(() {
                                  _avatar = null;
                                  _removeAvatar = true;
                                }),
                          icon: const Icon(Icons.delete_outline),
                          label: const Text('Remove profile picture'),
                        ),
                      Text(
                        'JPG, PNG or WEBP · up to 5 MB',
                        style: Theme.of(context).textTheme.bodySmall,
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      TextFormField(
                        controller: _name,
                        textCapitalization: TextCapitalization.words,
                        decoration: const InputDecoration(
                          labelText: 'Full name',
                          prefixIcon: Icon(Icons.badge_outlined),
                        ),
                        validator: (value) =>
                            value == null || value.trim().length < 3
                            ? 'Enter your full name'
                            : null,
                      ),
                      const SizedBox(height: AppSpacing.md),
                      TextFormField(
                        initialValue: auth.email,
                        enabled: false,
                        decoration: const InputDecoration(
                          labelText: 'Email (cannot be changed)',
                          prefixIcon: Icon(Icons.mail_outline),
                        ),
                      ),
                      const SizedBox(height: AppSpacing.md),
                      TextFormField(
                        controller: _phone,
                        keyboardType: TextInputType.phone,
                        decoration: const InputDecoration(
                          labelText: 'Phone',
                          prefixIcon: Icon(Icons.phone_outlined),
                        ),
                        validator: (value) {
                          if (value == null || value.trim().isEmpty) {
                            return null;
                          }
                          return value.trim().length == 10
                              ? null
                              : 'Phone must be 10 digits';
                        },
                      ),
                      const SizedBox(height: AppSpacing.md),
                      TextFormField(
                        controller: _bio,
                        maxLines: 3,
                        maxLength: 500,
                        decoration: const InputDecoration(
                          labelText: 'About you (optional)',
                          alignLabelWithHint: true,
                          prefixIcon: Icon(Icons.notes_outlined),
                        ),
                      ),
                      const SizedBox(height: AppSpacing.md),
                      ElevatedButton(
                        onPressed: _busy ? null : _save,
                        child: _busy
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              )
                            : const Text('Save Changes'),
                      ),
                    ],
                  ),
                ),
              ),
            ),
    );
  }
}
