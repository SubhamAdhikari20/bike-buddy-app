import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/services/local_store.dart';
import 'routes/app_router.dart';
import 'theme/app_theme.dart';

/// Theme mode chosen in Settings > Appearance (UI-05). Defaults to the
/// system setting so night-shift users get dark mode automatically.
final themeModeProvider = StateProvider<ThemeMode>((ref) {
  return switch (LocalStore.themeMode) {
    'light' => ThemeMode.light,
    'dark' => ThemeMode.dark,
    _ => ThemeMode.system,
  };
});

class BikeBuddyApp extends ConsumerWidget {
  const BikeBuddyApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(appRouterProvider);
    final themeMode = ref.watch(themeModeProvider);

    return MaterialApp.router(
      title: 'Bike Buddy',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      darkTheme: AppTheme.dark(),
      themeMode: themeMode,
      routerConfig: router,
    );
  }
}
