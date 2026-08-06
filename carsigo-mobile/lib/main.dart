import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_core/firebase_core.dart';
import 'firebase_options.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:carsigo_mobile/services/preferences_service.dart';
import 'package:carsigo_mobile/screens/onboarding/onboarding_screen.dart';
import 'package:carsigo_mobile/screens/auth/login_screen.dart';
import 'package:carsigo_mobile/screens/auth/role_selection_screen.dart';
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
      theme: ThemeData(
        useMaterial3: true,
        colorSchemeSeed: Colors.blue,
        fontFamily: 'Poppins',
      ),
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
            if (profile == null) {
              return const RoleSelectionScreen();
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
