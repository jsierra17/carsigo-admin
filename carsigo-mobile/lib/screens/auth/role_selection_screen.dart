import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../models/user_profile.dart';
import '../../providers/auth_provider.dart';
import '../../theme/carsigo_theme.dart';

const _bg = CarSiGoColors.bg;
const _surface = CarSiGoColors.surface;
const _surfaceLight = CarSiGoColors.surfaceLight;
const _border = CarSiGoColors.border;
const _cyan = CarSiGoColors.cyan;
const _textPrimary = CarSiGoColors.textPrimary;
const _textSecondary = CarSiGoColors.textSecondary;

class RoleSelectionScreen extends ConsumerWidget {
  const RoleSelectionScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      backgroundColor: _bg,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  color: _surfaceLight,
                  shape: BoxShape.circle,
                  border: Border.all(color: _border, width: 2),
                ),
                child: ClipOval(
                  child: Image.asset(
                    'assets/logo.png',
                    width: 80,
                    height: 80,
                    fit: BoxFit.cover,
                  ),
                ),
              ),
              const SizedBox(height: 20),
              Text(
                '¿Cómo usarás CarSiGo?',
                style: const TextStyle(
                  fontFamily: 'Poppins',
                  fontSize: 22,
                  fontWeight: FontWeight.w900,
                  color: _textPrimary,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Selecciona tu rol para continuar',
                style: TextStyle(
                  fontFamily: 'Poppins',
                  fontSize: 14,
                  color: _textSecondary,
                ),
              ),
              const SizedBox(height: 32),
              _RoleCard(
                title: 'Pasajero',
                description: 'Quiero pedir viajes rápidos y seguros',
                icon: Icons.person_pin_circle,
                color: _cyan,
                onTap: () => _registerRole(context, ref, UserRole.passenger),
              ),
              const SizedBox(height: 16),
              _RoleCard(
                title: 'Conductor',
                description: 'Quiero generar ingresos con mi vehículo',
                icon: Icons.directions_car,
                color: _green,
                onTap: () => _registerRole(context, ref, UserRole.driver),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _registerRole(
    BuildContext context,
    WidgetRef ref,
    UserRole role,
  ) async {
    final authService = ref.read(authServiceProvider);
    final user = authService.currentUser;

    if (user != null) {
      final existing = await authService.getUserProfile(user.uid);

      if (existing == null && role == UserRole.driver) {
        // El conductor solicita registro: crea perfil + solicitud pendiente
        // para que el panel la revise y otorgue el rol.
        await authService.createDriverApplication(
          userId: user.uid,
          fullName: user.displayName ?? user.email ?? '',
        );
      }

      final profile =
          existing?.copyWith(role: role) ??
          UserProfile(
            id: user.uid,
            phone: user.phoneNumber ?? '',
            fullName: user.displayName ?? user.email?.split('@').first ?? '',
            role: role,
            avatarUrl: user.photoURL,
            createdAt: DateTime.now(),
          );
      await authService.createProfile(profile);
      ref.invalidate(userProfileProvider);
      if (context.mounted) {
        Navigator.of(context).popUntil((route) => route.isFirst);
      }
    }
  }
}

const _green = CarSiGoColors.green;

class _RoleCard extends StatelessWidget {
  final String title;
  final String description;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;

  const _RoleCard({
    required this.title,
    required this.description,
    required this.icon,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: _surface,
          border: Border.all(color: color.withValues(alpha: 0.5), width: 2),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Row(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: _surfaceLight,
                shape: BoxShape.circle,
              ),
              child: Icon(icon, size: 24, color: color),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontFamily: 'Poppins',
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: _textPrimary,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    description,
                    style: TextStyle(
                      fontFamily: 'Poppins',
                      fontSize: 12,
                      color: _textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            Icon(Icons.arrow_forward_ios, size: 14, color: color),
          ],
        ),
      ),
    );
  }
}
