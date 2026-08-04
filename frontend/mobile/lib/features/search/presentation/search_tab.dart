import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';

import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_theme.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/services/local_store.dart';
import '../../../core/widgets/error_view.dart';
import '../../../core/widgets/loading_view.dart';
import '../../../core/widgets/open_street_map_layers.dart';
import '../../bikes/data/bike_model.dart';
import '../../bikes/presentation/providers/bikes_provider.dart';
import '../../bikes/presentation/widgets/filter_sheet.dart';

/// Search with active filter chips (UI-03), list/map view toggle with
/// addresses and landmarks (UI-08, MAP-04) and compare selection (UI-04).
class SearchTab extends ConsumerStatefulWidget {
  const SearchTab({super.key});

  @override
  ConsumerState<SearchTab> createState() => _SearchTabState();
}

class _SearchTabState extends ConsumerState<SearchTab> {
  final _searchController = TextEditingController();
  List<String> _recent = LocalStore.recentSearches;
  bool _mapView = false;

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _submit(String term) async {
    final trimmed = term.trim();
    _searchController.text = trimmed;
    ref.read(bikeQueryProvider.notifier).state = ref
        .read(bikeQueryProvider)
        .copyWith(search: trimmed.isEmpty ? null : trimmed);
    if (trimmed.isNotEmpty) {
      await LocalStore.addRecentSearch(trimmed);
      setState(() => _recent = LocalStore.recentSearches);
    } else {
      setState(() {});
    }
  }

  void _toggleCompare(Bike bike) {
    final selection = [...ref.read(compareSelectionProvider)];
    final index = selection.indexWhere((b) => b.id == bike.id);
    if (index >= 0) {
      selection.removeAt(index);
    } else {
      if (selection.length >= 3) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('You can compare up to 3 bikes')),
        );
        return;
      }
      selection.add(bike);
    }
    ref.read(compareSelectionProvider.notifier).state = selection;
  }

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final query = ref.watch(bikeQueryProvider);
    final bikes = ref.watch(bikesProvider);
    final compareSelection = ref.watch(compareSelectionProvider);

    final categoryLabel = BikeQuery.categoryLabels.entries
        .firstWhere(
          (entry) => entry.value == query.category,
          orElse: () => const MapEntry('All Bikes', null),
        )
        .key;

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(child: Text('Search', style: textTheme.displayLarge)),
                // List / Map toggle (UI-08, Jakob's law).
                SegmentedButton<bool>(
                  segments: const [
                    ButtonSegment(
                      value: false,
                      icon: Icon(Icons.view_list_outlined, size: 18),
                      label: Text('List'),
                    ),
                    ButtonSegment(
                      value: true,
                      icon: Icon(Icons.map_outlined, size: 18),
                      label: Text('Map'),
                    ),
                  ],
                  selected: {_mapView},
                  showSelectedIcon: false,
                  style: ButtonStyle(
                    backgroundColor: WidgetStateProperty.resolveWith(
                      (states) => states.contains(WidgetState.selected)
                          ? AppColors.mint
                          : AppColors.surface,
                    ),
                  ),
                  onSelectionChanged: (selection) =>
                      setState(() => _mapView = selection.first),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.md),
            TextField(
              controller: _searchController,
              textInputAction: TextInputAction.search,
              onSubmitted: _submit,
              decoration: InputDecoration(
                hintText: 'Search by name, brand or city...',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (_searchController.text.isNotEmpty)
                      IconButton(
                        icon: const Icon(Icons.close),
                        onPressed: () => _submit(''),
                      ),
                    IconButton(
                      tooltip: 'Filters',
                      icon: Badge(
                        isLabelVisible: query.activeFilterCount > 0,
                        label: Text('${query.activeFilterCount}'),
                        child: const Icon(Icons.tune, color: AppColors.primary),
                      ),
                      onPressed: () => FilterSheet.show(context),
                    ),
                  ],
                ),
              ),
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: AppSpacing.sm),

            // Active filters as removable chips (UI-03, visibility of state).
            if (query.activeFilterCount > 0 || query.search != null)
              SizedBox(
                height: 36,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  children: [
                    if (query.search != null)
                      _ActiveFilterChip(
                        label: '"${query.search}"',
                        onRemoved: () => _submit(''),
                      ),
                    if (query.category != null)
                      _ActiveFilterChip(
                        label: categoryLabel,
                        onRemoved: () =>
                            ref.read(bikeQueryProvider.notifier).state = query
                                .copyWith(category: null),
                      ),
                    if (query.city != null)
                      _ActiveFilterChip(
                        label: query.city!,
                        onRemoved: () =>
                            ref.read(bikeQueryProvider.notifier).state = query
                                .copyWith(city: null),
                      ),
                    if (query.minPrice != null || query.maxPrice != null)
                      _ActiveFilterChip(
                        label:
                            'Rs. ${query.minPrice?.round() ?? 0} - ${query.maxPrice?.round() ?? '5000+'}',
                        onRemoved: () =>
                            ref.read(bikeQueryProvider.notifier).state = query
                                .copyWith(minPrice: null, maxPrice: null),
                      ),
                    if (!query.availableOnly)
                      _ActiveFilterChip(
                        label: 'Including unavailable',
                        onRemoved: () =>
                            ref.read(bikeQueryProvider.notifier).state = query
                                .copyWith(availableOnly: true),
                      ),
                  ],
                ),
              )
            else if (_recent.isNotEmpty)
              SizedBox(
                height: 36,
                child: Row(
                  children: [
                    Expanded(
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        itemCount: _recent.length,
                        separatorBuilder: (context, index) =>
                            const SizedBox(width: AppSpacing.sm),
                        itemBuilder: (context, index) => ActionChip(
                          avatar: const Icon(
                            Icons.history,
                            size: 16,
                            color: AppColors.textSecondary,
                          ),
                          label: Text(_recent[index]),
                          onPressed: () => _submit(_recent[index]),
                        ),
                      ),
                    ),
                    TextButton(
                      onPressed: () async {
                        await LocalStore.clearRecentSearches();
                        setState(() => _recent = const []);
                      },
                      child: const Text('Clear'),
                    ),
                  ],
                ),
              ),
            const SizedBox(height: AppSpacing.sm),

            Expanded(
              child: bikes.when(
                loading: () => const LoadingView(label: 'Searching bikes...'),
                error: (error, _) => ErrorView(
                  message: error.toString(),
                  onRetry: () => ref.invalidate(bikesProvider),
                ),
                data: (items) {
                  if (items.isEmpty) {
                    return _NoResults(
                      onClear: () {
                        _searchController.clear();
                        ref.read(bikeQueryProvider.notifier).state =
                            const BikeQuery();
                        setState(() {});
                      },
                    );
                  }
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            '${items.length} bikes found',
                            style: textTheme.bodyMedium,
                          ),
                          TextButton.icon(
                            onPressed: () {
                              final byRating = query.sortBy == 'rating';
                              ref.read(bikeQueryProvider.notifier).state = query
                                  .copyWith(
                                    sortBy: byRating ? 'createdAt' : 'rating',
                                    sortOrder: 'desc',
                                  );
                            },
                            icon: const Icon(Icons.sort, size: 18),
                            label: Text(
                              query.sortBy == 'rating'
                                  ? 'Sorted by Rating'
                                  : 'Sort by Rating',
                            ),
                          ),
                        ],
                      ),
                      Expanded(
                        child: _mapView
                            ? _ResultsMap(bikes: items)
                            : _ResultsList(
                                bikes: items,
                                compareSelection: compareSelection,
                                onCompareToggle: _toggleCompare,
                              ),
                      ),
                    ],
                  );
                },
              ),
            ),

            // Compare bar appears once 2+ bikes are picked (UI-04).
            if (compareSelection.length >= 2)
              Padding(
                padding: const EdgeInsets.only(top: AppSpacing.sm),
                child: ElevatedButton.icon(
                  onPressed: () => context.push(
                    '/compare?ids=${compareSelection.map((b) => b.id).join(',')}',
                  ),
                  icon: const Icon(Icons.compare_arrows),
                  label: Text('Compare ${compareSelection.length} bikes'),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _ActiveFilterChip extends StatelessWidget {
  final String label;
  final VoidCallback onRemoved;

  const _ActiveFilterChip({required this.label, required this.onRemoved});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: AppSpacing.sm),
      child: InputChip(
        label: Text(label),
        backgroundColor: AppColors.mint,
        deleteIcon: const Icon(Icons.close, size: 16),
        onDeleted: onRemoved,
      ),
    );
  }
}

/// Full-width result rows with address and nearest landmark so people
/// who do not read maps well still understand locations (UI-08, MAP-04).
class _ResultsList extends StatelessWidget {
  final List<Bike> bikes;
  final List<Bike> compareSelection;
  final void Function(Bike) onCompareToggle;

  const _ResultsList({
    required this.bikes,
    required this.compareSelection,
    required this.onCompareToggle,
  });

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;

    return ListView.separated(
      itemCount: bikes.length,
      separatorBuilder: (context, index) =>
          const SizedBox(height: AppSpacing.md),
      itemBuilder: (context, index) {
        final bike = bikes[index];
        final selected = compareSelection.any((b) => b.id == bike.id);
        return Card(
          clipBehavior: Clip.antiAlias,
          shape: selected
              ? RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AppRadius.large),
                  side: const BorderSide(color: AppColors.primary, width: 2),
                )
              : null,
          child: InkWell(
            onTap: () => context.push('/bike/${bike.id}'),
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          bike.title,
                          style: textTheme.titleMedium,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      Text(
                        'Rs. ${bike.pricePerDay.toStringAsFixed(0)}',
                        style: textTheme.titleMedium?.copyWith(
                          color: AppColors.primary,
                        ),
                      ),
                      Text('/day', style: textTheme.labelSmall),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      const Icon(
                        Icons.location_on_outlined,
                        size: 16,
                        color: AppColors.textMuted,
                      ),
                      const SizedBox(width: 2),
                      Expanded(
                        child: Text(
                          '${bike.location.address}, ${bike.location.city}',
                          style: textTheme.bodyMedium,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                  if (bike.location.landmark != null) ...[
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        const Icon(
                          Icons.flag_outlined,
                          size: 16,
                          color: AppColors.teal,
                        ),
                        const SizedBox(width: 2),
                        Expanded(
                          child: Text(
                            bike.location.landmark!,
                            style: textTheme.bodyMedium?.copyWith(
                              color: AppColors.teal,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ],
                  const SizedBox(height: AppSpacing.sm),
                  Row(
                    children: [
                      if (bike.ratingCount > 0) ...[
                        const Icon(
                          Icons.star,
                          size: 16,
                          color: AppColors.warning,
                        ),
                        Text(
                          ' ${bike.averageRating.toStringAsFixed(1)} (${bike.ratingCount})',
                          style: textTheme.bodyMedium,
                        ),
                        const SizedBox(width: AppSpacing.md),
                      ],
                      Icon(
                        bike.fuelType == 'electric'
                            ? Icons.electric_bolt
                            : Icons.two_wheeler,
                        size: 16,
                        color: AppColors.textMuted,
                      ),
                      Text(
                        bike.fuelType == 'electric'
                            ? ' Electric'
                            : ' ${bike.engineCc}cc',
                        style: textTheme.bodyMedium,
                      ),
                      const Spacer(),
                      TextButton.icon(
                        onPressed: () => onCompareToggle(bike),
                        icon: Icon(
                          selected
                              ? Icons.check_box
                              : Icons.check_box_outline_blank,
                          size: 18,
                        ),
                        label: const Text('Compare'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

class _ResultsMap extends StatefulWidget {
  final List<Bike> bikes;

  const _ResultsMap({required this.bikes});

  @override
  State<_ResultsMap> createState() => _ResultsMapState();
}

class _ResultsMapState extends State<_ResultsMap> {
  Bike? _selected;

  @override
  void didUpdateWidget(covariant _ResultsMap oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (_selected != null &&
        !widget.bikes.any((bike) => bike.id == _selected!.id)) {
      _selected = null;
    }
  }

  @override
  Widget build(BuildContext context) {
    final withCoords = widget.bikes
        .where(
          (b) => b.location.latitude != null && b.location.longitude != null,
        )
        .toList();

    final initialCenter = withCoords.isEmpty
        ? const LatLng(AppConstants.defaultLat, AppConstants.defaultLng)
        : LatLng(
            withCoords.first.location.latitude!,
            withCoords.first.location.longitude!,
          );

    return ClipRRect(
      borderRadius: BorderRadius.circular(AppRadius.large),
      child: Stack(
        children: [
          FlutterMap(
            options: MapOptions(
              initialCenter: initialCenter,
              initialZoom: 13,
              minZoom: 3,
              maxZoom: 19,
              onTap: (_, _) => setState(() => _selected = null),
            ),
            children: [
              const OpenStreetMapTileLayer(),
              MarkerLayer(
                markers: withCoords
                    .map(
                      (bike) => Marker(
                        key: ValueKey('search-bike-marker-${bike.id}'),
                        point: LatLng(
                          bike.location.latitude!,
                          bike.location.longitude!,
                        ),
                        width: 48,
                        height: 48,
                        alignment: Alignment.topCenter,
                        child: Semantics(
                          button: true,
                          label: '${bike.title}, show pickup summary',
                          child: GestureDetector(
                            behavior: HitTestBehavior.opaque,
                            onTap: () => setState(() => _selected = bike),
                            child: Icon(
                              Icons.location_pin,
                              size: _selected?.id == bike.id ? 48 : 42,
                              color: bike.isAvailable
                                  ? AppColors.action
                                  : Colors.deepPurple,
                              shadows: const [
                                Shadow(
                                  color: Colors.black38,
                                  offset: Offset(0, 2),
                                  blurRadius: 4,
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    )
                    .toList(),
              ),
              const OpenStreetMapAttribution(),
            ],
          ),
          if (_selected != null)
            Positioned(
              left: AppSpacing.sm,
              right: AppSpacing.sm,
              bottom: 30,
              child: Semantics(
                button: true,
                label: 'View ${_selected!.title} details',
                child: Card(
                  clipBehavior: Clip.antiAlias,
                  child: InkWell(
                    onTap: () => context.push('/bike/${_selected!.id}'),
                    child: Padding(
                      padding: const EdgeInsets.all(AppSpacing.sm),
                      child: Row(
                        children: [
                          const Icon(
                            Icons.two_wheeler,
                            color: AppColors.primary,
                          ),
                          const SizedBox(width: AppSpacing.sm),
                          Expanded(
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  _selected!.title,
                                  style: Theme.of(context).textTheme.titleSmall,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                Text(
                                  '${_selected!.location.label} • '
                                  'Rs. ${_selected!.pricePerDay.toStringAsFixed(0)}/day',
                                  style: Theme.of(context).textTheme.bodySmall,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                            ),
                          ),
                          const Icon(Icons.chevron_right),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Empty state straight from the prototype: explain and offer a way out.
class _NoResults extends StatelessWidget {
  final VoidCallback onClear;

  const _NoResults({required this.onClear});

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;

    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: const BoxDecoration(
              color: AppColors.primaryLight,
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.search_off,
              size: 40,
              color: AppColors.primary,
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          Text('No bikes found', style: textTheme.titleLarge),
          const SizedBox(height: AppSpacing.xs),
          Text(
            'Try adjusting your filters or searching a different area.',
            style: textTheme.bodyMedium,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: AppSpacing.md),
          SizedBox(
            width: 180,
            child: ElevatedButton(
              onPressed: onClear,
              child: const Text('Clear Filters'),
            ),
          ),
        ],
      ),
    );
  }
}
