import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_theme.dart';
import '../../../core/constants/app_constants.dart';
import '../data/support_api.dart';

/// Help screen: 24/7 phone and chat within two taps (SUP-03), a
/// priority breakdown lane (SUP-02), searchable FAQ answered before any
/// chat is needed (SUP-05, Hick's law) and the issue tracker (SUP-04).
class SupportPage extends ConsumerStatefulWidget {
  const SupportPage({super.key});

  @override
  ConsumerState<SupportPage> createState() => _SupportPageState();
}

class _SupportPageState extends ConsumerState<SupportPage> {
  String _faqSearch = '';

  Future<void> _call(BuildContext context) async {
    final uri = Uri(scheme: 'tel', path: AppConstants.supportPhone);
    final ok = await canLaunchUrl(uri) && await launchUrl(uri);
    if (!ok && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Call us any time: ${AppConstants.supportPhone}')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final faq = ref.watch(faqProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Help & Support'),
        actions: [
          TextButton.icon(
            onPressed: () => context.push('/support/tickets'),
            icon: const Icon(Icons.confirmation_number_outlined, size: 18),
            label: const Text('My tickets'),
          ),
        ],
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(AppSpacing.md),
          children: [
            Container(
              padding: const EdgeInsets.all(AppSpacing.md),
              decoration: BoxDecoration(
                color: AppColors.mint,
                borderRadius: BorderRadius.circular(AppRadius.medium),
              ),
              child: const Row(
                children: [
                  Icon(Icons.access_time_filled, color: AppColors.teal),
                  SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Text(
                      'We are available 24/7 - day rides, night rides, breakdowns.',
                      style: TextStyle(
                          fontWeight: FontWeight.w500,
                          color: AppColors.textPrimary),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.md),

            // Priority breakdown lane (SUP-02): 15 min response.
            Card(
              clipBehavior: Clip.antiAlias,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(AppRadius.large),
                side: const BorderSide(color: AppColors.accent, width: 1.5),
              ),
              child: ListTile(
                onTap: () => context.push('/support/report?type=breakdown'),
                leading: Container(
                  padding: const EdgeInsets.all(AppSpacing.sm),
                  decoration: BoxDecoration(
                    color: AppColors.accent.withValues(alpha: 0.12),
                    shape: BoxShape.circle,
                  ),
                  child:
                      const Icon(Icons.car_crash_outlined, color: AppColors.accent),
                ),
                title: const Text('Bike broke down?',
                    style: TextStyle(fontWeight: FontWeight.w600)),
                subtitle:
                    const Text('Priority lane · reply within 15 minutes'),
                trailing: const Icon(Icons.chevron_right),
              ),
            ),
            const SizedBox(height: AppSpacing.md),

            // Phone + chat, both huge targets (SUP-03, Fitts's law).
            Row(
              children: [
                Expanded(
                  child: Card(
                    clipBehavior: Clip.antiAlias,
                    child: InkWell(
                      onTap: () => _call(context),
                      child: Padding(
                        padding: const EdgeInsets.all(AppSpacing.md),
                        child: Column(
                          children: [
                            const Icon(Icons.call,
                                size: 32, color: AppColors.primary),
                            const SizedBox(height: AppSpacing.sm),
                            Text('Call us', style: textTheme.titleMedium),
                            Text(AppConstants.supportPhone,
                                style: textTheme.labelSmall),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Card(
                    clipBehavior: Clip.antiAlias,
                    child: InkWell(
                      onTap: () => context.push('/support/chat'),
                      child: Padding(
                        padding: const EdgeInsets.all(AppSpacing.md),
                        child: Column(
                          children: [
                            const Icon(Icons.chat_bubble_outline,
                                size: 32, color: AppColors.teal),
                            const SizedBox(height: AppSpacing.sm),
                            Text('Chat', style: textTheme.titleMedium),
                            Text('Avg response: 5 min',
                                style: textTheme.labelSmall),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.md),

            OutlinedButton.icon(
              onPressed: () => context.push('/support/report'),
              icon: const Icon(Icons.report_problem_outlined),
              label: const Text('Report an issue (with photos)'),
            ),
            const SizedBox(height: AppSpacing.lg),

            // FAQ answers the top questions first (SUP-05).
            Text('Frequently asked questions', style: textTheme.titleLarge),
            const SizedBox(height: AppSpacing.sm),
            TextField(
              decoration: const InputDecoration(
                hintText: 'Search the FAQ...',
                prefixIcon: Icon(Icons.search),
              ),
              onChanged: (value) =>
                  setState(() => _faqSearch = value.toLowerCase()),
            ),
            const SizedBox(height: AppSpacing.sm),
            faq.when(
              loading: () => const Padding(
                padding: EdgeInsets.all(AppSpacing.md),
                child: Center(child: CircularProgressIndicator()),
              ),
              error: (error, _) => Text(
                'FAQ is offline right now - call or chat instead.',
                style: textTheme.bodyMedium,
              ),
              data: (items) {
                final filtered = _faqSearch.isEmpty
                    ? items
                    : items
                        .where((item) =>
                            item.q.toLowerCase().contains(_faqSearch) ||
                            item.a.toLowerCase().contains(_faqSearch))
                        .toList();
                if (filtered.isEmpty) {
                  return Padding(
                    padding: const EdgeInsets.all(AppSpacing.md),
                    child: Text(
                      'Nothing matches "$_faqSearch" - try the chat below.',
                      style: textTheme.bodyMedium,
                    ),
                  );
                }
                return Column(
                  children: filtered
                      .map((item) => Card(
                            margin:
                                const EdgeInsets.only(bottom: AppSpacing.sm),
                            child: ExpansionTile(
                              title: Text(item.q,
                                  style: const TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w600)),
                              childrenPadding: const EdgeInsets.fromLTRB(
                                  AppSpacing.md, 0, AppSpacing.md, AppSpacing.md),
                              children: [
                                Align(
                                  alignment: Alignment.centerLeft,
                                  child: Text(item.a,
                                      style: textTheme.bodyMedium),
                                ),
                              ],
                            ),
                          ))
                      .toList(),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}
