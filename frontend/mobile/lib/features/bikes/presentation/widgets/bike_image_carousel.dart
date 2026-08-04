import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../app/theme/app_theme.dart';

/// Reusable, swipeable bike gallery based on the Leelame PageView pattern.
///
/// Bike Buddy keeps cached loading and fullscreen support, while exposing the
/// current position and explicit controls so the gallery is usable without a
/// swipe gesture.
class BikeImageCarousel extends StatefulWidget {
  final List<String> imageUrls;
  final String bikeTitle;
  final ValueChanged<int>? onImageTap;

  const BikeImageCarousel({
    super.key,
    required this.imageUrls,
    required this.bikeTitle,
    this.onImageTap,
  });

  @override
  State<BikeImageCarousel> createState() => _BikeImageCarouselState();
}

class _BikeImageCarouselState extends State<BikeImageCarousel> {
  final PageController _controller = PageController();
  int _index = 0;

  @override
  void didUpdateWidget(covariant BikeImageCarousel oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (_index >= widget.imageUrls.length && _index != 0) {
      _index = 0;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_controller.hasClients) _controller.jumpToPage(0);
      });
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _show(int index) {
    if (!_controller.hasClients) return;
    final reduceMotion = MediaQuery.disableAnimationsOf(context);
    if (reduceMotion) {
      _controller.jumpToPage(index);
      return;
    }
    _controller.animateToPage(
      index,
      duration: const Duration(milliseconds: 280),
      curve: Curves.easeOutCubic,
    );
  }

  @override
  Widget build(BuildContext context) {
    final imageCount = widget.imageUrls.length;
    final screenWidth = MediaQuery.sizeOf(context).width;
    final height = (screenWidth * 0.625).clamp(240.0, 380.0);

    return SizedBox(
      height: height,
      child: Stack(
        fit: StackFit.expand,
        children: [
          if (imageCount == 0)
            const _BikeImagePlaceholder()
          else
            PageView.builder(
              controller: _controller,
              itemCount: imageCount,
              onPageChanged: (index) => setState(() => _index = index),
              itemBuilder: (context, index) => Semantics(
                label: '${widget.bikeTitle}, photo ${index + 1} of $imageCount',
                button: widget.onImageTap != null,
                child: GestureDetector(
                  onTap: widget.onImageTap == null
                      ? null
                      : () => widget.onImageTap!(index),
                  child: CachedNetworkImage(
                    imageUrl: widget.imageUrls[index],
                    fit: BoxFit.cover,
                    placeholder: (context, url) => const ColoredBox(
                      color: AppColors.primaryLight,
                      child: Center(child: CircularProgressIndicator()),
                    ),
                    errorWidget: (context, url, error) =>
                        const _BikeImagePlaceholder(isError: true),
                  ),
                ),
              ),
            ),
          if (imageCount > 1) ...[
            Positioned(
              top: AppSpacing.sm,
              right: AppSpacing.sm,
              child: _PositionBadge(current: _index + 1, total: imageCount),
            ),
            Positioned(
              left: AppSpacing.sm,
              top: 0,
              bottom: 0,
              child: Center(
                child: _CarouselButton(
                  tooltip: 'Previous bike photo',
                  icon: Icons.chevron_left,
                  onPressed: () =>
                      _show((_index - 1 + imageCount) % imageCount),
                ),
              ),
            ),
            Positioned(
              right: AppSpacing.sm,
              top: 0,
              bottom: 0,
              child: Center(
                child: _CarouselButton(
                  tooltip: 'Next bike photo',
                  icon: Icons.chevron_right,
                  onPressed: () => _show((_index + 1) % imageCount),
                ),
              ),
            ),
            Positioned(
              left: 0,
              right: 0,
              bottom: AppSpacing.sm,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(
                  imageCount,
                  (index) => AnimatedContainer(
                    duration: const Duration(milliseconds: 180),
                    margin: const EdgeInsets.symmetric(horizontal: 3),
                    width: index == _index ? 20 : 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: index == _index ? Colors.white : Colors.white60,
                      borderRadius: BorderRadius.circular(AppRadius.pill),
                      boxShadow: const [
                        BoxShadow(color: Colors.black26, blurRadius: 3),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _PositionBadge extends StatelessWidget {
  final int current;
  final int total;

  const _PositionBadge({required this.current, required this.total});

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Photo $current of $total',
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: Colors.black.withValues(alpha: 0.68),
          borderRadius: BorderRadius.circular(AppRadius.pill),
        ),
        child: Text(
          '$current / $total',
          style: const TextStyle(
            color: Colors.white,
            fontSize: 12,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }
}

class _CarouselButton extends StatelessWidget {
  final String tooltip;
  final IconData icon;
  final VoidCallback onPressed;

  const _CarouselButton({
    required this.tooltip,
    required this.icon,
    required this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.black.withValues(alpha: 0.58),
      shape: const CircleBorder(),
      child: IconButton(
        constraints: const BoxConstraints.tightFor(width: 48, height: 48),
        tooltip: tooltip,
        color: Colors.white,
        onPressed: onPressed,
        icon: Icon(icon, size: 30),
      ),
    );
  }
}

class _BikeImagePlaceholder extends StatelessWidget {
  final bool isError;

  const _BikeImagePlaceholder({this.isError = false});

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: AppColors.primaryLight,
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              isError ? Icons.broken_image_outlined : Icons.two_wheeler,
              size: 72,
              color: AppColors.primary,
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              isError ? 'Photo could not be loaded' : 'No bike photos yet',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ],
        ),
      ),
    );
  }
}
