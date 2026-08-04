import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/user_profile.dart';

class AuthService {
  final SupabaseClient _supabase = Supabase.instance.client;

  User? get currentUser => _supabase.auth.currentUser;
  Stream<AuthState> get authStateChanges => _supabase.auth.onAuthStateChange;

  // ── Google Sign-In ────────────────────────────────────────

  Future<AuthResponse> signInWithGoogle() async {
    final webClientId = dotenv.env['GOOGLE_WEB_CLIENT_ID'];

    if (webClientId == null) {
      throw Exception(
        'Google Sign-In no esta configurado.\n'
        'Agrega GOOGLE_WEB_CLIENT_ID en tu archivo .env',
      );
    }

    // Cerrar sesion previa de Google para forzar seleccion de cuenta
    await _signOutGoogle();

    final googleSignIn = GoogleSignIn(
      serverClientId: webClientId,
    );

    final GoogleSignInAccount? googleUser;
    try {
      googleUser = await googleSignIn.signIn();
    } catch (e) {
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
        'Esto ocurre cuando la huella SHA-1 no esta registrada en Google Cloud Console.\n\n'
        'Para obtener tu SHA-1, ejecuta este comando en la terminal:\n'
        '  cd android && .\\gradlew signingReport\n\n'
        'Luego registra la huella SHA-1 de la tarea "debug" en:\n'
        'Google Cloud Console > APIs & Services > Credentials\n'
        '> Crear Credenciales > ID de cliente de OAuth 2.0 > Tipo: Aplicacion Android\n'
        '  - Nombre del paquete: com.carsigo.app\n'
        '  - Huella SHA-1: <la que obtuviste del comando>\n\n'
        'Si ya esta registrada, asegurate de que sea la misma SHA-1 de tu maquina actual.',
      );
    }

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
    await _signOutGoogle();
    await _supabase.auth.signOut();
  }

  Future<void> _signOutGoogle() async {
    try {
      final g = GoogleSignIn();
      if (await g.isSignedIn()) {
        await g.signOut();
        await g.disconnect();
      }
    } catch (_) {}
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
