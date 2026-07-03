import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_theme.dart';
import '../../../core/services/local_store.dart';
import '../../../core/widgets/error_view.dart';
import '../../../core/widgets/loading_view.dart';
import '../../bikes/presentation/providers/bikes_provider.dart';
import '../../bikes/presentation/widgets/bike_card.dart';

/// Search tab: search field with recent-search chips (UI-07) and a
/// results grid. History is clearable in one tap (user control, H3).
class SearchTab extends ConsumerStatefulWidget {
  const SearchTab({super.key});

  @override
  ConsumerState<SearchTab> createState() => _SearchTabState();
}

class _SearchTabState extends ConsumerState<SearchTab> {
  final _searchController = TextEditingController();
  List<String> _recent = LocalStore.recentSearches;

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _submit(String term) async {
    final trimmed = term.trim();
    _searchController.text = trimmed;
    ref.read(bikeQueryProvider.notifier).state =
        ref.read(bikeQueryProvider).copyWith(search: trimmed);
    if (trimmed.isNotEmpty) {
      await LocalStore.addRecentSearch(trimmed);
      setState(() => _recent = LocalStore.recentSearches);
    }
  }

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final bikes = ref.watch(bikesProvider);

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Search', style: textTheme.displayLarge),
            const SizedBox(height: AppSpacing.md),
            TextField(
              controller: _searchController,
              textInputAction: TextInputAction.search,
              onSubmitted: _submit,
              decoration: InputDecoration(
                hintText: 'Search by name, brand or city...',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: _searchController.text.isEmpty
                    ? null
                    : IconButton(
                        icon: const Icon(Icons.close),
                        onPressed: () => _submit(''),
                      ),
              ),
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: AppSpacing.sm),

            // Recent searches as one-tap chips (UI-07).
            if (_recent.isNotEmpty) ...[
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('Recent searches', style: textTheme.labelSmall),
                  TextButton(
                    onPressed: () async {
                      await LocalStore.clearRecentSearches();
                      setState(() => _recent = const []);
                    },
                    child: const Text('Clear'),
                  ),
                ],
              ),
              SizedBox(
                height: 36,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: _recent.length,
                  separatorBuilder: (context, index) =>
                      const SizedBox(width: AppSpacing.sm),
                  itemBuilder: (context, index) => ActionChip(
                    avatar: const Icon(Icons.history,
                        size: 16, color: AppColors.textSecondary),
                    label: Text(_recent[index]),
                    onPressed: () => _submit(_recent[index]),
                  ),
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
            ],

            Expanded(
              child: bikes.when(
                loading: () => const LoadingView(label: 'Searching bikes...'),
                error: (error, _) => ErrorView(
                  message: error.toString(),
                  onRetry: () => ref.invalidate(bikesProvider),
                ),
                data: (items) => items.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.search_off,
                                size: 48, color: AppColors.textMuted),
                            const SizedBox(height: AppSpacing.sm),
                            Text(
                              'No bikes found. Try a different search.',
                              style: textTheme.bodyMedium,
                            ),
                          ],
                        ),
                      )
                    : GridView.builder(
                        gridDelegate:
                            const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 1,
                          mainAxisExtent: 250,
                          mainAxisSpacing: AppSpacing.md,
                        ),
                        itemCount: items.length,
                        itemBuilder: (context, index) => BikeCard(
                          bike: items[index],
                          width: double.infinity,
                        ),
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
