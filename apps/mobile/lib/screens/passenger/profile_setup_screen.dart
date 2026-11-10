import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../services/auth_service.dart';
import '../../models/user_profile.dart';
import '../../providers/auth_provider.dart';
import '../../theme/carsigo_theme.dart';

/// Pantalla de configuración de perfil del pasajero.
///
/// Flujo de dos pasos:
/// 1. Pantalla de seguridad (explicación de por qué pedimos los datos)
/// 2. Formulario de identidad (Nombres, Apellidos, Cédula, Teléfono)
///
/// Al finalizar, guarda en Firestore y pone `profile_completed = true`,
/// desbloqueando la creación de viajes.
class ProfileSetupScreen extends ConsumerStatefulWidget {
  const ProfileSetupScreen({super.key});

  @override
  ConsumerState<ProfileSetupScreen> createState() => _ProfileSetupScreenState();
}

class _ProfileSetupScreenState extends ConsumerState<ProfileSetupScreen> {
  CarSiGoPalette get p => context.palette;

  final _authService = AuthService();

  // Paso actual: 0 = seguridad, 1 = formulario
  int _step = 0;

  // Controladores del formulario
  final _firstNameCtrl = TextEditingController();
  final _lastNameCtrl = TextEditingController();
  final _idNumberCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();

  bool _saving = false;

  @override
  void dispose() {
    _firstNameCtrl.dispose();
    _lastNameCtrl.dispose();
    _idNumberCtrl.dispose();
    _phoneCtrl.dispose();
    super.dispose();
  }

  void _continueToForm() {
    setState(() => _step = 1);
  }

  Future<void> _saveProfile() async {
    if (_firstNameCtrl.text.trim().isEmpty ||
        _lastNameCtrl.text.trim().isEmpty ||
        _idNumberCtrl.text.trim().isEmpty ||
        _phoneCtrl.text.trim().isEmpty) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Todos los campos son obligatorios'),
          backgroundColor: Colors.redAccent,
        ),
      );
      return;
    }

    setState(() => _saving = true);

    try {
      final user = ref.read(currentUserProvider);
      if (user == null) throw Exception('Usuario no autenticado');

      final profile = UserProfile(
        id: user.uid,
        phone: _phoneCtrl.text.trim(),
        fullName: '${_firstNameCtrl.text.trim()} ${_lastNameCtrl.text.trim()}',
        firstName: _firstNameCtrl.text.trim(),
        lastName: _lastNameCtrl.text.trim(),
        idNumber: _idNumberCtrl.text.trim(),
        role: UserRole.passenger,
        avatarUrl: user.photoURL,
        createdAt: DateTime.now(),
        profileCompleted: true,
      );

      await _authService.createProfile(profile);

      if (!mounted) return;
      setState(() => _saving = false);

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Perfil guardado. Ya puedes solicitar viajes.'),
          backgroundColor: Colors.green,
        ),
      );

      // Volver a la pantalla principal (pasajero) para que continúe con su viaje
      Navigator.of(context).pop(true);
    } catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Error al guardar: $e'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: p.bg,
      body: _step == 0 ? _buildSecurityScreen() : _buildFormScreen(),
    );
  }

  // ── Paso 1: Mensaje de seguridad ──────────────────────────────────

  Widget _buildSecurityScreen() {
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 110,
              height: 110,
              decoration: BoxDecoration(
                color: p.cyan.withValues(alpha: 0.15),
                shape: BoxShape.circle,
                border: Border.all(
                  color: p.cyan.withValues(alpha: 0.4),
                  width: 2,
                ),
              ),
              child: const Icon(
                Icons.security,
                size: 56,
                color: Colors.white,
              ),
            ),
            const SizedBox(height: 32),
            Text(
              'Para tu seguridad',
              style: TextStyle(
                fontFamily: 'Poppins',
                fontSize: 24,
                fontWeight: FontWeight.w900,
                color: p.textPrimary,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            Text(
              'Para tu seguridad y la de nuestros conductores, necesitamos '
              'verificar tu identidad. Esta información solo se usará para '
              'emergencias y no se compartirá con terceros. Solo te la '
              'pediremos una vez.',
              style: TextStyle(
                fontFamily: 'Poppins',
                fontSize: 15,
                color: p.textSecondary,
                height: 1.6,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 32),
            SizedBox(
              width: double.infinity,
              height: 56,
              child: ElevatedButton.icon(
                onPressed: _continueToForm,
                style: ElevatedButton.styleFrom(
                  backgroundColor: p.cyan,
                  foregroundColor: p.bg,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                  textStyle: const TextStyle(
                    fontFamily: 'Poppins',
                    fontSize: 16,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 0.5,
                  ),
                ),
                icon: const Icon(Icons.arrow_forward, size: 20),
                label: const Text('Entendido, continuar'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── Paso 2: Formulario de datos ───────────────────────────────────

  Widget _buildFormScreen() {
    return Scaffold(
      backgroundColor: p.bg,
      appBar: AppBar(
        title: const Text('Completa tu perfil'),
        backgroundColor: p.surface,
        foregroundColor: p.textPrimary,
        elevation: 0,
        automaticallyImplyLeading: false,
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () => Navigator.of(context).pop(false),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Tus datos',
                style: TextStyle(
                  fontFamily: 'Poppins',
                  fontSize: 24,
                  fontWeight: FontWeight.w900,
                  color: p.textPrimary,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Rellena tus datos para poder solicitar viajes.',
                style: TextStyle(
                  fontSize: 14,
                  color: p.textMuted,
                ),
              ),
              const SizedBox(height: 28),

              // Nombres
              _buildTextField(
                controller: _firstNameCtrl,
                label: 'Nombres',
                hint: 'Ej: José Luis',
                icon: Icons.person_outline,
              ),
              const SizedBox(height: 16),

              // Apellidos
              _buildTextField(
                controller: _lastNameCtrl,
                label: 'Apellidos',
                hint: 'Ej: Pérez García',
                icon: Icons.person_outline,
              ),
              const SizedBox(height: 16),

              // Cédula
              _buildTextField(
                controller: _idNumberCtrl,
                label: 'Número de cédula',
                hint: 'Ej: 12345678',
                icon: Icons.badge_outlined,
                keyboardType: TextInputType.number,
              ),
              const SizedBox(height: 16),

              // Teléfono
              _buildTextField(
                controller: _phoneCtrl,
                label: 'Teléfono',
                hint: 'Ej: 3001234567',
                icon: Icons.phone_outlined,
                keyboardType: TextInputType.phone,
              ),
              const SizedBox(height: 32),

              SizedBox(
                width: double.infinity,
                height: 56,
                child: ElevatedButton(
                  onPressed: _saving ? null : _saveProfile,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: p.cyan,
                    foregroundColor: p.bg,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                    textStyle: const TextStyle(
                      fontFamily: 'Poppins',
                      fontSize: 16,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  child: _saving
                      ? const SizedBox(
                          width: 24,
                          height: 24,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Text('Guardar y continuar'),
                ),
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String label,
    required String hint,
    required IconData icon,
    TextInputType? keyboardType,
  }) {
    return TextField(
      controller: controller,
      keyboardType: keyboardType,
      style: TextStyle(color: p.textPrimary),
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        prefixIcon: Icon(icon, color: p.cyan),
        filled: true,
        fillColor: p.surface,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: p.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: p.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: p.cyan, width: 2),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      ),
    );
  }
}