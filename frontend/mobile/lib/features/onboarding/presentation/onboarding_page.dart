import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_theme.dart';
import '../../../core/services/local_store.dart';

class _OnboardingStep {
  final IconData icon;
  final String title;
  final String subtitle;

  const _OnboardingStep(this.icon, this.title, this.subtitle);
}

/// Three-step guided start (UI-02). Plain language, one idea per card,
/// skippable and replayable from Profile (cognitive load law).
class OnboardingPage extends StatefulWidget {
  const OnboardingPage({super.key});

  @override
  State<OnboardingPage> createState() => _OnboardingPageState();
}

class _OnboardingPageState extends State<OnboardingPage> {
  final _controller = PageController();
  int _page = 0;

  static const _steps = [
    _OnboardingStep(
      Icons.travel_explore,
      'Discover Nearby Bikes',
      'Find the perfect ride in your neighborhood in seconds.',
    ),
    _OnboardingStep(
      Icons.calendar_month_outlined,
      'Book in 3 Taps',
      'Pick a bike, choose your time and confirm. No paperwork.',
    ),
    _OnboardingStep(
      Icons.two_wheeler,
      'Ride with Confidence',
      'Verified owners, clear prices and 24/7 support on every ride.',
    ),
  ];

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _finish() async {
    await LocalStore.setOnboardingSeen(true);
    if (mounted) context.go('/home');
  }

  void _next() {
    if (_page == _steps.length - 1) {
      _finish();
    } else {
      _controller.nextPage(
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOut,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            children: [
              Expanded(
                child: PageView.builder(
                  controller: _controller,
                  itemCount: _steps.length,
                  onPageChanged: (page) => setState(() => _page = page),
                  itemBuilder: (context, index) {
                    final step = _steps[index];
                    return Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Container(
                          width: 240,
                          height: 240,
                          decoration: BoxDecoration(
                            color: AppColors.primaryLight,
                            borderRadius: BorderRadius.circular(AppRadius.large),
                          ),
                          child: Icon(step.icon, size: 96, color: AppColors.primary),
                        ),
                        const SizedBox(height: AppSpacing.xl),
                        Text(
                          step.title,
                          style: textTheme.displayLarge,
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
                          child: Text(
                            step.subtitle,
                            style: textTheme.bodyLarge?.copyWith(color: AppColors.textSecondary),
                            textAlign: TextAlign.center,
                          ),
                        ),
                      ],
                    );
                  },
                ),
              ),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(_steps.length, (index) {
                  final selected = index == _page;
                  return AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    margin: const EdgeInsets.symmetric(horizontal: 4),
                    width: selected ? 28 : 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: selected ? AppColors.primary : AppColors.divider,
                      borderRadius: BorderRadius.circular(AppRadius.pill),
                    ),
                  );
                }),
              ),
              const SizedBox(height: AppSpacing.lg),
              ElevatedButton(
                onPressed: _next,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(_page == _steps.length - 1 ? 'Get Started' : 'Next'),
                    const SizedBox(width: AppSpacing.sm),
                    const Icon(Icons.arrow_forward, size: 20),
                  ],
                ),
              ),
              TextButton(
                onPressed: _finish,
                child: const Text('Skip'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
