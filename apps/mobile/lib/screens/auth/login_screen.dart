import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../providers/auth_provider.dart';
import '../../theme/carsigo_theme.dart';


class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});
  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  CarSiGoPalette get p => context.palette;

  bool _loading = false;

  Future<void> _signInWithGoogle() async {
    setState(() => _loading = true);
    await ref.read(authControllerProvider.notifier).signInWithGoogle();
    if (mounted) {
      final state = ref.read(authControllerProvider);
      final err = state.error;
      if (err != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $err'), backgroundColor: Colors.red),
        );
        setState(() => _loading = false);
      } else {
        if (mounted) Navigator.of(context).popUntil((route) => route.isFirst);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: p.bg,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 28),
          child: Column(
            children: [
              const Spacer(flex: 2),
              SizedBox(
                width: 240,
                height: 240,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    DecoratedBox(
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: RadialGradient(
                          colors: [
                            p.cyan.withValues(alpha: 0.14),
                            p.cyan.withValues(alpha: 0),
                          ],
                        ),
                      ),
                    ),
                    Image.asset(
                      'assets/sub-logo.png',
                      width: 180,
                      height: 180,
                      fit: BoxFit.contain,
                    ),
                  ],
                ),
              ),
              const Spacer(flex: 1),
              Text(
                'Regístrate para continuar',
                style: TextStyle(
                  fontFamily: 'Poppins', fontSize: 18, fontWeight: FontWeight.w700, color: p.textPrimary,
                ),
              ),
              SizedBox(height: 8),
              Text(
                'Usa tu cuenta de Google para acceder\nde forma rápida y segura.',
                style: TextStyle(fontFamily: 'Poppins', fontSize: 13, color: p.textSecondary, height: 1.4),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 32),
              SizedBox(
                width: double.infinity,
                height: 54,
                child: ElevatedButton.icon(
                  onPressed: _loading ? null : _signInWithGoogle,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: p.textPrimary,
                    foregroundColor: p.bg,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  ),
                  icon: _loading
                      ? SizedBox(
                          width: 20, height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2, color: p.bg),
                        )
                      : const Icon(Icons.g_mobiledata, size: 28),
                  label: Text(
                    _loading ? 'Iniciando sesión…' : 'Continuar con Google',
                    style: TextStyle(fontFamily: 'Poppins', fontSize: 15, fontWeight: FontWeight.w700),
                  ),
                ),
              ),
              const Spacer(flex: 2),
            ],
          ),
        ),
      ),
    );
  }
}
