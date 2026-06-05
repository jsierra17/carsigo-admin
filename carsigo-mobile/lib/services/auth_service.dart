import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/user_profile.dart';

class AuthService {
  final SupabaseClient _supabase = Supabase.instance.client;

  User? get currentUser => _supabase.auth.currentUser;
  Stream<AuthState> get authStateChanges => _supabase.auth.onAuthStateChange;

  // ── Email / Password ──────────────────────────────────────

  Future<AuthResponse> signUpWithEmail({
    required String email,
    required String password,
    required String fullName,
  }) async {
    return await _supabase.auth.signUp(
      email: email,
      password: password,
      data: {'full_name': fullName},
    );
  }

  Future<AuthResponse> signInWithPassword({
    required String email,
    required String password,
  }) async {
    return await _supabase.auth.signInWithPassword(
      email: email,
      password: password,
    );
  }

  // ── Phone OTP ─────────────────────────────────────────────

  Future<void> signInWithOtp(String phone) async {
    await _supabase.auth.signInWithOtp(
      phone: phone,
      shouldCreateUser: true,
    );
  }

  Future<AuthResponse> verifyOtp(String phone, String token) async {
    return await _supabase.auth.verifyOTP(
      phone: phone,
      token: token,
      type: OtpType.sms,
    );
  }

  // ── Email OTP ─────────────────────────────────────────────

  Future<void> signInWithEmail(String email) async {
    await _supabase.auth.signInWithOtp(
      email: email,
      shouldCreateUser: true,
    );
  }

  Future<AuthResponse> verifyEmailOtp(String email, String token) async {
    return await _supabase.auth.verifyOTP(
      email: email,
      token: token,
      type: OtpType.email,
    );
  }

  // ── Google Sign-In ────────────────────────────────────────

  Future<AuthResponse> signInWithGoogle() async {
    final webClientId = dotenv.env['GOOGLE_WEB_CLIENT_ID'];

    if (webClientId == null) {
      throw Exception(
        'Google Sign-In no esta configurado.\n'
        'Agrega GOOGLE_WEB_CLIENT_ID en tu archivo .env',
      );
    }

    // Permitir que el usuario elija una cuenta cada vez
    final googleSignIn = GoogleSignIn(
      serverClientId: webClientId,
    );

    final GoogleSignInAccount? googleUser;
    try {
      googleUser = await googleSignIn.signIn();
    } catch (e) {
      // Si el usuario cancela o hay un error de plataforma
      if (e.toString().contains('canceled') || e.toString().contains('SIGN_IN_CANCELLED')) {
        throw Exception('Inicio de sesion cancelado por el usuario.');
      }
      throw Exception(
        'Error al iniciar sesion con Google.\n'
        'Verifica que Google Play Services este actualizado.\n'
        'Detalle: $e',
      );
    }

    if (googleUser == null) {
      throw Exception('Inicio de sesion cancelado por el usuario.');
    }

    final GoogleSignInAuthentication googleAuth;
    try {
      googleAuth = await googleUser.authentication;
    } catch (e) {
      throw Exception(
        'Error al obtener credenciales de Google.\n'
        'Detalle: $e',
      );
    }

    final idToken = googleAuth.idToken;

    if (idToken == null) {
      throw Exception(
        'No se pudo obtener el token de Google.\n'
        'Verifica que la huella SHA-1 del proyecto este registrada en Google Cloud Console.\n\n'
        'SHA-1 debug: 2B:D8:D3:C5:15:61:AD:DA:A3:6F:3A:0F:1D:2D:A6:A3:25:F2:04:63\n\n'
        'Registra esta huella en:\n'
        'Google Cloud Console > APIs & Services > Credentials >\n'
        'OAuth 2.0 Client ID (Android)',
      );
    }

    // Intercambiar el ID token de Google por una sesion de Supabase
    try {
      return await _supabase.auth.signInWithIdToken(
        provider: OAuthProvider.google,
        idToken: idToken,
        accessToken: googleAuth.accessToken,
      );
    } catch (e) {
      throw Exception(
        'Error al autenticar con Supabase.\n'
        'Verifica que Google Sign-In este habilitado en el panel de Supabase.\n'
        'Authentication > Providers > Google\n\n'
        'Detalle: $e',
      );
    }
  }

  // ── Session ───────────────────────────────────────────────

  Future<void> signOut() async {
    await _supabase.auth.signOut();
  }

  // ── Profile ───────────────────────────────────────────────

  Future<UserProfile?> getUserProfile(String userId) async {
    try {
      final data = await _supabase
          .from('users')
          .select()
          .eq('id', userId)
          .maybeSingle();
      if (data == null) return null;
      return UserProfile.fromJson(data);
    } catch (e) {
      return null;
    }
  }

  Future<void> createProfile(UserProfile profile) async {
    await _supabase.from('users').upsert(profile.toJson());
  }
}
