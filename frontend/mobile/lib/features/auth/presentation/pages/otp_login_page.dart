import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../app/theme/app_theme.dart';
import '../../../../core/error/app_exception.dart';
import '../providers/auth_provider.dart';

/// Passwordless sign-in (AUTH-01): enter email, receive a 6-digit code.
/// The code boxes auto-focus and auto-advance (Fitts's law), and resend
/// unlocks after 30 seconds.
class OtpLoginPage extends ConsumerStatefulWidget {
  const OtpLoginPage({super.key});

  @override
  ConsumerState<OtpLoginPage> createState() => _OtpLoginPageState();
}

class _OtpLoginPageState extends ConsumerState<OtpLoginPage> {
  final _emailController = TextEditingController();
  final _boxControllers = List.generate(6, (_) => TextEditingController());
  final _boxFocusNodes = List.generate(6, (_) => FocusNode());

  bool _codeSent = false;
  bool _busy = false;
  int _resendSeconds = 0;
  Timer? _resendTimer;

  @override
  void dispose() {
    _emailController.dispose();
    for (final c in _boxControllers) {
      c.dispose();
    }
    for (final f in _boxFocusNodes) {
      f.dispose();
    }
    _resendTimer?.cancel();
    super.dispose();
  }

  void _showMessage(String message, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError ? AppColors.error : null,
      ),
    );
  }

  void _startResendCountdown() {
    setState(() => _resendSeconds = 30);
    _resendTimer?.cancel();
    _resendTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) return;
      setState(() {
        _resendSeconds -= 1;
        if (_resendSeconds <= 0) timer.cancel();
      });
    });
  }

  Future<void> _sendCode() async {
    final email = _emailController.text.trim();
    if (!email.contains('@')) {
      _showMessage('Enter a valid email first', isError: true);
      return;
    }
    setState(() => _busy = true);
    try {
      await ref.read(authProvider.notifier).sendOtp(email);
      setState(() => _codeSent = true);
      _startResendCountdown();
      if (mounted) {
        _showMessage('Code sent to $email');
        // Auto-focus the first box (AUTH-01 acceptance criteria).
        _boxFocusNodes.first.requestFocus();
      }
    } catch (e) {
      if (mounted) {
        _showMessage(
          e is AppException ? e.message : 'Could not send the code.',
          isError: true,
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _verify() async {
    final code = _boxControllers.map((c) => c.text).join();
    if (code.length != 6) {
      _showMessage('Enter the full 6-digit code', isError: true);
      return;
    }
    setState(() => _busy = true);
    try {
      await ref
          .read(authProvider.notifier)
          .verifyOtp(_emailController.text.trim(), code);
      if (mounted) context.go('/home');
    } catch (e) {
      if (mounted) {
        _showMessage(
          e is AppException ? e.message : 'Could not verify the code.',
          isError: true,
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _onBoxChanged(int index, String value) {
    if (value.length > 1) {
      // Paste support: distribute the digits across boxes.
      final digits = value.replaceAll(RegExp(r'\D'), '');
      for (var i = 0; i < 6; i++) {
        _boxControllers[i].text = i < digits.length ? digits[i] : '';
      }
      if (digits.length >= 6) _verify();
      return;
    }
    if (value.isNotEmpty && index < 5) {
      _boxFocusNodes[index + 1].requestFocus();
    }
    if (value.isEmpty && index > 0) {
      _boxFocusNodes[index - 1].requestFocus();
    }
    final code = _boxControllers.map((c) => c.text).join();
    if (code.length == 6) _verify();
  }

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;

    return Scaffold(
      appBar: AppBar(title: const Text('Sign in with a code')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: AppSpacing.md),
              const Icon(Icons.pin_outlined, size: 56, color: AppColors.primary),
              const SizedBox(height: AppSpacing.md),
              Text(
                _codeSent
                    ? 'Enter the 6-digit code'
                    : 'No password needed',
                style: textTheme.titleLarge,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                _codeSent
                    ? 'We emailed a code to ${_emailController.text.trim()}. It expires in 10 minutes.'
                    : 'Type your email and we will send you a one-time code to sign in.',
                style: textTheme.bodyMedium,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.lg),
              if (!_codeSent) ...[
                TextField(
                  controller: _emailController,
                  keyboardType: TextInputType.emailAddress,
                  autofocus: true,
                  decoration: const InputDecoration(
                    labelText: 'Email',
                    prefixIcon: Icon(Icons.mail_outline),
                  ),
                  onSubmitted: (_) => _sendCode(),
                ),
                const SizedBox(height: AppSpacing.md),
                ElevatedButton(
                  onPressed: _busy ? null : _sendCode,
                  child: _busy
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white),
                        )
                      : const Text('Send Code'),
                ),
              ] else ...[
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: List.generate(6, (index) {
                    return SizedBox(
                      width: 48,
                      height: 56,
                      child: TextField(
                        controller: _boxControllers[index],
                        focusNode: _boxFocusNodes[index],
                        textAlign: TextAlign.center,
                        keyboardType: TextInputType.number,
                        style: textTheme.titleLarge,
                        inputFormatters: [
                          FilteringTextInputFormatter.digitsOnly,
                        ],
                        decoration: const InputDecoration(
                          counterText: '',
                          contentPadding: EdgeInsets.zero,
                        ),
                        onChanged: (value) => _onBoxChanged(index, value),
                      ),
                    );
                  }),
                ),
                const SizedBox(height: AppSpacing.lg),
                ElevatedButton(
                  onPressed: _busy ? null : _verify,
                  child: _busy
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white),
                        )
                      : const Text('Verify & Sign In'),
                ),
                const SizedBox(height: AppSpacing.sm),
                TextButton(
                  onPressed: _resendSeconds > 0 || _busy ? null : _sendCode,
                  child: Text(
                    _resendSeconds > 0
                        ? 'Resend code in ${_resendSeconds}s'
                        : 'Resend code',
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
