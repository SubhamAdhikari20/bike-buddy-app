import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/services/local_store.dart';
import '../../features/auth/presentation/pages/auth_page.dart';
import '../../features/auth/presentation/pages/id_verification_page.dart';
import '../../features/auth/presentation/pages/otp_login_page.dart';
import '../../features/home/presentation/home_shell.dart';
import '../../features/map/presentation/map_page.dart';
import '../../features/onboarding/presentation/onboarding_page.dart';
import '../../features/profile/presentation/edit_profile_page.dart';
import '../../features/profile/presentation/privacy_page.dart';
import '../../features/support/presentation/chat_page.dart';
import '../../features/support/presentation/support_page.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    // Guests land straight on home and can browse freely (UI-01).
    // First-time users see the short onboarding first (UI-02).
    initialLocation: LocalStore.onboardingSeen ? '/home' : '/onboarding',
    routes: [
      GoRoute(
        path: '/onboarding',
        builder: (context, state) => const OnboardingPage(),
      ),
      GoRoute(
        path: '/auth',
        builder: (context, state) => AuthPage(
          initialTab: state.uri.queryParameters['tab'] == 'signup' ? 1 : 0,
        ),
      ),
      GoRoute(
        path: '/otp-login',
        builder: (context, state) => const OtpLoginPage(),
      ),
      GoRoute(
        path: '/home',
        builder: (context, state) => HomeShell(
          initialTab: int.tryParse(state.uri.queryParameters['tab'] ?? '') ?? 0,
        ),
      ),
      GoRoute(
        path: '/map',
        builder: (context, state) => const MapPage(),
      ),
      GoRoute(
        path: '/verify-id',
        builder: (context, state) => const IdVerificationPage(),
      ),
      GoRoute(
        path: '/profile/edit',
        builder: (context, state) => const EditProfilePage(),
      ),
      GoRoute(
        path: '/profile/privacy',
        builder: (context, state) => const PrivacyPage(),
      ),
      GoRoute(
        path: '/support',
        builder: (context, state) => const SupportPage(),
      ),
      GoRoute(
        path: '/support/chat',
        builder: (context, state) => const ChatPage(),
      ),
    ],
  );
});
