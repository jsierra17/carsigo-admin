import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../models/user_profile.dart';
import '../../providers/auth_provider.dart';

class RoleSelectionScreen extends ConsumerWidget {
  const RoleSelectionScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                '¿Como usaras CarSiGo?',
                style: GoogleFonts.poppins(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 10),
              const Text(
                'Selecciona tu rol para continuar',
                style: TextStyle(color: Colors.grey),
              ),
              const SizedBox(height: 40),
              _RoleCard(
                title: 'Pasajero',
                description: 'Quiero pedir viajes rapidos y seguros',
                icon: Icons.person_pin_circle,
                color: Colors.blue,
                onTap: () => _registerRole(ref, UserRole.passenger),
              ),
              const SizedBox(height: 20),
              _RoleCard(
                title: 'Conductor',
                description: 'Quiero generar ingresos con mi vehiculo',
                icon: Icons.directions_car,
                color: Colors.green,
                onTap: () => _registerRole(ref, UserRole.driver),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _registerRole(WidgetRef ref, UserRole role) async {
    final authService = ref.read(authServiceProvider);
    final user = authService.currentUser;

    if (user != null) {
      final existing = await authService.getUserProfile(user.id);
      final profile = existing?.copyWith(role: role) ??
          UserProfile(
            id: user.id,
            phone: user.phone ?? '',
            name: user.userMetadata?['full_name'] ?? user.email?.split('@').first ?? '',
            role: role,
            avatarUrl: user.userMetadata?['avatar_url'],
            createdAt: DateTime.now(),
          );
      await authService.createProfile(profile);
      ref.invalidate(userProfileProvider);
    }
  }
}

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
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          border: Border.all(color: color.withValues(alpha: 0.5), width: 2),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Row(
          children: [
            Icon(icon, size: 40, color: color),
            const SizedBox(width: 20),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  Text(
                    description,
                    style: const TextStyle(color: Colors.grey, fontSize: 14),
                  ),
                ],
              ),
            ),
            Icon(Icons.arrow_forward_ios, size: 16, color: color),
          ],
        ),
      ),
    );
  }
}
