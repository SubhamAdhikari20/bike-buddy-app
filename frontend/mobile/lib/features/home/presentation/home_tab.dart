import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_theme.dart';
import '../../../core/services/local_store.dart';
import '../../../core/widgets/error_view.dart';
import '../../../core/widgets/loading_view.dart';
import '../../auth/presentation/providers/auth_provider.dart';
import '../../bikes/presentation/providers/bikes_provider.dart';
import '../../bikes/presentation/widgets/bike_card.dart';

/// Home tab from the prototype: location header, search bar, category
/// chips, "Nearby Bikes" carousel and an "Explore on Map" CTA.
/// Guests can browse everything without signing in (UI-01).
class HomeTab extends ConsumerStatefulWidget {
  const HomeTab({super.key});

  @override
  ConsumerState<HomeTab> createState() => _HomeTabState();
}

class _HomeTabState extends ConsumerState<HomeTab> {
  static const _categories = [
    'All Bikes',
    'Scooters',
    'Cruisers',
    'Electric',
    'Sports',
  ];

  Map<String, dynamic>? _draft;

  @override
  void initState() {
    super.initState();
    // Crash-safe booking draft: offer to resume within 30 min (UI-06).
    _draft = LocalStore.bookingDraft;
  }

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final auth = ref.watch(authProvider).valueOrNull;
    final query = ref.watch(bikeQueryProvider);
    final bikes = ref.watch(bikesProvider);

    return SafeArea(
      child: RefreshIndicator(
        onRefresh: () async => ref.refresh(bikesProvider.future),
        child: ListView(
          padding: const EdgeInsets.all(AppSpacing.md),
          children: [
            // Location header + bell, like the prototype.
            Row(
              children: [
                const Icon(Icons.location_on_outlined, color: AppColors.primary),
                const SizedBox(width: AppSpacing.xs),
                Expanded(
                  child: Text(
                    'Kathmandu, Nepal',
                    style: textTheme.titleLarge?.copyWith(color: AppColors.primary),
                  ),
                ),
                IconButton(
                  onPressed: () => context.push('/support'),
                  tooltip: 'Help & support',
                  icon: const Icon(Icons.support_agent),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.md),

            // Search bar hands off to the Search tab.
            TextField(
              readOnly: true,
              onTap: () => context.go('/home?tab=1'),
              decoration: const InputDecoration(
                hintText: 'Find your ride...',
                prefixIcon: Icon(Icons.search),
                suffixIcon: Icon(Icons.tune),
              ),
            ),
            const SizedBox(height: AppSpacing.md),

            // Category chips (law of similarity, instant filter).
            SizedBox(
              height: 40,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: _categories.length,
                separatorBuilder: (context, index) =>
                    const SizedBox(width: AppSpacing.sm),
                itemBuilder: (context, index) {
                  final category = _categories[index];
                  final selected =
                      (query.category ?? 'All Bikes') == category;
                  return ChoiceChip(
                    label: Text(category),
                    selected: selected,
                    selectedColor: AppColors.mint,
                    backgroundColor: AppColors.surface,
                    labelStyle: TextStyle(
                      color: AppColors.textPrimary,
                      fontWeight:
                          selected ? FontWeight.w600 : FontWeight.w400,
                    ),
                    onSelected: (_) => ref
                        .read(bikeQueryProvider.notifier)
                        .state = query.copyWith(category: category),
                  );
                },
              ),
            ),
            const SizedBox(height: AppSpacing.md),

            // Resume banner after a crash or app restart (UI-06, H6).
            if (_draft != null) _ResumeBookingBanner(
              draft: _draft!,
              onDismiss: () {
                LocalStore.clearBookingDraft();
                setState(() => _draft = null);
              },
            ),

            // Guest nudge: sign-in is optional and never blocks browsing.
            if (auth == null) ...[
              Card(
                color: AppColors.primaryLight,
                child: Padding(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  child: Row(
                    children: [
                      const Icon(Icons.person_outline, color: AppColors.primary),
                      const SizedBox(width: AppSpacing.sm),
                      const Expanded(
                        child: Text(
                          'Browse freely. Sign in only when you want to book.',
                          style: TextStyle(fontSize: 13),
                        ),
                      ),
                      TextButton(
                        onPressed: () => context.push('/auth'),
                        child: const Text('Sign In'),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: AppSpacing.md),
            ],

            // Nearby bikes carousel.
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Nearby Bikes', style: textTheme.titleLarge),
                TextButton(
                  onPressed: () => context.go('/home?tab=1'),
                  child: const Text('See all'),
                ),
              ],
            ),
            SizedBox(
              height: 250,
              child: bikes.when(
                loading: () => const LoadingView(label: 'Finding bikes near you...'),
                error: (error, _) => ErrorView(
                  message: error.toString(),
                  onRetry: () => ref.invalidate(bikesProvider),
                ),
                data: (items) => items.isEmpty
                    ? const Center(
                        child: Text('No bikes match this filter yet.'),
                      )
                    : ListView.separated(
                        scrollDirection: Axis.horizontal,
                        itemCount: items.length.clamp(0, 7),
                        separatorBuilder: (context, index) =>
                            const SizedBox(width: AppSpacing.md),
                        itemBuilder: (context, index) => BikeCard(
                          bike: items[index],
                        ),
                      ),
              ),
            ),
            const SizedBox(height: AppSpacing.md),

            // Map CTA card (MAP-05 entry point).
            Card(
              clipBehavior: Clip.antiAlias,
              child: InkWell(
                onTap: () => context.push('/map'),
                child: Container(
                  height: 140,
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      colors: [AppColors.primary, Color(0xFF3B82F6)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                  ),
                  padding: const EdgeInsets.all(AppSpacing.md),
                  child: Row(
                    children: [
                      const Expanded(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'See available bikes around you',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 18,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            SizedBox(height: 4),
                            Text(
                              'Live availability on the map',
                              style: TextStyle(color: Colors.white70, fontSize: 13),
                            ),
                          ],
                        ),
                      ),
                      ElevatedButton.icon(
                        onPressed: () => context.push('/map'),
                        icon: const Icon(Icons.map_outlined, size: 20),
                        label: const Text('Explore on Map'),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.xxl),
          ],
        ),
      ),
    );
  }
}

class _ResumeBookingBanner extends StatelessWidget {
  final Map<String, dynamic> draft;
  final VoidCallback onDismiss;

  const _ResumeBookingBanner({required this.draft, required this.onDismiss});

  @override
  Widget build(BuildContext context) {
    final imageUrl = draft['imageUrl'] as String?;

    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.md),
      child: Card(
        color: AppColors.mint,
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.sm),
          child: Row(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(AppRadius.small),
                child: SizedBox(
                  width: 48,
                  height: 48,
                  child: imageUrl == null || imageUrl.isEmpty
                      ? Container(
                          color: Colors.white,
                          child: const Icon(Icons.two_wheeler,
                              color: AppColors.primary),
                        )
                      : CachedNetworkImage(imageUrl: imageUrl, fit: BoxFit.cover),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Resume your booking',
                      style: TextStyle(fontWeight: FontWeight.w600),
                    ),
                    Text(
                      draft['bikeTitle'] as String? ?? 'Your bike is waiting',
                      style: const TextStyle(fontSize: 12),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              IconButton(
                onPressed: onDismiss,
                tooltip: 'Dismiss',
                icon: const Icon(Icons.close, size: 20),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
