import 'package:flutter/material.dart';
import 'package:permission_handler/permission_handler.dart';

import '../../app/theme/app_colors.dart';
import '../../app/theme/app_theme.dart';

/// Only Location and Camera are ever requested, and each request is
/// preceded by a plain-language explanation of why it is needed (UI-10).
/// If the user declines, the app keeps working in a reduced mode.
class PermissionService {
  PermissionService._();

  static Future<bool> requestLocation(BuildContext context) {
    return _requestWithReason(
      context,
      permission: Permission.locationWhenInUse,
      icon: Icons.location_on_outlined,
      title: 'Allow location?',
      reason:
          'We use your location only to show bikes near you and to guide you to the pickup point. We never track you in the background.',
    );
  }

  static Future<bool> requestCamera(BuildContext context) {
    return _requestWithReason(
      context,
      permission: Permission.camera,
      icon: Icons.photo_camera_outlined,
      title: 'Allow camera?',
      reason:
          'We use your camera only to take a photo of your ID for verification. The photo is stored securely and never shared.',
    );
  }

  static Future<bool> _requestWithReason(
    BuildContext context, {
    required Permission permission,
    required IconData icon,
    required String title,
    required String reason,
  }) async {
    final status = await permission.status;
    if (status.isGranted) return true;

    if (!context.mounted) return false;
    final agreed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.large)),
        icon: Icon(icon, size: 40, color: AppColors.primary),
        title: Text(title),
        content: Text(reason, style: Theme.of(context).textTheme.bodyMedium),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Not now'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Continue'),
          ),
        ],
      ),
    );

    if (agreed != true) return false;

    final result = await permission.request();
    return result.isGranted;
  }
}
