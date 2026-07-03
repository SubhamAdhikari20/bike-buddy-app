import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_theme.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/services/permission_service.dart';
import '../../bikes/data/bike_api.dart';
import '../../bikes/data/bike_model.dart';

/// Map of nearby available bikes (MAP-05). Available pins show by
/// default; a toggle reveals unavailable ones. Works in a reduced mode
/// centred on Kathmandu when location is denied (UI-10).
class MapPage extends ConsumerStatefulWidget {
  const MapPage({super.key});

  @override
  ConsumerState<MapPage> createState() => _MapPageState();
}

class _MapPageState extends ConsumerState<MapPage> {
  GoogleMapController? _mapController;
  LatLng _center = const LatLng(AppConstants.defaultLat, AppConstants.defaultLng);
  List<Bike> _bikes = const [];
  Bike? _selected;
  bool _showUnavailable = false;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _init());
  }

  Future<void> _init() async {
    // Ask for location with a plain-language reason first (UI-10).
    final granted = await PermissionService.requestLocation(context);
    if (granted) {
      try {
        final position = await Geolocator.getCurrentPosition(
          locationSettings:
              const LocationSettings(accuracy: LocationAccuracy.high),
        ).timeout(const Duration(seconds: 8));
        _center = LatLng(position.latitude, position.longitude);
        _mapController?.animateCamera(CameraUpdate.newLatLng(_center));
      } catch (_) {
        // Keep the Kathmandu fallback centre.
      }
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
              'Showing Kathmandu. Allow location any time to see bikes near you.'),
        ),
      );
    }
    await _loadBikes();
  }

  Future<void> _loadBikes() async {
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
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString();
          _loading = false;
        });
      }
    }
  }

  Set<Marker> get _markers => _bikes
      .where((bike) =>
          bike.location.latitude != null && bike.location.longitude != null)
      .map(
        (bike) => Marker(
          markerId: MarkerId(bike.id),
          position: LatLng(bike.location.latitude!, bike.location.longitude!),
          icon: BitmapDescriptor.defaultMarkerWithHue(
            bike.isAvailable
                ? BitmapDescriptor.hueOrange
                : BitmapDescriptor.hueViolet,
          ),
          onTap: () => setState(() => _selected = bike),
        ),
      )
      .toSet();

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;

    return Scaffold(
      appBar: AppBar(title: const Text('Bikes Near You')),
      body: Stack(
        children: [
          GoogleMap(
            initialCameraPosition: CameraPosition(target: _center, zoom: 14),
            markers: _markers,
            myLocationEnabled: true,
            myLocationButtonEnabled: true,
            zoomControlsEnabled: false,
            onMapCreated: (controller) => _mapController = controller,
            onTap: (_) => setState(() => _selected = null),
          ),

          // Legend + availability toggle (H1: clear system status).
          Positioned(
            top: AppSpacing.md,
            left: AppSpacing.md,
            right: AppSpacing.md,
            child: Card(
              child: Padding(
                padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.md, vertical: AppSpacing.sm),
                child: Row(
                  children: [
                    const Icon(Icons.circle, size: 12, color: AppColors.action),
                    const SizedBox(width: 4),
                    Text('Available', style: textTheme.labelSmall),
                    const SizedBox(width: AppSpacing.md),
                    const Icon(Icons.circle, size: 12, color: Colors.deepPurple),
                    const SizedBox(width: 4),
                    Text('Busy', style: textTheme.labelSmall),
                    const Spacer(),
                    Text('Show busy', style: textTheme.labelSmall),
                    Switch(
                      value: _showUnavailable,
                      onChanged: (value) {
                        setState(() => _showUnavailable = value);
                        _loadBikes();
                      },
                    ),
                  ],
                ),
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
              bottom: AppSpacing.md,
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
                        child: const Text('Retry',
                            style: TextStyle(color: Colors.white)),
                      ),
                    ],
                  ),
                ),
              ),
            ),

          // Selected bike card, like the prototype's bottom sheet.
          if (_selected != null && _error == null)
            Positioned(
              bottom: AppSpacing.md,
              left: AppSpacing.md,
              right: AppSpacing.md,
              child: Card(
                child: Padding(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(_selected!.title,
                                style: textTheme.titleMedium,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: AppSpacing.sm, vertical: 2),
                            decoration: BoxDecoration(
                              color: _selected!.isAvailable
                                  ? AppColors.mint
                                  : AppColors.divider,
                              borderRadius:
                                  BorderRadius.circular(AppRadius.pill),
                            ),
                            child: Text(
                              _selected!.isAvailable ? 'AVAILABLE' : 'BUSY',
                              style: const TextStyle(
                                  fontSize: 11, fontWeight: FontWeight.w700),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${_selected!.location.label} · ${_selected!.location.address}',
                        style: textTheme.bodyMedium,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          if (_selected!.distanceKm != null) ...[
                            const Icon(Icons.directions_walk,
                                size: 16, color: AppColors.accent),
                            Text(
                              ' ${_selected!.distanceKm!.toStringAsFixed(1)} km',
                              style: textTheme.bodyMedium,
                            ),
                            const SizedBox(width: AppSpacing.md),
                          ],
                          Text(
                            'Rs. ${_selected!.pricePerDay.toStringAsFixed(0)}/day',
                            style: textTheme.titleMedium
                                ?.copyWith(color: AppColors.primary),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
