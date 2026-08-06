import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../auth/login_screen.dart';
import '../../services/preferences_service.dart';

const _bg = Color(0xFF0a0a0b);
const _surfaceLight = Color(0xFF1c1c1e);
const _border = Color(0xFF2a2a2c);
const _cyan = Color(0xFF00E5FF);
const _textPrimary = Color(0xFFFFFFFF);
const _textSecondary = Color(0xFF94949E);
const _textMuted = Color(0xFF52525B);

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
                child: Text(
                  'Omitir',
                  style: TextStyle(color: _textMuted, fontSize: 14),
                ),
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
                          fontSize: 16,
                          fontWeight: FontWeight.w900,
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
          subtitle: 'Tu aplicación de movilidad\nen El Carmen de Bolívar',
          description:
              'Viajes rápidos, seguros y al mejor precio\nen moto o carro.',
          child: _imagePlaceholder('assets/sub-logo.png', Icons.home),
        );
      case 1:
        return _OnboardingPage(
          title: 'Seguridad ante todo',
          subtitle: 'Viajes monitoreados\nen tiempo real',
          description:
              'Conductores verificados, GPS en vivo\ny soporte 24/7 para tu tranquilidad.',
          child: _imagePlaceholder('assets/security.png', Icons.shield),
        );
      case 2:
        return _OnboardingPage(
          title: 'Viajes cómodos',
          subtitle: 'El mejor servicio\nal alcance de tu mano',
          description:
              'Solicita tu viaje en segundos,\nconoce el costo antes de pedirlo\ny paga en efectivo o desde la app.',
          child: _imagePlaceholder('assets/viajes.png', Icons.star),
        );
      default:
        return const SizedBox();
    }
  }

  Widget _imagePlaceholder(String asset, IconData fallback) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(20),
      child: Image.asset(
        asset,
        width: 280,
        height: 220,
        fit: BoxFit.contain,
        errorBuilder: (c, e, s) => Container(
          width: 280,
          height: 220,
          decoration: BoxDecoration(
            color: _surfaceLight,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: _border, width: 2),
          ),
          child: Icon(fallback, size: 64, color: _cyan),
        ),
      ),
    );
  }
}

class _OnboardingPage extends StatelessWidget {
  final String title;
  final String subtitle;
  final String description;
  final Widget child;
  const _OnboardingPage({
    required this.title,
    required this.subtitle,
    required this.description,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 32),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          child,
          const SizedBox(height: 32),
          Text(
            title,
            style: const TextStyle(
              fontFamily: 'Poppins',
              fontSize: 26,
              fontWeight: FontWeight.w900,
              color: _textPrimary,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 12),
          Text(
            subtitle,
            style: const TextStyle(
              fontFamily: 'Poppins',
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: _cyan,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 16),
          Text(
            description,
            style: TextStyle(
              fontFamily: 'Poppins',
              fontSize: 14,
              color: _textSecondary,
              height: 1.5,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
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
