import 'dart:io';

import 'package:firebase_app_check/firebase_app_check.dart';
import 'package:flutter/foundation.dart';

/// Inicializa Firebase App Check para evitar que terceros consuman la cuota
/// del proyecto (y generen coste) usando las API Keys de la app.
///
/// - Android -> Play Integrity (`AndroidPlayIntegrityProvider`).
/// - iOS     -> DeviceCheck (`AppleDeviceCheckProvider`).
/// - Otros  -> sin App Check (los emuladores de escritorio no lo soportan).
///
/// Requiere registrar la app en la consola de Firebase:
/// https://console.firebase.google.com/project/carsigo-9e508/appcheck
///
/// SHA-1 de la app Android que debe registrarse en Play Integrity:
///   2bd8d3c51561addaa36f3a0f1d2da6a325f20463
/// Bundle id de la app iOS para DeviceCheck:
///   com.example.carsigoMobile
///
/// NOTA: ambas APIs deben estar en modo "Monitor" (no "Enforce") hasta
/// verificar que la app funciona; si no, se bloquean las peticiones.
class AppCheckService {
  const AppCheckService._();

  /// Devuelve true si App Check quedo activo.
  static Future<bool> initialize() async {
    if (kIsWeb) {
      // En web la app movil no aplica; el panel Vue usa reCAPTCHA v3.
      debugPrint('[app-check] plataforma web: se omite App Check movil.');
      return false;
    }

    try {
      final firebaseAppCheck = FirebaseAppCheck.instance;

      if (Platform.isAndroid) {
        await firebaseAppCheck.activate(
          providerAndroid: const AndroidPlayIntegrityProvider(),
        );
        // Refresca el token de App Check cuando Google lo invalida.
        await firebaseAppCheck.setTokenAutoRefreshEnabled(true);
        debugPrint('[app-check] App Check activado con Play Integrity.');
        return true;
      }

      if (Platform.isIOS) {
        await firebaseAppCheck.activate(
          providerApple: const AppleDeviceCheckProvider(),
        );
        await firebaseAppCheck.setTokenAutoRefreshEnabled(true);
        debugPrint('[app-check] App Check activado con DeviceCheck.');
        return true;
      }

      debugPrint('[app-check] plataforma no soportada: se omite.');
      return false;
    } catch (error) {
      // App Check no debe impedir que la app arranque: sin el, sigue
      // funcionando (solo pierde la proteccion contra abuso).
      debugPrint('[app-check] no se pudo inicializar App Check: $error');
      return false;
    }
  }
}
