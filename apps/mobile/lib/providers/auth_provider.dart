import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_auth/firebase_auth.dart';

import '../services/auth_service.dart';
import '../models/user_profile.dart';

// Servicio de autenticación

final authServiceProvider = Provider<AuthService>((ref) {
  return AuthService();
});

// Estado Firebase Auth

final authStateProvider = StreamProvider<User?>((ref) {
  return FirebaseAuth.instance.authStateChanges();
});

// Usuario actual

final currentUserProvider = Provider<User?>((ref) {
  return ref.watch(authStateProvider).value;
});

// Perfil del usuario guardado en Firestore

final userProfileProvider = FutureProvider<UserProfile?>((ref) async {
  final user = ref.watch(currentUserProvider);

  if (user == null) {
    return null;
  }

  final authService = ref.watch(authServiceProvider);

  return await authService.getUserProfile(user.uid);
});

class AuthController extends StateNotifier<AsyncValue<void>> {
  final AuthService _authService;

  final Ref _ref;

  AuthController(this._authService, this._ref) : super(const AsyncData(null));

  // Login Google Firebase

  Future<void> signInWithGoogle() async {
    state = const AsyncLoading();

    state = await AsyncValue.guard(() async {
      await _authService.signInWithGoogle();
    });

    _ref.invalidate(userProfileProvider);
  }

  // Cerrar sesión

  Future<void> signOut() async {
    state = const AsyncLoading();

    state = await AsyncValue.guard(() async {
      await _authService.signOut();
    });

    _ref.invalidate(userProfileProvider);
  }

  AsyncValue<void> get error => state;
}

final authControllerProvider =
    StateNotifierProvider<AuthController, AsyncValue<void>>((ref) {
      return AuthController(ref.watch(authServiceProvider), ref);
    });
