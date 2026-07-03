import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_theme.dart';
import '../../../core/widgets/error_view.dart';
import '../../../core/widgets/loading_view.dart';
import '../data/support_api.dart';

/// Issue tracker (SUP-04): every ticket with a colour-coded status so
/// nobody wonders whether their complaint went into a void.
class TicketsPage extends ConsumerWidget {
  const TicketsPage({super.key});

  Future<void> _rate(
      BuildContext context, WidgetRef ref, SupportTicket ticket) async {
    var stars = 5;
    final controller = TextEditingController();
    final submitted = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setState) => AlertDialog(
          shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppRadius.large)),
          title: const Text('How was our support?'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(
                  5,
                  (i) => IconButton(
                    onPressed: () => setState(() => stars = i + 1),
                    icon: Icon(
                      i < stars ? Icons.star : Icons.star_border,
                      color: AppColors.warning,
                      size: 32,
                    ),
                  ),
                ),
              ),
              TextField(
                controller: controller,
                maxLength: 500,
                decoration:
                    const InputDecoration(hintText: 'Optional comment'),
              ),
            ],
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.of(context).pop(false),
                child: const Text('Cancel')),
            ElevatedButton(
                onPressed: () => Navigator.of(context).pop(true),
                child: const Text('Submit')),
          ],
        ),
      ),
    );

    if (submitted == true) {
      try {
        await ref.read(supportApiProvider).rateTicket(
              ticket.id,
              stars,
              controller.text.trim().isEmpty ? null : controller.text.trim(),
            );
        ref.invalidate(myTicketsProvider);
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Thanks for the feedback!')),
          );
        }
      } catch (_) {}
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tickets = ref.watch(myTicketsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('My Support Tickets')),
      body: tickets.when(
        loading: () => const LoadingView(label: 'Loading your tickets...'),
        error: (error, _) => ErrorView(
          message: error.toString(),
          onRetry: () => ref.invalidate(myTicketsProvider),
        ),
        data: (items) => items.isEmpty
            ? const Center(
                child: Padding(
                  padding: EdgeInsets.all(AppSpacing.lg),
                  child: Text(
                      'No tickets yet. When you report an issue it will be tracked here.'),
                ),
              )
            : RefreshIndicator(
                onRefresh: () async => ref.refresh(myTicketsProvider.future),
                child: ListView.separated(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  itemCount: items.length,
                  separatorBuilder: (context, index) =>
                      const SizedBox(height: AppSpacing.sm),
                  itemBuilder: (context, index) {
                    final ticket = items[index];
                    final (label, color) = switch (ticket.status) {
                      'resolved' => ('Resolved', AppColors.success),
                      'in_review' => ('In Review', AppColors.warning),
                      _ => ('Open', AppColors.primary),
                    };
                    return Card(
                      child: Padding(
                        padding: const EdgeInsets.all(AppSpacing.md),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                if (ticket.type == 'breakdown') ...[
                                  const Icon(Icons.priority_high,
                                      size: 16, color: AppColors.accent),
                                  const SizedBox(width: 4),
                                ],
                                Expanded(
                                  child: Text(ticket.subject,
                                      style: Theme.of(context)
                                          .textTheme
                                          .titleMedium,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis),
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: AppSpacing.sm, vertical: 3),
                                  decoration: BoxDecoration(
                                    color: color.withValues(alpha: 0.12),
                                    borderRadius:
                                        BorderRadius.circular(AppRadius.pill),
                                  ),
                                  child: Text(label,
                                      style: TextStyle(
                                          fontSize: 11,
                                          fontWeight: FontWeight.w700,
                                          color: color)),
                                ),
                              ],
                            ),
                            const SizedBox(height: 4),
                            Text(ticket.message,
                                style:
                                    Theme.of(context).textTheme.bodyMedium,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis),
                            const SizedBox(height: AppSpacing.sm),
                            Row(
                              children: [
                                if (ticket.createdAt != null)
                                  Text(
                                    DateFormat('d MMM yyyy, h:mm a')
                                        .format(ticket.createdAt!),
                                    style: Theme.of(context)
                                        .textTheme
                                        .labelSmall,
                                  ),
                                const Spacer(),
                                if (ticket.status == 'resolved' &&
                                    ticket.rating == null)
                                  TextButton(
                                    onPressed: () =>
                                        _rate(context, ref, ticket),
                                    child: const Text('Rate support'),
                                  )
                                else if (ticket.rating != null)
                                  Row(
                                    children: [
                                      const Icon(Icons.star,
                                          size: 14,
                                          color: AppColors.warning),
                                      Text(' ${ticket.rating}/5',
                                          style: Theme.of(context)
                                              .textTheme
                                              .labelSmall),
                                    ],
                                  ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ),
      ),
    );
  }
}
