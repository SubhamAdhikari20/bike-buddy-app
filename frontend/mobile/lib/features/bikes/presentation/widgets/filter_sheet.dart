import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../app/theme/app_theme.dart';
import '../providers/bikes_provider.dart';

/// Filter bottom sheet (UI-03). Few, clear controls instead of a wall of
/// options (Hick's law); results update as soon as Apply is tapped.
class FilterSheet extends ConsumerStatefulWidget {
  const FilterSheet({super.key});

  static Future<void> show(BuildContext context) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.large)),
      ),
      builder: (context) => const FilterSheet(),
    );
  }

  @override
  ConsumerState<FilterSheet> createState() => _FilterSheetState();
}

class _FilterSheetState extends ConsumerState<FilterSheet> {
  static const _maxPriceCap = 5000.0;
  static const _cities = ['Any city', 'Kathmandu', 'Lalitpur', 'Bhaktapur'];

  late BikeQuery _draft;
  late RangeValues _price;

  @override
  void initState() {
    super.initState();
    _draft = ref.read(bikeQueryProvider);
    _price = RangeValues(
      _draft.minPrice ?? 0,
      _draft.maxPrice ?? _maxPriceCap,
    );
  }

  void _apply() {
    ref.read(bikeQueryProvider.notifier).state = _draft.copyWith(
      minPrice: _price.start <= 0 ? null : _price.start,
      maxPrice: _price.end >= _maxPriceCap ? null : _price.end,
    );
    Navigator.of(context).pop();
  }

  void _reset() {
    setState(() {
      _draft = BikeQuery(search: _draft.search);
      _price = const RangeValues(0, _maxPriceCap);
    });
  }

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;

    return Padding(
      padding: EdgeInsets.only(
        left: AppSpacing.lg,
        right: AppSpacing.lg,
        top: AppSpacing.md,
        bottom: MediaQuery.of(context).viewInsets.bottom + AppSpacing.lg,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.divider,
                borderRadius: BorderRadius.circular(AppRadius.pill),
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Filters', style: textTheme.titleLarge),
              TextButton(onPressed: _reset, child: const Text('Reset')),
            ],
          ),

          Text('Price per day', style: textTheme.titleMedium),
          RangeSlider(
            values: _price,
            min: 0,
            max: _maxPriceCap,
            divisions: 50,
            activeColor: AppColors.primary,
            labels: RangeLabels(
              'Rs. ${_price.start.round()}',
              _price.end >= _maxPriceCap
                  ? 'Rs. ${_maxPriceCap.round()}+'
                  : 'Rs. ${_price.end.round()}',
            ),
            onChanged: (values) => setState(() => _price = values),
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Rs. ${_price.start.round()}', style: textTheme.bodyMedium),
              Text(
                _price.end >= _maxPriceCap
                    ? 'Rs. ${_maxPriceCap.round()}+'
                    : 'Rs. ${_price.end.round()}',
                style: textTheme.bodyMedium,
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),

          Text('Bike type', style: textTheme.titleMedium),
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: BikeQuery.categoryLabels.entries.map((entry) {
              final selected = _draft.category == entry.value;
              return ChoiceChip(
                label: Text(entry.key),
                selected: selected,
                selectedColor: AppColors.mint,
                showCheckmark: false,
                onSelected: (_) =>
                    setState(() => _draft = _draft.copyWith(category: entry.value)),
              );
            }).toList(),
          ),
          const SizedBox(height: AppSpacing.md),

          Text('City', style: textTheme.titleMedium),
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.sm,
            children: _cities.map((city) {
              final value = city == 'Any city' ? null : city;
              final selected = _draft.city == value;
              return ChoiceChip(
                label: Text(city),
                selected: selected,
                selectedColor: AppColors.mint,
                showCheckmark: false,
                onSelected: (_) =>
                    setState(() => _draft = _draft.copyWith(city: value)),
              );
            }).toList(),
          ),
          const SizedBox(height: AppSpacing.sm),

          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Show unavailable bikes too'),
            value: !_draft.availableOnly,
            onChanged: (value) =>
                setState(() => _draft = _draft.copyWith(availableOnly: !value)),
          ),
          const SizedBox(height: AppSpacing.sm),

          ElevatedButton(onPressed: _apply, child: const Text('Apply Filters')),
        ],
      ),
    );
  }
}
