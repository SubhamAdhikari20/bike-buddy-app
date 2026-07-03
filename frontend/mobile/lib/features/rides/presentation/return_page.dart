import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_theme.dart';
import '../../../core/error/app_exception.dart';
import '../../../core/utils/formatters.dart';
import '../../bookings/data/booking_api.dart';

/// Step-by-step return (RET-01): park, check, confirm. The on-time or
/// late status and any fee are shown BEFORE anything is charged
/// (RET-02), and the rental can be extended right here (RET-03).
class ReturnPage extends ConsumerStatefulWidget {
  final String bookingId;

  const ReturnPage({super.key, required this.bookingId});

  @override
  ConsumerState<ReturnPage> createState() => _ReturnPageState();
}

class _ReturnPageState extends ConsumerState<ReturnPage> {
  int _step = 0;
  Map<String, dynamic>? _preview;
  bool _busy = false;
  Map<String, dynamic>? _result;

  @override
  void initState() {
    super.initState();
    _loadPreview();
  }

  Future<void> _loadPreview() async {
    try {
      final preview =
          await ref.read(bookingApiProvider).returnPreview(widget.bookingId);
      if (mounted) setState(() => _preview = preview);
    } catch (_) {}
  }

  Future<void> _extend() async {
    final costPerHour =
        (_preview?['extendCostPerHour'] as num?)?.toDouble() ?? 0;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.large)),
        icon: const Icon(Icons.more_time, size: 40, color: AppColors.primary),
        title: const Text('Extend by 1 hour?'),
        content: Text(
            'One extra hour costs ${Formatters.npr(costPerHour)}. Your return time moves back by an hour.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text('No, keep my time')),
          ElevatedButton(
              onPressed: () => Navigator.of(context).pop(true),
              child: Text('Extend +1hr (${Formatters.npr(costPerHour)})')),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    setState(() => _busy = true);
    try {
      final result =
          await ref.read(bookingApiProvider).extend(widget.bookingId, 1);
      ref.invalidate(myBookingsProvider);
      await _loadPreview();
      if (mounted) {
        // Old and new totals shown explicitly (PR-07).
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
                'Extended! Total went from ${Formatters.npr((result['oldTotal'] as num).toDouble())} to ${Formatters.npr((result['newTotal'] as num).toDouble())}.'),
            backgroundColor: AppColors.success,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e is AppException ? e.message : 'Could not extend.'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _confirmReturn() async {
    setState(() => _busy = true);
    try {
      final result =
          await ref.read(bookingApiProvider).returnBike(widget.bookingId);
      ref.invalidate(myBookingsProvider);
      if (mounted) setState(() => _result = result);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e is AppException
                ? e.message
                : 'Could not record the return. Please try again.'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;

    // Return summary after completion (RET-02, RET-04).
    if (_result != null) {
      final onTime = _result!['onTime'] == true;
      final lateMinutes = (_result!['lateMinutes'] as num?)?.toInt() ?? 0;
      final lateFee = (_result!['lateFeeAmount'] as num?)?.toDouble() ?? 0;

      return Scaffold(
        appBar: AppBar(title: const Text('Return Complete')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  padding: const EdgeInsets.all(AppSpacing.lg),
                  decoration: BoxDecoration(
                    color: onTime ? AppColors.mint : const Color(0xFFFFF7E6),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    onTime ? Icons.check_circle : Icons.schedule,
                    size: 56,
                    color: onTime ? AppColors.success : AppColors.warning,
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                Text(
                  onTime ? 'Returned on time!' : 'Late by $lateMinutes minutes',
                  style: textTheme.displayLarge,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  onTime
                      ? 'Thanks for riding with Bike Buddy. No extra charges.'
                      : 'A late fee of ${Formatters.npr(lateFee)} applies, as shown before you confirmed.',
                  style: textTheme.bodyMedium,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: AppSpacing.lg),
                SizedBox(
                  width: 240,
                  child: ElevatedButton(
                    onPressed: () =>
                        context.pushReplacement('/receipt/${widget.bookingId}'),
                    child: const Text('View Return Receipt'),
                  ),
                ),
                TextButton(
                  onPressed: () =>
                      context.push('/damage-report/${widget.bookingId}'),
                  child: const Text('Report damage or an issue'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    final steps = [
      (
        Icons.local_parking,
        'Park at the return point',
        'Bring the bike back to the pickup location. Look for the landmark you used when collecting it.'
      ),
      (
        Icons.key,
        'Switch off & lock',
        'Turn off the engine, lock the steering and keep the key ready for the owner.'
      ),
      (
        Icons.fact_check_outlined,
        'Confirm your return',
        'Check the time summary below, then confirm. Your receipt is generated instantly.'
      ),
    ];

    final preview = _preview;
    final onTime = preview?['onTime'] == true;
    final lateMinutes = (preview?['lateMinutes'] as num?)?.toInt() ?? 0;
    final lateFee = (preview?['lateFeeAmount'] as num?)?.toDouble() ?? 0;

    return Scaffold(
      appBar: AppBar(title: const Text('Return the Bike')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(AppSpacing.md),
          children: [
            // 3 clear steps, confirm each one (RET-01, cognitive load).
            for (var i = 0; i < steps.length; i++)
              Card(
                margin: const EdgeInsets.only(bottom: AppSpacing.sm),
                shape: i == _step
                    ? RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(AppRadius.large),
                        side: const BorderSide(
                            color: AppColors.primary, width: 2),
                      )
                    : null,
                child: ListTile(
                  leading: CircleAvatar(
                    backgroundColor:
                        i < _step ? AppColors.success : AppColors.primaryLight,
                    child: i < _step
                        ? const Icon(Icons.check, color: Colors.white)
                        : Icon(steps[i].$1, color: AppColors.primary),
                  ),
                  title: Text('${i + 1}. ${steps[i].$2}'),
                  subtitle: Text(steps[i].$3,
                      style: const TextStyle(fontSize: 12)),
                  trailing: i == _step && i < 2
                      ? TextButton(
                          onPressed: () => setState(() => _step = i + 1),
                          child: const Text('Done'),
                        )
                      : null,
                ),
              ),
            const SizedBox(height: AppSpacing.sm),

            // Time summary BEFORE confirming (RET-02, transparency).
            if (preview != null)
              Card(
                color: onTime ? AppColors.mint : const Color(0xFFFFF7E6),
                child: Padding(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  child: Column(
                    children: [
                      Row(
                        children: [
                          Icon(
                            onTime ? Icons.check_circle : Icons.schedule,
                            color:
                                onTime ? AppColors.success : AppColors.warning,
                          ),
                          const SizedBox(width: AppSpacing.sm),
                          Expanded(
                            child: Text(
                              onTime
                                  ? 'You are on time (15 min grace included)'
                                  : 'You are $lateMinutes min late - fee: ${Formatters.npr(lateFee)}',
                              style:
                                  const TextStyle(fontWeight: FontWeight.w600),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Return due: ${DateFormat('EEE, d MMM h:mm a').format(DateTime.tryParse(preview['endDate'] as String? ?? '') ?? DateTime.now())}',
                        style: textTheme.bodyMedium,
                      ),
                    ],
                  ),
                ),
              ),
            const SizedBox(height: AppSpacing.sm),

            // Extend without leaving the return flow (RET-03).
            OutlinedButton.icon(
              onPressed: _busy ? null : _extend,
              icon: const Icon(Icons.more_time),
              label: Text(
                  'Running late? Extend +1hr (${Formatters.npr((preview?['extendCostPerHour'] as num?)?.toDouble() ?? 0)})'),
            ),
            const SizedBox(height: AppSpacing.md),

            // Big, 56px-tall confirm button (RET-05, Fitts's law).
            SizedBox(
              height: 56,
              child: ElevatedButton.icon(
                onPressed: _step == 2 && !_busy ? _confirmReturn : null,
                icon: _busy
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white),
                      )
                    : const Icon(Icons.check_circle_outline),
                label: const Text('Confirm Return',
                    style: TextStyle(fontSize: 17)),
              ),
            ),
            if (_step < 2)
              Padding(
                padding: const EdgeInsets.only(top: AppSpacing.sm),
                child: Text(
                  'Finish the steps above to confirm.',
                  style: textTheme.labelSmall,
                  textAlign: TextAlign.center,
                ),
              ),
          ],
        ),
      ),
    );
  }
}
