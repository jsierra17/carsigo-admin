import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/user_profile.dart';
import '../providers/auth_provider.dart';

const _bg = Color(0xFF0a0a0b);
const _surface = Color(0xFF141416);
const _surfaceLight = Color(0xFF1c1c1e);
const _border = Color(0xFF2a2a2c);
const _cyan = Color(0xFF00E5FF);
const _textPrimary = Color(0xFFFFFFFF);
const _textMuted = Color(0xFF52525B);

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profileAsync = ref.watch(userProfileProvider);

    return Scaffold(
      backgroundColor: _bg,
      appBar: AppBar(
        title: const Text('Mi perfil', style: TextStyle(fontWeight: FontWeight.w900, color: _textPrimary, fontSize: 16)),
        centerTitle: true,
        backgroundColor: _surface,
        foregroundColor: _textPrimary,
        elevation: 0,
      ),
      body: profileAsync.when(
        loading: () => const Center(child: CircularProgressIndicator(strokeWidth: 3, color: _cyan)),
        error: (err, _) => Center(child: Text('Error: $err', style: const TextStyle(color: Colors.red))),
        data: (profile) {
          if (profile == null) {
            return const Center(child: Text('Perfil no disponible', style: TextStyle(color: _textMuted)));
          }
          return _ProfileContent(profile: profile);
        },
      ),
    );
  }
}

class _ProfileContent extends ConsumerWidget {
  final UserProfile profile;
  const _ProfileContent({required this.profile});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final initials = profile.displayName.isNotEmpty
        ? profile.displayName.split(' ').map((e) => e.isNotEmpty ? e[0] : '').take(2).join().toUpperCase()
        : '?';
    final roleLabel = profile.role == UserRole.driver ? 'Conductor' : profile.role == UserRole.admin ? 'Admin' : 'Pasajero';
    final roleColor = profile.role == UserRole.driver ? const Color(0xFF22C55E) : _cyan;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(children: [
        CircleAvatar(
          radius: 48,
          backgroundColor: _surfaceLight,
          child: Text(initials, style: TextStyle(fontSize: 32, fontWeight: FontWeight.w900, color: _cyan)),
        ),
        const SizedBox(height: 16),
        Text(profile.displayName, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: _textPrimary)),
        const SizedBox(height: 4),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
          decoration: BoxDecoration(
            color: roleColor.withAlpha(25),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: roleColor.withAlpha(80)),
          ),
          child: Text(roleLabel, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: roleColor)),
        ),
        const SizedBox(height: 28),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(color: _surface, borderRadius: BorderRadius.circular(16), border: Border.all(color: _border)),
          child: Column(children: [
            _InfoRow(icon: Icons.phone, label: 'Teléfono', value: profile.phone.isNotEmpty ? profile.phone : 'No registrado'),
            const Divider(color: _border, height: 20),
            _InfoRow(icon: Icons.person, label: 'Rol', value: roleLabel),
          ]),
        ),
        const SizedBox(height: 32),
        SizedBox(
          width: double.infinity,
          height: 50,
          child: OutlinedButton.icon(
            onPressed: () => _signOut(context, ref),
            style: OutlinedButton.styleFrom(
              foregroundColor: Colors.redAccent,
              side: const BorderSide(color: Colors.redAccent),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
            ),
            icon: const Icon(Icons.logout, size: 20),
            label: const Text('Cerrar sesión'),
          ),
        ),
      ]),
    );
  }

  void _signOut(BuildContext context, WidgetRef ref) async {
    final navigator = Navigator.of(context);
    await ref.read(authControllerProvider.notifier).signOut();
    navigator.popUntil((route) => route.isFirst);
  }
}

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  const _InfoRow({required this.icon, required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Row(children: [
      Icon(icon, color: _textMuted, size: 20),
      const SizedBox(width: 12),
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label, style: const TextStyle(color: _textMuted, fontSize: 11)),
        Text(value, style: const TextStyle(color: _textPrimary, fontSize: 14, fontWeight: FontWeight.w600)),
      ])),
    ]);
  }
}
