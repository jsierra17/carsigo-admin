import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/user_profile.dart';
import '../providers/auth_provider.dart';
import '../theme/carsigo_theme.dart';

const _bg = CarSiGoColors.bg;
const _surface = CarSiGoColors.surface;
const _surfaceLight = CarSiGoColors.surfaceLight;
const _border = CarSiGoColors.border;
const _cyan = CarSiGoColors.cyan;
const _textPrimary = CarSiGoColors.textPrimary;
const _textMuted = CarSiGoColors.textMuted;

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
        if (profile.role != UserRole.driver && profile.role != UserRole.admin) ...[
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () => _openDriverRequest(context, ref, profile),
              style: OutlinedButton.styleFrom(
                foregroundColor: CarSiGoColors.green,
                side: const BorderSide(color: CarSiGoColors.green, width: 1.5),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                textStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
              ),
              icon: const Icon(Icons.directions_car, size: 20),
              label: const Text('Quiero ser conductor'),
            ),
          ),
          const SizedBox(height: 12),
          const Text(
            'Si quieres manejar, envía tu solicitud aquí. El panel lo revisa '
            'y te activa como conductor.',
            style: TextStyle(color: _textMuted, fontSize: 11, height: 1.4),
            textAlign: TextAlign.center,
          ),
        ],
        const SizedBox(height: 24),
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

  void _openDriverRequest(
    BuildContext context,
    WidgetRef ref,
    UserProfile profile,
  ) async {
    final submitted = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: _bg,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => _DriverRequestSheet(profile: profile),
    );
    if (submitted == true && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Solicitud enviada. El panel la revisará para '
              'activarte como conductor.'),
          backgroundColor: CarSiGoColors.green,
        ),
      );
    }
  }
}

class _DriverRequestSheet extends ConsumerStatefulWidget {
  final UserProfile profile;
  const _DriverRequestSheet({required this.profile});

  @override
  ConsumerState<_DriverRequestSheet> createState() => _DriverRequestSheetState();
}

class _DriverRequestSheetState extends ConsumerState<_DriverRequestSheet> {
  final _plateCtrl = TextEditingController();
  String _vehicleType = 'moto';
  bool _sending = false;

  @override
  void dispose() {
    _plateCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final plate = _plateCtrl.text.trim().toUpperCase();
    if (plate.length < 3) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Escribe la placa de tu vehículo')),
      );
      return;
    }
    setState(() => _sending = true);

    final authService = ref.read(authServiceProvider);
    final user = authService.currentUser;
    var ok = false;
    if (user != null) {
      try {
        await authService.createDriverApplication(
          userId: user.uid,
          fullName: widget.profile.displayName,
          email: user.email ?? '',
          phone: widget.profile.phone,
          vehicleType: _vehicleType,
          plate: plate,
        );
        ok = true;
      } catch (_) {}
    }
    if (mounted) {
      setState(() => _sending = false);
      Navigator.of(context).pop(ok);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(24, 20, 24, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'Quiero ser conductor',
              textAlign: TextAlign.center,
              style: TextStyle(fontFamily: 'Poppins', fontSize: 18, fontWeight: FontWeight.w800, color: _textPrimary),
            ),
            const SizedBox(height: 6),
            const Text(
              'La solicitud queda pendiente; el administrador la aprueba en el panel.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 12, color: _textMuted, height: 1.4),
            ),
            const SizedBox(height: 20),
            DropdownButtonFormField<String>(
              initialValue: _vehicleType,
              decoration: _fieldDecoration('Tipo de vehículo', Icons.directions_car),
              items: const [
                DropdownMenuItem(value: 'moto', child: Text('Moto')),
                DropdownMenuItem(value: 'auto', child: Text('Automóvil')),
                DropdownMenuItem(value: 'camioneta', child: Text('Camioneta')),
              ],
              onChanged: (v) => setState(() => _vehicleType = v ?? 'moto'),
            ),
            const SizedBox(height: 14),
TextField(
              controller: _plateCtrl,
              textCapitalization: TextCapitalization.characters,
              decoration: InputDecoration(
                labelText: 'Placa del vehículo',
                prefixIcon: const Icon(Icons.pin_outlined),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: _border)),
              ),
            ),
            const SizedBox(height: 22),
            SizedBox(
              height: 50,
              child: FilledButton.icon(
                onPressed: _sending ? null : _submit,
                style: FilledButton.styleFrom(
                  backgroundColor: CarSiGoColors.green,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
                ),
                icon: _sending
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Icon(Icons.send, size: 18),
                label: Text(_sending ? 'Enviando…' : 'Enviar solicitud'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  InputDecoration _fieldDecoration(String label, IconData icon) {
    return InputDecoration(
      labelText: label,
      prefixIcon: Icon(icon),
      filled: true,
      fillColor: _surfaceLight,
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: _border)),
    );
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
