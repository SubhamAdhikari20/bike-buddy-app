import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_theme.dart';
import '../../auth/presentation/providers/auth_provider.dart';

/// My Bookings with Active / Upcoming / Past tabs like the prototype.
/// Booking creation ships in Sprint 3; until then each tab shows a
/// clear empty state so users always know where bookings will appear.
class BookingsTab extends ConsumerWidget {
  const BookingsTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final textTheme = Theme.of(context).textTheme;
    final auth = ref.watch(authProvider).valueOrNull;

    return SafeArea(
      child: DefaultTabController(
        length: 3,
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('My Bookings', style: textTheme.displayLarge),
              const SizedBox(height: AppSpacing.sm),
              const TabBar(
                labelColor: AppColors.primary,
                unselectedLabelColor: AppColors.textSecondary,
                indicatorColor: AppColors.primary,
                tabs: [
                  Tab(text: 'Active'),
                  Tab(text: 'Upcoming'),
                  Tab(text: 'Past'),
                ],
              ),
              Expanded(
                child: TabBarView(
                  children: [
                    _EmptyState(
                      auth: auth != null,
                      message: auth == null
                          ? 'Sign in to see your active rides.'
                          : 'No active ride right now.',
                    ),
                    _EmptyState(
                      auth: auth != null,
                      message: auth == null
                          ? 'Sign in to see your upcoming bookings.'
                          : 'No upcoming bookings yet.',
                    ),
                    _EmptyState(
                      auth: auth != null,
                      message: auth == null
                          ? 'Sign in to see your ride history.'
                          : 'Your completed rides will appear here.',
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  final bool auth;
  final String message;

  const _EmptyState({required this.auth, required this.message});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.event_note_outlined,
              size: 56, color: AppColors.textMuted),
          const SizedBox(height: AppSpacing.md),
          Text(message, style: Theme.of(context).textTheme.bodyLarge),
          const SizedBox(height: AppSpacing.md),
          SizedBox(
            width: 220,
            child: ElevatedButton(
              onPressed: () =>
                  auth ? context.go('/home') : context.push('/auth'),
              child: Text(auth ? 'Browse bikes' : 'Sign In'),
            ),
          ),
        ],
      ),
    );
  }
}
