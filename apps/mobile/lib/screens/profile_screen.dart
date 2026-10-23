import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import '../models/user_profile.dart';
import '../providers/auth_provider.dart';
import '../theme/carsigo_theme.dart';


class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = context.palette;
    final profileAsync = ref.watch(userProfileProvider);

    return Scaffold(
      backgroundColor: p.bg,
      appBar: AppBar(
        title: Text('Mi perfil', style: TextStyle(fontWeight: FontWeight.w900, color: p.textPrimary, fontSize: 16)),
        centerTitle: true,
        backgroundColor: p.surface,
        foregroundColor: p.textPrimary,
        elevation: 0,
      ),
      body: profileAsync.when(
        loading: () => Center(child: CircularProgressIndicator(strokeWidth: 3, color: p.cyan)),
        error: (err, _) => Center(child: Text('Error: $err', style: TextStyle(color: Colors.red))),
        data: (profile) {
          if (profile == null) {
            return Center(child: Text('Perfil no disponible', style: TextStyle(color: p.textMuted)));
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
    final p = context.palette;
    final initials = profile.displayName.isNotEmpty
        ? profile.displayName.split(' ').map((e) => e.isNotEmpty ? e[0] : '').take(2).join().toUpperCase()
        : '?';
    final roleLabel = profile.role == UserRole.driver ? 'Conductor' : profile.role == UserRole.admin ? 'Admin' : 'Pasajero';
    final roleColor = profile.role == UserRole.driver ? const Color(0xFF22C55E) : p.cyan;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(children: [
        CircleAvatar(
          radius: 48,
          backgroundColor: p.surfaceLight,
          child: Text(initials, style: TextStyle(fontSize: 32, fontWeight: FontWeight.w900, color: p.cyan)),
        ),
        SizedBox(height: 16),
        Text(profile.displayName, style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: p.textPrimary)),
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
        SizedBox(height: 28),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(color: p.surface, borderRadius: BorderRadius.circular(16), border: Border.all(color: p.border)),
          child: Column(children: [
            _InfoRow(icon: Icons.phone, label: 'Teléfono', value: profile.phone.isNotEmpty ? profile.phone : 'No registrado'),
            Divider(color: p.border, height: 20),
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
                foregroundColor: p.green,
                side: BorderSide(color: p.green, width: 1.5),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                textStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
              ),
              icon: const Icon(Icons.directions_car, size: 20),
              label: const Text('Quiero ser conductor'),
            ),
          ),
          SizedBox(height: 12),
          Text(
            'Si quieres manejar, envía tu solicitud aquí. El panel lo revisa '
            'y te activa como conductor.',
            style: TextStyle(color: p.textMuted, fontSize: 11, height: 1.4),
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
    final p = context.palette;
    final submitted = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: p.bg,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => _DriverRequestSheet(profile: profile),
    );
    if (submitted == true && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Solicitud enviada. El panel la revisará para '
              'activarte como conductor.'),
          backgroundColor: p.green,
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
  CarSiGoPalette get p => context.palette;

  final _plateCtrl = TextEditingController();
  final _brandCtrl = TextEditingController();
  final _modelCtrl = TextEditingController();
  final _colorCtrl = TextEditingController();
  final _idCtrl = TextEditingController();
  String _vehicleType = 'moto';
  bool _sending = false;
  final Map<String, File> _photos = {};
  final _picker = ImagePicker();

  @override
  void dispose() {
    _plateCtrl.dispose();
    _brandCtrl.dispose();
    _modelCtrl.dispose();
    _colorCtrl.dispose();
    _idCtrl.dispose();
    super.dispose();
  }

  Future<void> _takePhoto(String tipo) async {
    final shot = await _picker.pickImage(
      source: ImageSource.camera,
      maxWidth: 1600,
      imageQuality: 82,
    );
    if (shot == null) return;
    setState(() => _photos[tipo] = File(shot.path));
  }

  Future<void> _submit() async {
    final plate = _plateCtrl.text.trim().toUpperCase();
    final brand = _brandCtrl.text.trim();
    final model = _modelCtrl.text.trim();
    final color = _colorCtrl.text.trim();
    final idNumber = _idCtrl.text.trim();
    final isMoto = _vehicleType == 'moto';

    String? firstMissing;
    if (idNumber.length < 5) firstMissing = 'Escribe el número de tu cédula';
    if (plate.length < 3) firstMissing = 'Escribe la placa de tu vehículo';
    if (brand.isEmpty) firstMissing = 'Escribe la marca de tu vehículo';
    if (model.isEmpty) firstMissing = 'Escribe el modelo de tu vehículo';
    if (color.isEmpty) firstMissing = 'Escribe el color de tu vehículo';
    if (firstMissing == null) {
      const required = ['cedula_frente', 'cedula_reverso', 'propiedad', 'seguro', 'licencia'];
      const labels = {
        'cedula_frente': 'cédula (frente)',
        'cedula_reverso': 'cédula (reverso)',
        'propiedad': 'tarjeta de propiedad',
        'seguro': 'seguro del vehículo',
        'licencia': 'licencia de conducción',
        'soat': 'SOAT',
      };
      final missing = required.where((k) => !_photos.containsKey(k)).toList();
      if (!isMoto && !_photos.containsKey('soat')) missing.add('soat');
      if (missing.isNotEmpty) {
        firstMissing =
            'Falta la foto de: ${missing.map((k) => labels[k]).join(', ')}';
      }
    }
    if (firstMissing != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(firstMissing)),
      );
      return;
    }
    setState(() => _sending = true);

    final authService = ref.read(authServiceProvider);
    final user = authService.currentUser;
    var ok = false;
    if (user != null) {
      try {
        final cedulaFrenteUrl = await authService.uploadDriverDocument(
          userId: user.uid, tipo: 'cedula_frente',
          filePath: _photos['cedula_frente']!.path);
        final cedulaReversoUrl = await authService.uploadDriverDocument(
          userId: user.uid, tipo: 'cedula_reverso',
          filePath: _photos['cedula_reverso']!.path);
        final propiedadUrl = await authService.uploadDriverDocument(
          userId: user.uid, tipo: 'propiedad',
          filePath: _photos['propiedad']!.path);
        final seguroUrl = await authService.uploadDriverDocument(
          userId: user.uid, tipo: 'seguro', filePath: _photos['seguro']!.path);
        final licenciaUrl = await authService.uploadDriverDocument(
          userId: user.uid, tipo: 'licencia',
          filePath: _photos['licencia']!.path);
        var soatUrl = '';
        if (_photos.containsKey('soat')) {
          soatUrl = await authService.uploadDriverDocument(
            userId: user.uid, tipo: 'soat', filePath: _photos['soat']!.path);
        }
        await authService.createDriverApplication(
          userId: user.uid,
          fullName: widget.profile.displayName,
          email: user.email ?? '',
          phone: widget.profile.phone,
          idNumber: idNumber,
          vehicleType: _vehicleType,
          plate: plate,
          brand: brand,
          model: model,
          color: color,
          cedulaFrenteUrl: cedulaFrenteUrl,
          cedulaReversoUrl: cedulaReversoUrl,
          propiedadUrl: propiedadUrl,
          seguroUrl: seguroUrl,
          licenciaUrl: licenciaUrl,
          soatUrl: soatUrl,
        );
        ok = true;
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Error al enviar: $e')),
          );
        }
      }
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
            Text(
              'Quiero ser conductor',
              textAlign: TextAlign.center,
              style: TextStyle(fontFamily: 'Poppins', fontSize: 18, fontWeight: FontWeight.w800, color: p.textPrimary),
            ),
            SizedBox(height: 6),
            Text(
              'Completa tus datos y toma cada foto con la cámara. '
              'El administrador revisa y aprueba la solicitud.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 12, color: p.textMuted, height: 1.4),
            ),
            const SizedBox(height: 20),
            DropdownButtonFormField<String>(
              initialValue: _vehicleType,
              decoration: _fieldDecoration('Tipo de vehículo', Icons.directions_car),
              items: const [
                DropdownMenuItem(value: 'moto', child: Text('Moto')),
                DropdownMenuItem(value: 'car', child: Text('Automóvil')),
              ],
              onChanged: (v) => setState(() => _vehicleType = v ?? 'moto'),
            ),
            const SizedBox(height: 14),
            TextField(
              controller: _idCtrl,
              keyboardType: TextInputType.number,
              decoration: _fieldDecoration('Número de cédula', Icons.badge_outlined),
            ),
            const SizedBox(height: 14),
            TextField(
              controller: _plateCtrl,
              textCapitalization: TextCapitalization.characters,
              decoration: _fieldDecoration('Placa del vehículo', Icons.pin_outlined),
            ),
            const SizedBox(height: 14),
            TextField(
              controller: _brandCtrl,
              decoration: _fieldDecoration('Marca', Icons.build_outlined),
            ),
            const SizedBox(height: 14),
            TextField(
              controller: _modelCtrl,
              keyboardType: TextInputType.number,
              decoration: _fieldDecoration('Modelo (año)', Icons.calendar_today_outlined),
            ),
            const SizedBox(height: 14),
            TextField(
              controller: _colorCtrl,
              decoration: _fieldDecoration('Color', Icons.palette_outlined),
            ),
            const SizedBox(height: 22),
            Text(
              'Documentos (foto en vivo)',
              style: TextStyle(fontWeight: FontWeight.w800, color: p.textPrimary, fontSize: 14),
            ),
            const SizedBox(height: 6),
            Text(
              'Las fotos se toman con la cámara del teléfono, nunca desde la galería.',
              style: TextStyle(fontSize: 11, color: p.textMuted, height: 1.4),
            ),
            const SizedBox(height: 12),
            _photoButton('cedula_frente', 'Cédula (frente)'),
            const SizedBox(height: 10),
            _photoButton('cedula_reverso', 'Cédula (reverso)'),
            const SizedBox(height: 10),
            _photoButton('propiedad', 'Tarjeta de propiedad'),
            const SizedBox(height: 10),
            _photoButton('seguro', 'Seguro del vehículo'),
            const SizedBox(height: 10),
            _photoButton('licencia', 'Licencia de conducción'),
            const SizedBox(height: 10),
            _photoButton('soat', _vehicleType == 'moto' ? 'SOAT (opcional)' : 'SOAT'),
            const SizedBox(height: 22),
            SizedBox(
              height: 50,
              child: FilledButton.icon(
                onPressed: _sending ? null : _submit,
                style: FilledButton.styleFrom(
                  backgroundColor: p.green,
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

  Widget _photoButton(String tipo, String label) {
    final file = _photos[tipo];
    return OutlinedButton.icon(
      onPressed: _sending ? null : () => _takePhoto(tipo),
      style: OutlinedButton.styleFrom(
        foregroundColor: file != null ? p.green : p.textMuted,
        side: BorderSide(color: file != null ? p.green : p.border),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        textStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
      ),
      icon: file != null
          ? const Icon(Icons.check_circle, size: 18)
          : const Icon(Icons.photo_camera_outlined, size: 18),
      label: Text(file != null ? '$label ✓' : label),
    );
  }

  InputDecoration _fieldDecoration(String label, IconData icon) {
    return InputDecoration(
      labelText: label,
      prefixIcon: Icon(icon),
      filled: true,
      fillColor: p.surfaceLight,
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: p.border)),
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
    final p = context.palette;
    return Row(children: [
      Icon(icon, color: p.textMuted, size: 20),
      SizedBox(width: 12),
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label, style: TextStyle(color: p.textMuted, fontSize: 11)),
        Text(value, style: TextStyle(color: p.textPrimary, fontSize: 14, fontWeight: FontWeight.w600)),
      ])),
    ]);
  }
}
