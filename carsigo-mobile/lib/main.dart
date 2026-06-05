import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:carsigo_mobile/services/supabase_service.dart';
import 'package:carsigo_mobile/screens/onboarding/onboarding_screen.dart';
import 'package:carsigo_mobile/screens/driver/driver_home_screen.dart';
import 'package:carsigo_mobile/screens/passenger/passenger_home_screen.dart';
import 'package:carsigo_mobile/providers/auth_provider.dart';
import 'package:carsigo_mobile/models/user_profile.dart';
import 'package:google_fonts/google_fonts.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await dotenv.load(fileName: ".env");

  await SupabaseService.initialize();

  runApp(
    const ProviderScope(
      child: CarSiGoApp(),
    ),
  );
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
        textTheme: GoogleFonts.poppinsTextTheme(),
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
        final user = state.session?.user;

        if (user == null) {
          return const OnboardingScreen();
        }

        final userProfile = ref.watch(userProfileProvider);

        return userProfile.when(
          data: (profile) {
            if (profile == null) {
              return Scaffold(
                body: Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const SizedBox(
                        width: 48,
                        height: 48,
                        child: CircularProgressIndicator(),
                      ),
                      const SizedBox(height: 20),
                      Text(
                        'Configurando tu cuenta...',
                        style: GoogleFonts.poppins(fontSize: 16),
                      ),
                    ],
                  ),
                ),
              );
            }

            if (profile.role == UserRole.driver) {
              return const DriverHomeScreen();
            }
            return const PassengerHomeScreen();
          },
          loading: () => const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          ),
          error: (err, stack) => Scaffold(
            body: Center(child: Text('Error al cargar perfil: $err')),
          ),
        );
      },
      loading: () => const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      ),
      error: (err, stack) => Scaffold(
        body: Center(child: Text('Error de autenticacion: $err')),
      ),
    );
  }
}
