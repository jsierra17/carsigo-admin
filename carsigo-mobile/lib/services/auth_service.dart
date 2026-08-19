import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:firebase_auth/firebase_auth.dart' as firebase_auth;
import 'package:cloud_firestore/cloud_firestore.dart';

import '../models/user_profile.dart';

class AuthService {
  final firebase_auth.FirebaseAuth _firebaseAuth =
      firebase_auth.FirebaseAuth.instance;

  final FirebaseFirestore _firestore = FirebaseFirestore.instance;

  firebase_auth.User? get currentUser => _firebaseAuth.currentUser;

  Stream<firebase_auth.User?> get authStateChanges =>
      _firebaseAuth.authStateChanges();

  // ── Google Sign-In ────────────────────────────────────────

  Future<firebase_auth.UserCredential> signInWithGoogle() async {
    final webClientId = dotenv.env['GOOGLE_WEB_CLIENT_ID'];

    if (webClientId == null) {
      throw Exception(
        'Google Sign-In no está configurado.\n'
        'Agrega GOOGLE_WEB_CLIENT_ID en tu archivo .env',
      );
    }

    await _signOutGoogle();

    final googleSignIn = GoogleSignIn(serverClientId: webClientId);

    final GoogleSignInAccount? googleUser;

    try {
      googleUser = await googleSignIn.signIn();
    } catch (e) {
      if (e.toString().contains('canceled') ||
          e.toString().contains('SIGN_IN_CANCELLED')) {
        throw Exception('Inicio de sesión cancelado por el usuario.');
      }

      throw Exception(
        'Error al iniciar sesión con Google.\n'
        'Detalle: $e',
      );
    }

    if (googleUser == null) {
      throw Exception('Inicio de sesión cancelado por el usuario.');
    }

    final googleAuth = await googleUser.authentication;

    final credential = firebase_auth.GoogleAuthProvider.credential(
      idToken: googleAuth.idToken,

      accessToken: googleAuth.accessToken,
    );

    try {
      final userCredential = await _firebaseAuth.signInWithCredential(
        credential,
      );

      if (userCredential.user != null) {
        await _syncUserProfile(userCredential.user!);
      }

      return userCredential;
    } catch (e) {
      throw Exception(
        'Error autenticando con Firebase.\n'
        'Detalle: $e',
      );
    }
  }

  // ── Session ───────────────────────────────────────────────

  Future<void> signOut() async {
    await _signOutGoogle();

    await _firebaseAuth.signOut();
  }

  Future<void> _signOutGoogle() async {
    try {
      final google = GoogleSignIn();

      if (await google.isSignedIn()) {
        await google.signOut();

        await google.disconnect();
      }
    } catch (_) {}
  }

  // ── Profile Firestore ─────────────────────────────────────

  Future<UserProfile?> getUserProfile(String userId) async {
    try {
      final doc = await _firestore.collection('users').doc(userId).get();

      if (!doc.exists) {
        return null;
      }

      return UserProfile.fromJson({...doc.data()!, 'id': userId});
    } catch (_) {
      return null;
    }
  }

  Future<void> createProfile(UserProfile profile) async {
    await _firestore.collection('users').doc(profile.id).set({
      'id': profile.id,
      'phone': profile.phone,
      'name': profile.fullName,
      'full_name': profile.fullName,
      'role': profile.role.name,
      'avatar_url': profile.avatarUrl,
      'created_at': Timestamp.fromDate(profile.createdAt),
    }, SetOptions(merge: true));
  }

  /// Crea una solicitud de conductor pendiente de revisión en el panel admin.
  /// Usa exactamente los campos permitidos por Firestore Rules
  /// (user_id, status, name, email, phone, vehicle_type, plate, created_at).
  Future<void> createDriverApplication({
    required String userId,
    required String fullName,
    required String email,
    required String phone,
    required String vehicleType,
    required String plate,
  }) async {
    final docRef = _firestore.collection('driver_applications').doc();
    await docRef.set({
      'user_id': userId,
      'status': 'pending',
      'name': fullName,
      'email': email,
      'phone': phone,
      'vehicle_type': vehicleType,
      'plate': plate.trim().toUpperCase(),
      'created_at': Timestamp.now(),
    });
  }

  // ── Crear perfil después del login Firebase ───────────────

  Future<void> _syncUserProfile(firebase_auth.User firebaseUser) async {
    final existing = await getUserProfile(firebaseUser.uid);

    if (existing == null) {
      // Nuevos usuarios: SIEMPRE entran como pasajero (sin pantalla de
      // elección de rol). Quien quiera conducir lo solicita desde su perfil
      // y el panel admin le aprueba el rol.
      await createProfile(UserProfile(
        id: firebaseUser.uid,
        phone: firebaseUser.phoneNumber ?? '',
        fullName: firebaseUser.displayName ??
            firebaseUser.email?.split('@').first ??
            '',
        role: UserRole.passenger,
        avatarUrl: firebaseUser.photoURL,
        createdAt: DateTime.now(),
      ));
      return;
    }

    final updated = existing.copyWith(
      fullName: firebaseUser.displayName ?? existing.fullName,
      avatarUrl: firebaseUser.photoURL ?? existing.avatarUrl,
    );
    await createProfile(updated);
  }
}
