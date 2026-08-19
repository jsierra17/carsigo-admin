import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_core/firebase_core.dart';
import 'firebase_options.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:carsigo_mobile/services/preferences_service.dart';
import 'package:carsigo_mobile/theme/carsigo_theme.dart';
import 'package:carsigo_mobile/screens/onboarding/onboarding_screen.dart';
import 'package:carsigo_mobile/screens/auth/login_screen.dart';
import 'package:carsigo_mobile/screens/driver/driver_home_screen.dart';
import 'package:carsigo_mobile/screens/passenger/passenger_home_screen.dart';
import 'package:carsigo_mobile/providers/auth_provider.dart';
import 'package:carsigo_mobile/models/user_profile.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await dotenv.load(fileName: ".env");

  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);

  runApp(const ProviderScope(child: CarSiGoApp()));
}

class CarSiGoApp extends StatelessWidget {
  const CarSiGoApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'CarSiGo',
      debugShowCheckedModeBanner: false,
      theme: buildCarSiGoTheme(),
      home: const AuthGate(),
    );
  }
}

class AuthGate extends ConsumerWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authStateProvider);

    return authState.when(
      data: (state) {
        final user = state;
        if (user == null) {
          return FutureBuilder<bool>(
            future: PreferencesService.isOnboardingCompleted(),
            builder: (context, snapshot) {
              if (!snapshot.hasData) {
                return const Scaffold(
                  body: Center(child: CircularProgressIndicator()),
                );
              }
              return snapshot.data!
                  ? const LoginScreen()
                  : const OnboardingScreen();
            },
          );
        }

        final userProfile = ref.watch(userProfileProvider);

        return userProfile.when(
          data: (profile) {
            // Nunca se elige rol al entrar: el perfil faltante se crea
            // automáticamente como pasajero (la solicitud de conductor solo
            // se hace desde el perfil, con aprobación del panel admin).
            if (profile == null) {
              return const AutoPassengerSetup();
            }

            if (profile.role == UserRole.driver) {
              return const DriverHomeScreen();
            }
            return const PassengerHomeScreen();
          },
          loading: () =>
              const Scaffold(body: Center(child: CircularProgressIndicator())),
          error: (err, stack) => Scaffold(
            body: Center(child: Text('Error al cargar perfil: $err')),
          ),
        );
      },
      loading: () =>
          const Scaffold(body: Center(child: CircularProgressIndicator())),
      error: (err, stack) =>
          Scaffold(body: Center(child: Text('Error de autenticacion: $err'))),
    );
  }
}

/// Postura de respaldo ante un perfil ausente: crea el perfil como pasajero
/// en Firestore (garantiza que todo el mundo entra como pasajero) y luego
/// invalida el provider para que el AuthGate redirija a la pantalla de
/// pasajero. No muestra ninguna pantalla de elección de rol.
class AutoPassengerSetup extends ConsumerStatefulWidget {
  const AutoPassengerSetup({super.key});

  @override
  ConsumerState<AutoPassengerSetup> createState() => _AutoPassengerSetupState();
}

class _AutoPassengerSetupState extends ConsumerState<AutoPassengerSetup> {
  @override
  void initState() {
    super.initState();
    _ensurePassenger();
  }

  Future<void> _ensurePassenger() async {
    try {
      final authService = ref.read(authServiceProvider);
      final user = authService.currentUser;
      if (user != null) {
        await authService.createProfile(UserProfile(
          id: user.uid,
          phone: user.phoneNumber ?? '',
          fullName: user.displayName ?? user.email?.split('@').first ?? '',
          role: UserRole.passenger,
          avatarUrl: user.photoURL,
          createdAt: DateTime.now(),
        ));
      }
    } catch (_) {
      // Si falla la escritura, el provider se invalida igual y se reintenta
      // en el siguiente ciclo de AuthGate.
    }
    if (mounted) {
      ref.invalidate(userProfileProvider);
    }
  }

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(child: CircularProgressIndicator()),
    );
  }
}
