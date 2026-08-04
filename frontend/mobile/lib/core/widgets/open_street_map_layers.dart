import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:url_launcher/url_launcher.dart';

import '../utils/open_street_map.dart';

/// Standard OSM raster tiles with an application-specific request identity.
class OpenStreetMapTileLayer extends StatelessWidget {
  const OpenStreetMapTileLayer({super.key});

  @override
  Widget build(BuildContext context) {
    return TileLayer(
      urlTemplate: OpenStreetMapConfig.tileUrl,
      userAgentPackageName: OpenStreetMapConfig.userAgentPackageName,
      maxNativeZoom: 19,
    );
  }
}

/// Always-visible attribution required by the OpenStreetMap tile policy.
class OpenStreetMapAttribution extends StatelessWidget {
  const OpenStreetMapAttribution({
    super.key,
    this.alignment = Alignment.bottomRight,
  });

  final Alignment alignment;

  @override
  Widget build(BuildContext context) {
    return SimpleAttributionWidget(
      source: const Text('OpenStreetMap contributors'),
      alignment: alignment,
      backgroundColor: Colors.white.withValues(alpha: 0.88),
      onTap: () => unawaited(
        launchUrl(
          Uri.parse(OpenStreetMapConfig.attributionUrl),
          mode: LaunchMode.externalApplication,
        ),
      ),
    );
  }
}
