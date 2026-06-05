import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../providers/auth_provider.dart';

class OtpVerificationScreen extends ConsumerStatefulWidget {
  final String phone;
  const OtpVerificationScreen({super.key, required this.phone});

  @override
  ConsumerState<OtpVerificationScreen> createState() => _OtpVerificationScreenState();
}

class _OtpVerificationScreenState extends ConsumerState<OtpVerificationScreen> {
  final TextEditingController _otpController = TextEditingController();

  Future<void> _verifyOtp() async {
    final token = _otpController.text.trim();
    if (token.length < 6) return;

    await ref.read(authControllerProvider.notifier).verifyOtp(widget.phone, token);

    final state = ref.read(authControllerProvider);
    if (state.hasError) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(state.error.toString()), backgroundColor: Colors.red),
        );
      }
    } else {
       // El AuthGate en main.dart se encargará de la navegación al cambiar el estado de la sesión
       if (mounted) {
         Navigator.of(context).popUntil((route) => route.isFirst);
       }
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authControllerProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Verificación')),
      body: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Ingresa el código',
              style: GoogleFonts.poppins(fontSize: 24, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text('Enviamos un SMS al ${widget.phone}'),
            const SizedBox(height: 32),
            TextField(
              controller: _otpController,
              keyboardType: TextInputType.number,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 24, letterSpacing: 8),
              decoration: InputDecoration(
                hintText: '000000',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              height: 55,
              child: ElevatedButton(
                onPressed: authState.isLoading ? null : _verifyOtp,
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.blue[800],
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: authState.isLoading
                    ? const CircularProgressIndicator(color: Colors.white)
                    : const Text('Verificar Código', style: TextStyle(color: Colors.white, fontSize: 16)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
