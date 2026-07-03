import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../app/theme/app_theme.dart';
import '../../../../core/services/local_store.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../core/widgets/error_view.dart';
import '../../../../core/widgets/loading_view.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
import '../../../reviews/data/review_api.dart';
import '../../data/bike_model.dart';
import '../providers/bikes_provider.dart';

/// Bike detail: photos, verified owner badge (TR-01), pickup card with
/// landmark and walk time (MAP-01/04), damage policy (TR-06) and real
/// renter reviews (TR-02). Booking starts here and the draft is saved
/// so a crash never loses progress (UI-06).
class BikeDetailPage extends ConsumerStatefulWidget {
  final String bikeId;

  const BikeDetailPage({super.key, required this.bikeId});

  @override
  ConsumerState<BikeDetailPage> createState() => _BikeDetailPageState();
}

class _BikeDetailPageState extends ConsumerState<BikeDetailPage> {
  int _photoIndex = 0;

  Future<void> _openDirections(Bike bike) async {
    final lat = bike.location.latitude;
    final lng = bike.location.longitude;
    if (lat == null || lng == null) return;
    final uri = Uri.parse(
        'https://www.google.com/maps/dir/?api=1&destination=$lat,$lng&travelmode=walking');
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  Future<void> _startBooking(Bike bike) async {
    final auth = ref.read(authProvider).valueOrNull;

    // Save the draft first so nothing is lost, even on a crash (UI-06).
    await LocalStore.saveBookingDraft({
      'bikeId': bike.id,
      'bikeTitle': bike.title,
      'imageUrl': bike.imageUrls.isEmpty ? '' : bike.imageUrls.first,
    });

    if (!mounted) return;
    if (auth == null) {
      // Sign-up prompt appears only at booking time (UI-01).
      final signIn = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppRadius.large)),
          icon: const Icon(Icons.lock_open, size: 40, color: AppColors.primary),
          title: const Text('Sign in to book'),
          content: const Text(
              'Browsing is free forever. To book this bike we just need an account so the owner knows who is riding.'),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text('Keep browsing'),
            ),
            ElevatedButton(
              onPressed: () => Navigator.of(context).pop(true),
              child: const Text('Sign In'),
            ),
          ],
        ),
      );
      if (signIn == true && mounted) context.push('/auth');
      return;
    }

    // Full booking flow ships in Sprint 3.
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
          content:
              Text('Booking saved as draft - the 3-tap booking flow is coming next sprint.')),
    );
  }

  void _showOwnerDetails(BikeOwner owner) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius:
            BorderRadius.vertical(top: Radius.circular(AppRadius.large)),
      ),
      builder: (context) => Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                CircleAvatar(
                  radius: 26,
                  backgroundColor: AppColors.primaryLight,
                  backgroundImage: owner.profilePictureUrl != null
                      ? CachedNetworkImageProvider(owner.profilePictureUrl!)
                      : null,
                  child: owner.profilePictureUrl == null
                      ? const Icon(Icons.person, color: AppColors.primary)
                      : null,
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(owner.fullName,
                          style: Theme.of(context).textTheme.titleLarge),
                      if (owner.isVerified)
                        Row(
                          children: [
                            const Icon(Icons.verified,
                                size: 16, color: AppColors.success),
                            Text(
                              ' Verified by Bike Buddy'
                              '${owner.verifiedAt != null ? ' · ${DateFormat('MMM yyyy').format(owner.verifiedAt!)}' : ''}',
                              style: const TextStyle(
                                  fontSize: 13, color: AppColors.success),
                            ),
                          ],
                        )
                      else
                        const Text('Not verified yet',
                            style: TextStyle(
                                fontSize: 13, color: AppColors.warning)),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.md),
            Text(
              owner.isVerified
                  ? 'Verified owners have submitted their identity documents and bike ownership papers, which our team has checked.'
                  : 'This owner has not completed verification yet. You can still rent, but verified owners are the safer choice.',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            if (owner.bio != null) ...[
              const SizedBox(height: AppSpacing.sm),
              Text('"${owner.bio!}"',
                  style: Theme.of(context)
                      .textTheme
                      .bodyMedium
                      ?.copyWith(fontStyle: FontStyle.italic)),
            ],
            const SizedBox(height: AppSpacing.md),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final bikeAsync = ref.watch(bikeDetailProvider(widget.bikeId));

    return Scaffold(
      appBar: AppBar(title: const Text('Bike Details')),
      body: bikeAsync.when(
        loading: () => const LoadingView(label: 'Loading bike details...'),
        error: (error, _) => ErrorView(
          message: error.toString(),
          onRetry: () => ref.invalidate(bikeDetailProvider(widget.bikeId)),
        ),
        data: (bike) => _buildDetail(bike),
      ),
      bottomNavigationBar: bikeAsync.maybeWhen(
        data: (bike) => SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: Row(
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      Formatters.npr(bike.pricePerDay),
                      style: Theme.of(context)
                          .textTheme
                          .titleLarge
                          ?.copyWith(color: AppColors.primary),
                    ),
                    Text('per day',
                        style: Theme.of(context).textTheme.labelSmall),
                  ],
                ),
                const SizedBox(width: AppSpacing.lg),
                Expanded(
                  child: ElevatedButton(
                    onPressed:
                        bike.isAvailable ? () => _startBooking(bike) : null,
                    child: Text(
                        bike.isAvailable ? 'Book Now' : 'Not available now'),
                  ),
                ),
              ],
            ),
          ),
        ),
        orElse: () => null,
      ),
    );
  }

  Widget _buildDetail(Bike bike) {
    final textTheme = Theme.of(context).textTheme;
    final reviews = ref.watch(bikeReviewsProvider(bike.id));

    return ListView(
      padding: const EdgeInsets.only(bottom: AppSpacing.lg),
      children: [
        // Photo carousel with dots.
        SizedBox(
          height: 240,
          child: Stack(
            children: [
              PageView.builder(
                itemCount: bike.imageUrls.isEmpty ? 1 : bike.imageUrls.length,
                onPageChanged: (index) => setState(() => _photoIndex = index),
                itemBuilder: (context, index) => bike.imageUrls.isEmpty
                    ? Container(
                        color: AppColors.primaryLight,
                        child: const Icon(Icons.two_wheeler,
                            size: 96, color: AppColors.primary),
                      )
                    : CachedNetworkImage(
                        imageUrl: bike.imageUrls[index],
                        fit: BoxFit.cover,
                        errorWidget: (context, url, error) => Container(
                          color: AppColors.primaryLight,
                          child: const Icon(Icons.two_wheeler,
                              size: 96, color: AppColors.primary),
                        ),
                      ),
              ),
              if (bike.imageUrls.length > 1)
                Positioned(
                  bottom: AppSpacing.sm,
                  left: 0,
                  right: 0,
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: List.generate(
                      bike.imageUrls.length,
                      (index) => Container(
                        margin: const EdgeInsets.symmetric(horizontal: 3),
                        width: index == _photoIndex ? 20 : 8,
                        height: 8,
                        decoration: BoxDecoration(
                          color: index == _photoIndex
                              ? Colors.white
                              : Colors.white54,
                          borderRadius: BorderRadius.circular(AppRadius.pill),
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),

        Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Title, rating and availability grouped (proximity).
              Row(
                children: [
                  Expanded(child: Text(bike.title, style: textTheme.displayLarge)),
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.sm, vertical: 4),
                    decoration: BoxDecoration(
                      color: bike.isAvailable ? AppColors.mint : AppColors.divider,
                      borderRadius: BorderRadius.circular(AppRadius.pill),
                    ),
                    child: Text(
                      bike.isAvailable ? 'AVAILABLE' : 'BUSY',
                      style: const TextStyle(
                          fontSize: 11, fontWeight: FontWeight.w700),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Row(
                children: [
                  if (bike.ratingCount > 0) ...[
                    const Icon(Icons.star, size: 18, color: AppColors.warning),
                    Text(
                      ' ${bike.averageRating.toStringAsFixed(1)} (${bike.ratingCount} reviews)',
                      style: textTheme.bodyMedium,
                    ),
                    const SizedBox(width: AppSpacing.md),
                  ],
                  Text('${bike.brand} · ${bike.year}',
                      style: textTheme.bodyMedium),
                ],
              ),
              const SizedBox(height: AppSpacing.md),

              // Verified owner badge (TR-01) - tap for details.
              if (bike.owner != null)
                Card(
                  child: ListTile(
                    onTap: () => _showOwnerDetails(bike.owner!),
                    leading: CircleAvatar(
                      backgroundColor: AppColors.primaryLight,
                      child: const Icon(Icons.person, color: AppColors.primary),
                    ),
                    title: Text(bike.owner!.fullName),
                    subtitle: bike.owner!.isVerified
                        ? const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.verified,
                                  size: 14, color: AppColors.success),
                              Text(' Verified Owner',
                                  style: TextStyle(
                                      color: AppColors.success, fontSize: 13)),
                            ],
                          )
                        : const Text('Not verified yet',
                            style: TextStyle(
                                color: AppColors.warning, fontSize: 13)),
                    trailing: const Icon(Icons.info_outline,
                        color: AppColors.textMuted),
                  ),
                ),
              const SizedBox(height: AppSpacing.md),

              // Pickup point card with landmark + walk time (MAP-01/04).
              Text('Pickup point', style: textTheme.titleLarge),
              const SizedBox(height: AppSpacing.sm),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.location_on,
                              color: AppColors.primary),
                          const SizedBox(width: AppSpacing.sm),
                          Expanded(
                            child: Text(
                              '${bike.location.label}\n${bike.location.address}, ${bike.location.city}',
                              style: textTheme.bodyLarge,
                            ),
                          ),
                        ],
                      ),
                      if (bike.location.landmark != null) ...[
                        const SizedBox(height: AppSpacing.sm),
                        Row(
                          children: [
                            const Icon(Icons.flag_outlined,
                                size: 18, color: AppColors.teal),
                            const SizedBox(width: AppSpacing.sm),
                            Expanded(
                              child: Text(
                                bike.location.landmark!,
                                style: textTheme.bodyMedium
                                    ?.copyWith(color: AppColors.teal),
                              ),
                            ),
                          ],
                        ),
                      ],
                      if (bike.distanceKm != null) ...[
                        const SizedBox(height: AppSpacing.sm),
                        Row(
                          children: [
                            const Icon(Icons.directions_walk,
                                size: 18, color: AppColors.accent),
                            const SizedBox(width: AppSpacing.sm),
                            Text(
                              '${bike.distanceKm!.toStringAsFixed(1)} km · ${Formatters.walkingMinutes(bike.distanceKm!)}',
                              style: textTheme.bodyMedium,
                            ),
                          ],
                        ),
                      ],
                      const SizedBox(height: AppSpacing.sm),
                      OutlinedButton.icon(
                        onPressed: () => _openDirections(bike),
                        icon: const Icon(Icons.navigation_outlined, size: 18),
                        label: const Text('Get Directions'),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: AppSpacing.md),

              // Quick specs (full specs tab arrives in Sprint 4).
              Text('About this bike', style: textTheme.titleLarge),
              const SizedBox(height: AppSpacing.sm),
              Wrap(
                spacing: AppSpacing.sm,
                runSpacing: AppSpacing.sm,
                children: [
                  _SpecChip(
                      icon: Icons.speed, label: '${bike.engineCc} cc'),
                  _SpecChip(
                      icon: Icons.local_gas_station,
                      label: bike.fuelType[0].toUpperCase() +
                          bike.fuelType.substring(1)),
                  _SpecChip(
                      icon: Icons.settings,
                      label: bike.transmission == 'manual'
                          ? 'Manual'
                          : 'Automatic'),
                  _SpecChip(
                      icon: Icons.category_outlined,
                      label: bike.category[0].toUpperCase() +
                          bike.category.substring(1)),
                ],
              ),
              if (bike.description != null) ...[
                const SizedBox(height: AppSpacing.sm),
                Text(bike.description!, style: textTheme.bodyMedium),
              ],
              const SizedBox(height: AppSpacing.md),

              // Damage & dispute policy, expandable (TR-06).
              Card(
                child: ExpansionTile(
                  leading: const Icon(Icons.shield_outlined,
                      color: AppColors.primary),
                  title: const Text('Damage & Dispute Policy'),
                  subtitle: const Text('Know what happens before you ride'),
                  childrenPadding: const EdgeInsets.fromLTRB(
                      AppSpacing.md, 0, AppSpacing.md, AppSpacing.md),
                  children: const [
                    _PolicyPoint(
                        text:
                            'Photograph the bike at pickup - your photos are proof of its condition.'),
                    _PolicyPoint(
                        text:
                            'Minor wear is covered by the deposit. Bigger damage is settled through Bike Buddy, never in cash on the street.'),
                    _PolicyPoint(
                        text:
                            'Any dispute is reviewed by our team within 24 hours with both sides heard.'),
                  ],
                ),
              ),
              if (bike.securityDeposit > 0) ...[
                const SizedBox(height: AppSpacing.sm),
                Row(
                  children: [
                    const Icon(Icons.lock_outline,
                        size: 16, color: AppColors.textMuted),
                    Text(
                      ' Refundable deposit: ${Formatters.npr(bike.securityDeposit)}',
                      style: textTheme.bodyMedium,
                    ),
                  ],
                ),
              ],
              const SizedBox(height: AppSpacing.md),

              // Reviews from verified rides only (TR-02).
              Text('Reviews', style: textTheme.titleLarge),
              const SizedBox(height: AppSpacing.sm),
              reviews.when(
                loading: () => const Padding(
                  padding: EdgeInsets.all(AppSpacing.md),
                  child: Center(child: CircularProgressIndicator()),
                ),
                error: (error, _) => Text('Could not load reviews.',
                    style: textTheme.bodyMedium),
                data: (items) => items.isEmpty
                    ? Card(
                        child: Padding(
                          padding: const EdgeInsets.all(AppSpacing.md),
                          child: Text(
                            'No reviews yet. Reviews can only be written by renters who completed a ride, so every one you see here is real.',
                            style: textTheme.bodyMedium,
                          ),
                        ),
                      )
                    : Column(
                        children: items
                            .map((review) => Card(
                                  margin: const EdgeInsets.only(
                                      bottom: AppSpacing.sm),
                                  child: Padding(
                                    padding:
                                        const EdgeInsets.all(AppSpacing.md),
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Row(
                                          children: [
                                            Row(
                                              children: List.generate(
                                                5,
                                                (i) => Icon(
                                                  i < review.rating
                                                      ? Icons.star
                                                      : Icons.star_border,
                                                  size: 16,
                                                  color: AppColors.warning,
                                                ),
                                              ),
                                            ),
                                            const SizedBox(
                                                width: AppSpacing.sm),
                                            if (review.isVerifiedRide)
                                              Container(
                                                padding: const EdgeInsets
                                                    .symmetric(
                                                    horizontal: 6,
                                                    vertical: 2),
                                                decoration: BoxDecoration(
                                                  color: AppColors.mint,
                                                  borderRadius:
                                                      BorderRadius.circular(
                                                          AppRadius.pill),
                                                ),
                                                child: const Text(
                                                  'Verified ride',
                                                  style: TextStyle(
                                                      fontSize: 10,
                                                      fontWeight:
                                                          FontWeight.w700),
                                                ),
                                              ),
                                            const Spacer(),
                                            if (review.createdAt != null)
                                              Text(
                                                DateFormat('d MMM yyyy')
                                                    .format(
                                                        review.createdAt!),
                                                style: textTheme.labelSmall,
                                              ),
                                          ],
                                        ),
                                        const SizedBox(height: AppSpacing.sm),
                                        Text(review.comment,
                                            style: textTheme.bodyMedium),
                                      ],
                                    ),
                                  ),
                                ))
                            .toList(),
                      ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _SpecChip extends StatelessWidget {
  final IconData icon;
  final String label;

  const _SpecChip({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md, vertical: AppSpacing.sm),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadius.pill),
        border: Border.all(color: AppColors.divider),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: AppColors.primary),
          const SizedBox(width: 6),
          Text(label, style: const TextStyle(fontSize: 13)),
        ],
      ),
    );
  }
}

class _PolicyPoint extends StatelessWidget {
  final String text;

  const _PolicyPoint({required this.text});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.check_circle_outline,
              size: 18, color: AppColors.success),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(text, style: Theme.of(context).textTheme.bodyMedium),
          ),
        ],
      ),
    );
  }
}
