import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';

import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_theme.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/services/permission_service.dart';
import '../../../core/widgets/open_street_map_layers.dart';
import '../../bikes/data/bike_api.dart';
import '../../bikes/data/bike_model.dart';

/// Map of nearby available bikes (MAP-05). Available pins show by default;
/// a toggle reveals unavailable ones. When location is denied, the map still
/// works from a clearly explained Kathmandu fallback (UI-10).
class MapPage extends ConsumerStatefulWidget {
  const MapPage({super.key});

  @override
  ConsumerState<MapPage> createState() => _MapPageState();
}

class _MapPageState extends ConsumerState<MapPage> {
  final MapController _mapController = MapController();
  LatLng _center = const LatLng(
    AppConstants.defaultLat,
    AppConstants.defaultLng,
  );
  List<Bike> _bikes = const [];
  Bike? _selected;
  bool _showUnavailable = false;
  bool _loading = true;
  bool _mapReady = false;
  bool _hasDeviceLocation = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _init());
  }

  @override
  void dispose() {
    _mapController.dispose();
    super.dispose();
  }

  Future<void> _init() async {
    // Ask for location with a plain-language reason first (UI-10).
    final granted = await PermissionService.requestLocation(context);
    if (!mounted) return;

    if (granted) {
      try {
        final position = await Geolocator.getCurrentPosition(
          locationSettings: const LocationSettings(
            accuracy: LocationAccuracy.high,
          ),
        ).timeout(const Duration(seconds: 8));
        if (!mounted) return;
        setState(() {
          _center = LatLng(position.latitude, position.longitude);
          _hasDeviceLocation = true;
        });
        if (_mapReady) _mapController.move(_center, 14);
      } catch (_) {
        // Keep the Kathmandu fallback centre when the device cannot locate.
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text(
                'Location is unavailable right now. Showing Kathmandu instead.',
              ),
            ),
          );
        }
      }
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Showing Kathmandu. Allow location any time to see bikes near you.',
          ),
        ),
      );
    }
    await _loadBikes();
  }

  Future<void> _loadBikes() async {
    if (!mounted) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final api = ref.read(bikeApiProvider);
      final bikes = await api.listBikes(
        lat: _center.latitude,
        lng: _center.longitude,
        radiusKm: AppConstants.defaultRadiusKm,
        includeUnavailable: _showUnavailable,
        limit: 50,
      );
      if (mounted) {
        setState(() {
          _bikes = bikes;
          _loading = false;
          if (_selected != null &&
              !bikes.any((bike) => bike.id == _selected!.id)) {
            _selected = null;
          }
        });
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _error = error.toString();
          _loading = false;
        });
      }
    }
  }

  /// This is intentionally a straight visual guide, not a route calculation.
  /// The label in the selected card makes that limitation explicit (MAP-02).
  List<Polyline> get _guideLines {
    final bike = _selected;
    if (bike == null ||
        bike.location.latitude == null ||
        bike.location.longitude == null) {
      return const [];
    }
    return [
      Polyline(
        points: [
          _center,
          LatLng(bike.location.latitude!, bike.location.longitude!),
        ],
        color: AppColors.primary,
        strokeWidth: 4,
        pattern: StrokePattern.dashed(segments: const [12, 8]),
      ),
    ];
  }

  List<Marker> get _markers => [
    if (_hasDeviceLocation)
      Marker(
        key: const ValueKey('current-location-marker'),
        point: _center,
        width: 34,
        height: 34,
        child: Semantics(
          label: 'Your current location',
          child: Container(
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.22),
              shape: BoxShape.circle,
            ),
            alignment: Alignment.center,
            child: Container(
              width: 14,
              height: 14,
              decoration: const BoxDecoration(
                color: AppColors.primary,
                shape: BoxShape.circle,
                border: Border.fromBorderSide(
                  BorderSide(color: Colors.white, width: 3),
                ),
              ),
            ),
          ),
        ),
      ),
    ..._bikes
        .where(
          (bike) =>
              bike.location.latitude != null && bike.location.longitude != null,
        )
        .map(
          (bike) => Marker(
            key: ValueKey('bike-marker-${bike.id}'),
            point: LatLng(bike.location.latitude!, bike.location.longitude!),
            width: 48,
            height: 48,
            alignment: Alignment.topCenter,
            child: Semantics(
              button: true,
              label:
                  '${bike.title}, ${bike.isAvailable ? 'available' : 'busy'}',
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
        ),
  ];

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final bottomControlOffset = _selected == null ? 34.0 : 186.0;

    return Scaffold(
      appBar: AppBar(title: const Text('Bikes Near You')),
      body: Stack(
        children: [
          FlutterMap(
            mapController: _mapController,
            options: MapOptions(
              initialCenter: _center,
              initialZoom: 14,
              minZoom: 3,
              maxZoom: 19,
              onMapReady: () {
                _mapReady = true;
                _mapController.move(_center, 14);
              },
              onTap: (_, _) => setState(() => _selected = null),
            ),
            children: [
              const OpenStreetMapTileLayer(),
              if (_guideLines.isNotEmpty) PolylineLayer(polylines: _guideLines),
              MarkerLayer(markers: _markers),
              const OpenStreetMapAttribution(),
            ],
          ),

          // Legend + availability toggle (H1: clear system status).
          Positioned(
            top: AppSpacing.md,
            left: AppSpacing.md,
            right: AppSpacing.md,
            child: Card(
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.md,
                  vertical: AppSpacing.xs,
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Wrap(
                        spacing: AppSpacing.sm,
                        runSpacing: 2,
                        children: [
                          _LegendItem(
                            color: AppColors.action,
                            label: 'Available',
                            textStyle: textTheme.labelSmall,
                          ),
                          _LegendItem(
                            color: Colors.deepPurple,
                            label: 'Busy',
                            textStyle: textTheme.labelSmall,
                          ),
                        ],
                      ),
                    ),
                    Text('Show busy', style: textTheme.labelSmall),
                    Switch(
                      value: _showUnavailable,
                      onChanged: (value) {
                        setState(() => _showUnavailable = value);
                        unawaited(_loadBikes());
                      },
                    ),
                  ],
                ),
              ),
            ),
          ),

          Positioned(
            right: AppSpacing.md,
            bottom: bottomControlOffset,
            child: FloatingActionButton.small(
              heroTag: 'map-recentre',
              tooltip: _hasDeviceLocation
                  ? 'Centre on my location'
                  : 'Centre on Kathmandu',
              onPressed: () => _mapController.move(_center, 14),
              child: Icon(
                _hasDeviceLocation ? Icons.my_location : Icons.location_city,
              ),
            ),
          ),

          if (_loading)
            const Positioned(
              top: 90,
              left: 0,
              right: 0,
              child: Center(
                child: Card(
                  child: Padding(
                    padding: EdgeInsets.all(AppSpacing.sm),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                        SizedBox(width: AppSpacing.sm),
                        Text('Updating bikes...'),
                      ],
                    ),
                  ),
                ),
              ),
            ),

          if (_error != null)
            Positioned(
              bottom: 30,
              left: AppSpacing.md,
              right: AppSpacing.md,
              child: Card(
                color: AppColors.error,
                child: Padding(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  child: Row(
                    children: [
                      const Icon(Icons.error_outline, color: Colors.white),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: Text(
                          _error!,
                          style: const TextStyle(color: Colors.white),
                        ),
                      ),
                      TextButton(
                        onPressed: _loadBikes,
                        child: const Text(
                          'Retry',
                          style: TextStyle(color: Colors.white),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),

          // The whole selected-bike card is a large, familiar details target.
          if (_selected != null && _error == null)
            Positioned(
              bottom: 30,
              left: AppSpacing.md,
              right: AppSpacing.md,
              child: Semantics(
                button: true,
                label: 'View ${_selected!.title} details',
                child: Card(
                  clipBehavior: Clip.antiAlias,
                  child: InkWell(
                    onTap: () => context.push('/bike/${_selected!.id}'),
                    child: Padding(
                      padding: const EdgeInsets.all(AppSpacing.md),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  _selected!.title,
                                  style: textTheme.titleMedium,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              _AvailabilityBadge(
                                isAvailable: _selected!.isAvailable,
                              ),
                              const SizedBox(width: AppSpacing.xs),
                              const Icon(Icons.chevron_right),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '${_selected!.location.label} • '
                            '${_selected!.location.address}',
                            style: textTheme.bodyMedium,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: AppSpacing.xs),
                          Row(
                            children: [
                              const Icon(
                                Icons.straighten,
                                size: 16,
                                color: AppColors.accent,
                              ),
                              const SizedBox(width: 4),
                              Expanded(
                                child: Text(
                                  _selected!.distanceKm == null
                                      ? 'Straight-line guide — not a walking route'
                                      : '${_selected!.distanceKm!.toStringAsFixed(1)} km straight-line guide — not a walking route',
                                  style: textTheme.labelSmall,
                                  maxLines: 2,
                                ),
                              ),
                              const SizedBox(width: AppSpacing.sm),
                              Text(
                                'Rs. ${_selected!.pricePerDay.toStringAsFixed(0)}/day',
                                style: textTheme.titleMedium?.copyWith(
                                  color: AppColors.primary,
                                ),
                              ),
                            ],
                          ),
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

class _LegendItem extends StatelessWidget {
  const _LegendItem({
    required this.color,
    required this.label,
    required this.textStyle,
  });

  final Color color;
  final String label;
  final TextStyle? textStyle;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(Icons.circle, size: 12, color: color),
        const SizedBox(width: 4),
        Text(label, style: textStyle),
      ],
    );
  }
}

class _AvailabilityBadge extends StatelessWidget {
  const _AvailabilityBadge({required this.isAvailable});

  final bool isAvailable;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: 2,
      ),
      decoration: BoxDecoration(
        color: isAvailable ? AppColors.mint : AppColors.divider,
        borderRadius: BorderRadius.circular(AppRadius.pill),
      ),
      child: Text(
        isAvailable ? 'AVAILABLE' : 'BUSY',
        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700),
      ),
    );
  }
}
