import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../services/auth_service.dart';
import '../models/user_profile.dart';

final authServiceProvider = Provider((ref) => AuthService());

final authStateProvider = StreamProvider<AuthState>((ref) {
  return ref.watch(authServiceProvider).authStateChanges;
});

final currentUserProvider = Provider<User?>((ref) {
  final authState = ref.watch(authStateProvider).value;
  return authState?.session?.user;
});

final userProfileProvider = FutureProvider<UserProfile?>((ref) async {
  final userId = ref.watch(currentUserProvider)?.id;
  if (userId == null) return null;
  return await ref.watch(authServiceProvider).getUserProfile(userId);
});

class AuthController extends StateNotifier<AsyncValue<void>> {
  final AuthService _authService;
  final Ref _ref;

  AuthController(this._authService, this._ref) : super(const AsyncData(null));

  Future<void> _syncProfile() async {
    final user = _authService.currentUser;
    if (user == null) return;

    final existing = await _authService.getUserProfile(user.id);

    if (existing != null) {
      final updated = existing.copyWith(
        fullName: user.userMetadata?['full_name'] ?? existing.fullName,
        avatarUrl: user.userMetadata?['avatar_url'] ?? existing.avatarUrl,
      );
      await _authService.createProfile(updated);
    } else {
      final newProfile = UserProfile(
        id: user.id,
        phone: user.phone ?? '',
        fullName:
            user.userMetadata?['full_name'] ??
            user.email?.split('@').first ??
            '',
        role: UserRole.passenger,
        avatarUrl: user.userMetadata?['avatar_url'],
        createdAt: DateTime.now(),
      );
      await _authService.createProfile(newProfile);
    }
  }

  Future<void> signInWithGoogle() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      await _authService.signInWithGoogle();
      await _syncProfile();
    });
    _ref.invalidate(userProfileProvider);
  }

  Future<void> signOut() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      await _authService.signOut();
    });
  }

  AsyncValue<void> get error => state;
}

final authControllerProvider =
    StateNotifierProvider<AuthController, AsyncValue<void>>((ref) {
      return AuthController(ref.watch(authServiceProvider), ref);
    });
