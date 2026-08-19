import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';
import '../auth/login_screen.dart';
import '../../services/preferences_service.dart';
import '../../theme/carsigo_theme.dart';

const _bg = CarSiGoColors.bg;
const _surfaceLight = CarSiGoColors.surfaceLight;
const _border = CarSiGoColors.border;
const _cyan = CarSiGoColors.cyan;
const _textPrimary = CarSiGoColors.textPrimary;
const _textSecondary = CarSiGoColors.textSecondary;
const _textMuted = CarSiGoColors.textMuted;

class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key});
  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  final _pageCtrl = PageController();
  int _currentPage = 0;

  void _goToLogin() {
    PreferencesService.markOnboardingCompleted();
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const LoginScreen()),
    );
  }

  @override
  void dispose() {
    _pageCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _bg,
      body: SafeArea(
        child: Stack(
          children: [
            Positioned.fill(
              child: IgnorePointer(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: RadialGradient(
                      radius: 1.1,
                      center: const Alignment(0, -0.65),
                      colors: [
                        CarSiGoColors.cyan.withValues(alpha: 0.09),
                        CarSiGoColors.cyan.withValues(alpha: 0),
                      ],
                    ),
                  ),
                ),
              ),
            ),
            PageView.builder(
              controller: _pageCtrl,
              itemCount: 3,
              onPageChanged: (i) => setState(() => _currentPage = i),
              itemBuilder: (_, i) => _buildPage(i),
            ),
            Positioned(
              top: 8,
              right: 16,
              child: TextButton(
                onPressed: _goToLogin,
                style: TextButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                  minimumSize: const Size(48, 48),
                  foregroundColor: _textMuted,
                ),
                child: const Text('Omitir', style: TextStyle(fontFamily: 'Outfit', fontSize: 14, fontWeight: FontWeight.w500)),
              ),
            ),
            Positioned(
              left: 24,
              right: 24,
              bottom: 48,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  _DotsIndicator(count: 3, current: _currentPage),
                  const SizedBox(height: 24),
                  SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: ElevatedButton(
                      onPressed: _currentPage < 2 ? _nextPage : _goToLogin,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: _cyan,
                        foregroundColor: _bg,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                        textStyle: const TextStyle(
                          fontFamily: 'Outfit',
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.2,
                        ),
                      ),
                      child: Text(_currentPage < 2 ? 'Siguiente' : 'Comenzar'),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _nextPage() {
    _pageCtrl.nextPage(
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeInOut,
    );
  }

  Widget _buildPage(int i) {
    switch (i) {
      case 0:
        return _OnboardingPage(
          title: 'Bienvenido a CarSiGo',
          subtitle: 'Tu aplicación de movilidad\nen cualquier ciudad',
          description:
              'Viajes rápidos, seguros y al mejor precio\nen moto o carro.',
          illustration: 'assets/Bienvenida.svg',
        );
      case 1:
        return _OnboardingPage(
          title: 'Seguridad ante todo',
          subtitle: 'Viajes monitoreados\nen tiempo real',
          description:
              'Conductores verificados, GPS en vivo\ny soporte 24/7, dondequiera que estés.',
          illustration: 'assets/Seguridad.svg',
        );
      case 2:
        return _OnboardingPage(
          title: 'Viajes cómodos',
          subtitle: 'El mejor servicio\nal alcance de tu mano',
          description:
              'Solicita tu viaje en segundos,\nconoce el costo antes de pedirlo\ny paga en efectivo o desde la app.',
          illustration: 'assets/GPS.svg',
        );
      default:
        return const SizedBox();
    }
  }
}

class _OnboardingPage extends StatelessWidget {
  final String title;
  final String subtitle;
  final String description;
  final String illustration;
  const _OnboardingPage({
    required this.title,
    required this.subtitle,
    required this.description,
    required this.illustration,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // Ilustración completa (sin recortes) en la parte superior.
        Expanded(
          flex: 11,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(28, 20, 28, 0),
            child: Center(
              child: SvgPicture.asset(
                illustration,
                fit: BoxFit.contain,
                width: double.infinity,
                height: double.infinity,
                errorBuilder: (c, e, s) => Container(
                  width: 300,
                  height: 300,
                  decoration: BoxDecoration(
                    color: _surfaceLight,
                    borderRadius: BorderRadius.circular(24),
                  ),
                  child: const Center(
                    child: Icon(Icons.image_not_supported_outlined, size: 56, color: _cyan),
                  ),
                ),
              ),
            ),
          ),
        ),
        // Texto sobre el fondo sólido de la app: legible y sin parches.
        Padding(
          padding: const EdgeInsets.fromLTRB(32, 12, 32, 176),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontFamily: 'Outfit',
                  fontSize: 29,
                  fontWeight: FontWeight.w900,
                  color: _textPrimary,
                  height: 1.2,
                  letterSpacing: -0.4,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 12),
              Text(
                subtitle,
                style: const TextStyle(
                  fontFamily: 'Outfit',
                  fontSize: 17,
                  fontWeight: FontWeight.w600,
                  color: _cyan,
                  height: 1.4,
                  letterSpacing: 0.2,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 14),
              Text(
                description,
                style: TextStyle(
                  fontFamily: 'Outfit',
                  fontSize: 15,
                  fontWeight: FontWeight.w500,
                  color: _textSecondary.withValues(alpha: 0.95),
                  height: 1.5,
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _DotsIndicator extends StatelessWidget {
  final int count;
  final int current;
  const _DotsIndicator({required this.count, required this.current});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(
        count,
        (i) => Container(
          width: i == current ? 24 : 8,
          height: 8,
          margin: const EdgeInsets.symmetric(horizontal: 4),
          decoration: BoxDecoration(
            color: i == current ? _cyan : _border,
            borderRadius: BorderRadius.circular(4),
          ),
        ),
      ),
    );
  }
}
