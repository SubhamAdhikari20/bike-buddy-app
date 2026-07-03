import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../app/theme/app_theme.dart';
import '../../../../core/widgets/error_view.dart';
import '../../../../core/widgets/loading_view.dart';
import '../../data/bike_api.dart';
import '../../data/bike_model.dart';
import '../providers/bikes_provider.dart';

final _compareResultProvider =
    FutureProvider.family<List<Bike>, String>((ref, ids) {
  return ref
      .watch(bikeApiProvider)
      .compareBikes(ids.split(',').where((id) => id.isNotEmpty).toList());
});

/// Side-by-side comparison of 2-3 bikes with price, distance and
/// availability visible without tapping, and the best value highlighted
/// (UI-04, Miller's law - a small set of clear facts).
class ComparePage extends ConsumerWidget {
  final String ids;

  const ComparePage({super.key, required this.ids});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final result = ref.watch(_compareResultProvider(ids));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Compare Bikes'),
        actions: [
          TextButton(
            onPressed: () {
              ref.read(compareSelectionProvider.notifier).state = [];
              context.pop();
            },
            child: const Text('Clear'),
          ),
        ],
      ),
      body: result.when(
        loading: () => const LoadingView(label: 'Comparing bikes...'),
        error: (error, _) => ErrorView(
          message: error.toString(),
          onRetry: () => ref.invalidate(_compareResultProvider(ids)),
        ),
        data: (bikes) => SingleChildScrollView(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (var i = 0; i < bikes.length; i++) ...[
                if (i > 0)
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    child: CircleAvatar(
                      radius: 16,
                      backgroundColor: AppColors.primaryLight,
                      child: Text('VS',
                          style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: AppColors.primary)),
                    ),
                  ),
                Expanded(child: _CompareCard(bike: bikes[i])),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _CompareCard extends StatelessWidget {
  final Bike bike;

  const _CompareCard({required this.bike});

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;

    return Card(
      shape: bike.isBestValue
          ? RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppRadius.large),
              side: const BorderSide(color: AppColors.success, width: 2),
            )
          : null,
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (bike.isBestValue)
            Container(
              color: AppColors.success,
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: const Text(
                'BEST VALUE',
                textAlign: TextAlign.center,
                style: TextStyle(
                    color: Colors.white,
                    fontSize: 11,
                    fontWeight: FontWeight.w700),
              ),
            ),
          AspectRatio(
            aspectRatio: 16 / 10,
            child: bike.imageUrls.isEmpty
                ? Container(
                    color: AppColors.primaryLight,
                    child: const Icon(Icons.two_wheeler,
                        size: 40, color: AppColors.primary),
                  )
                : CachedNetworkImage(
                    imageUrl: bike.imageUrls.first,
                    fit: BoxFit.cover,
                    errorWidget: (context, url, error) => Container(
                      color: AppColors.primaryLight,
                      child: const Icon(Icons.two_wheeler,
                          size: 40, color: AppColors.primary),
                    ),
                  ),
          ),
          Padding(
            padding: const EdgeInsets.all(AppSpacing.sm),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(bike.title,
                    style: textTheme.titleMedium,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis),
                const SizedBox(height: 2),
                Row(
                  children: [
                    const Icon(Icons.star, size: 14, color: AppColors.warning),
                    Text(
                      ' ${bike.averageRating.toStringAsFixed(1)} (${bike.ratingCount})',
                      style: textTheme.labelSmall,
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.sm),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text('Rs. ${bike.pricePerDay.toStringAsFixed(0)}',
                        style: textTheme.titleLarge
                            ?.copyWith(color: AppColors.primary)),
                    Text('/day', style: textTheme.labelSmall),
                  ],
                ),
                const Divider(height: AppSpacing.md),
                _SpecRow(label: 'Engine', value: '${bike.engineCc}cc'),
                _SpecRow(
                    label: 'Fuel',
                    value: bike.fuelType[0].toUpperCase() +
                        bike.fuelType.substring(1)),
                _SpecRow(
                    label: 'Gears',
                    value: bike.transmission == 'manual' ? 'Manual' : 'Auto'),
                _SpecRow(label: 'Year', value: '${bike.year}'),
                _SpecRow(
                  label: 'Status',
                  value: bike.isAvailable ? 'Available' : 'Busy',
                  valueColor: bike.isAvailable
                      ? AppColors.success
                      : AppColors.warning,
                ),
                if (bike.distanceKm != null)
                  _SpecRow(
                      label: 'Distance',
                      value: '${bike.distanceKm!.toStringAsFixed(1)} km'),
                const SizedBox(height: AppSpacing.sm),
                // Book directly from the comparison (UI-04).
                ElevatedButton(
                  style: bike.isBestValue
                      ? null
                      : ElevatedButton.styleFrom(
                          backgroundColor: AppColors.surface,
                          foregroundColor: AppColors.primary,
                          side: const BorderSide(color: AppColors.primary),
                        ),
                  onPressed: () => context.push('/bike/${bike.id}'),
                  child: const Text('Select'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SpecRow extends StatelessWidget {
  final String label;
  final String value;
  final Color? valueColor;

  const _SpecRow({required this.label, required this.value, this.valueColor});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style: const TextStyle(
                  fontSize: 12, color: AppColors.textSecondary)),
          Text(
            value,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: valueColor ?? AppColors.textPrimary,
            ),
          ),
        ],
      ),
    );
  }
}
