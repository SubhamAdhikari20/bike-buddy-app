import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../app/theme/app_theme.dart';
import '../../../../core/error/app_exception.dart';
import '../providers/auth_provider.dart';

/// Login / Sign Up card matching the prototype: logo, tabs, fields with
/// icons, amber CTA and a clear "Continue as Guest" path (UI-01, H3).
class AuthPage extends ConsumerStatefulWidget {
  final int initialTab;

  const AuthPage({super.key, this.initialTab = 0});

  @override
  ConsumerState<AuthPage> createState() => _AuthPageState();
}

class _AuthPageState extends ConsumerState<AuthPage>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;

  final _loginFormKey = GlobalKey<FormState>();
  final _signupFormKey = GlobalKey<FormState>();

  final _loginEmail = TextEditingController();
  final _loginPassword = TextEditingController();
  final _signupName = TextEditingController();
  final _signupEmail = TextEditingController();
  final _signupPhone = TextEditingController();
  final _signupPassword = TextEditingController();

  bool _busy = false;
  bool _obscurePassword = true;
  bool _acceptedTerms = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(
      length: 2,
      vsync: this,
      initialIndex: widget.initialTab,
    );
  }

  @override
  void dispose() {
    _tabController.dispose();
    _loginEmail.dispose();
    _loginPassword.dispose();
    _signupName.dispose();
    _signupEmail.dispose();
    _signupPhone.dispose();
    _signupPassword.dispose();
    super.dispose();
  }

  void _showError(Object error) {
    final message =
        error is AppException ? error.message : 'Something went wrong. Please try again.';
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: AppColors.error),
    );
  }

  Future<void> _login() async {
    if (!_loginFormKey.currentState!.validate()) return;
    setState(() => _busy = true);
    try {
      await ref
          .read(authProvider.notifier)
          .loginWithPassword(_loginEmail.text.trim(), _loginPassword.text);
      if (mounted) context.go('/home');
    } catch (e) {
      if (mounted) _showError(e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _signup() async {
    if (!_signupFormKey.currentState!.validate()) return;
    if (!_acceptedTerms) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please accept the terms to continue')),
      );
      return;
    }
    setState(() => _busy = true);
    try {
      await ref.read(authProvider.notifier).registerRenter(
            fullName: _signupName.text.trim(),
            email: _signupEmail.text.trim(),
            phoneNumber:
                _signupPhone.text.trim().isEmpty ? null : _signupPhone.text.trim(),
            password: _signupPassword.text,
          );
      if (mounted) context.go('/home');
    } catch (e) {
      if (mounted) _showError(e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            children: [
              const SizedBox(height: AppSpacing.lg),
              Container(
                width: 72,
                height: 72,
                decoration: const BoxDecoration(
                  color: AppColors.primary,
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.pedal_bike, color: Colors.white, size: 36),
              ),
              const SizedBox(height: AppSpacing.md),
              Text('Bike Buddy',
                  style: textTheme.displayLarge?.copyWith(color: AppColors.primary)),
              const SizedBox(height: AppSpacing.xs),
              Text(
                'Unlock seamless booking, trip history, and exclusive member discounts.',
                style: textTheme.bodyMedium,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.lg),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  child: Column(
                    children: [
                      TabBar(
                        controller: _tabController,
                        labelColor: AppColors.primary,
                        unselectedLabelColor: AppColors.textSecondary,
                        indicatorColor: AppColors.primary,
                        tabs: const [Tab(text: 'Login'), Tab(text: 'Sign Up')],
                      ),
                      const SizedBox(height: AppSpacing.md),
                      AnimatedBuilder(
                        animation: _tabController,
                        builder: (context, _) => _tabController.index == 0
                            ? _buildLoginForm()
                            : _buildSignupForm(),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              Row(
                children: [
                  const Expanded(child: Divider()),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
                    child: Text('OR', style: textTheme.labelSmall),
                  ),
                  const Expanded(child: Divider()),
                ],
              ),
              const SizedBox(height: AppSpacing.md),
              // Guests can browse without an account (UI-01).
              OutlinedButton(
                onPressed: _busy ? null : () => context.go('/home'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.textPrimary,
                  side: const BorderSide(color: AppColors.divider),
                ),
                child: const Text('Continue as Guest'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildLoginForm() {
    return Form(
      key: _loginFormKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextFormField(
            controller: _loginEmail,
            keyboardType: TextInputType.emailAddress,
            autofillHints: const [AutofillHints.email],
            decoration: const InputDecoration(
              labelText: 'Email',
              prefixIcon: Icon(Icons.person_outline),
            ),
            validator: (value) =>
                value == null || !value.contains('@') ? 'Enter a valid email' : null,
          ),
          const SizedBox(height: AppSpacing.md),
          TextFormField(
            controller: _loginPassword,
            obscureText: _obscurePassword,
            decoration: InputDecoration(
              labelText: 'Password',
              prefixIcon: const Icon(Icons.lock_outline),
              suffixIcon: IconButton(
                onPressed: () =>
                    setState(() => _obscurePassword = !_obscurePassword),
                icon: Icon(
                  _obscurePassword ? Icons.visibility_off : Icons.visibility,
                ),
              ),
            ),
            validator: (value) => value == null || value.length < 8
                ? 'Password must be at least 8 characters'
                : null,
          ),
          const SizedBox(height: AppSpacing.md),
          ElevatedButton(
            onPressed: _busy ? null : _login,
            child: _busy
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.white),
                  )
                : const Text('Login'),
          ),
          const SizedBox(height: AppSpacing.sm),
          // Passwordless path for low-tech users (AUTH-01).
          TextButton.icon(
            onPressed: _busy ? null : () => context.push('/otp-login'),
            icon: const Icon(Icons.pin_outlined, size: 20),
            label: const Text('Sign in with a code instead'),
          ),
        ],
      ),
    );
  }

  Widget _buildSignupForm() {
    return Form(
      key: _signupFormKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextFormField(
            controller: _signupName,
            textCapitalization: TextCapitalization.words,
            decoration: const InputDecoration(
              labelText: 'Full name',
              prefixIcon: Icon(Icons.badge_outlined),
            ),
            validator: (value) => value == null || value.trim().length < 3
                ? 'Enter your full name'
                : null,
          ),
          const SizedBox(height: AppSpacing.md),
          TextFormField(
            controller: _signupEmail,
            keyboardType: TextInputType.emailAddress,
            decoration: const InputDecoration(
              labelText: 'Email',
              prefixIcon: Icon(Icons.mail_outline),
            ),
            validator: (value) =>
                value == null || !value.contains('@') ? 'Enter a valid email' : null,
          ),
          const SizedBox(height: AppSpacing.md),
          TextFormField(
            controller: _signupPhone,
            keyboardType: TextInputType.phone,
            decoration: const InputDecoration(
              labelText: 'Phone (optional)',
              prefixIcon: Icon(Icons.phone_outlined),
            ),
            validator: (value) {
              if (value == null || value.isEmpty) return null;
              return value.trim().length == 10 ? null : 'Phone must be 10 digits';
            },
          ),
          const SizedBox(height: AppSpacing.md),
          TextFormField(
            controller: _signupPassword,
            obscureText: _obscurePassword,
            decoration: InputDecoration(
              labelText: 'Password',
              prefixIcon: const Icon(Icons.lock_outline),
              suffixIcon: IconButton(
                onPressed: () =>
                    setState(() => _obscurePassword = !_obscurePassword),
                icon: Icon(
                  _obscurePassword ? Icons.visibility_off : Icons.visibility,
                ),
              ),
            ),
            validator: (value) => value == null || value.length < 8
                ? 'Password must be at least 8 characters'
                : null,
          ),
          const SizedBox(height: AppSpacing.sm),
          CheckboxListTile(
            value: _acceptedTerms,
            onChanged: (value) =>
                setState(() => _acceptedTerms = value ?? false),
            controlAffinity: ListTileControlAffinity.leading,
            contentPadding: EdgeInsets.zero,
            title: const Text(
              'I agree to the terms and the rental policies',
              style: TextStyle(fontSize: 14),
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          ElevatedButton(
            onPressed: _busy ? null : _signup,
            child: _busy
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.white),
                  )
                : const Text('Create Account'),
          ),
        ],
      ),
    );
  }
}
