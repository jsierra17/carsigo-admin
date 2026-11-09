import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:firebase_auth/firebase_auth.dart' as firebase_auth;
import 'package:cloud_firestore/cloud_firestore.dart';

/// Servicio para gestionar Firebase Cloud Messaging (FCM).
///
/// Responsabilidad ÚNICA: registrar el token FCM del usuario y guardarlo en
/// Firestore (`users/{uid}.fcmToken`). NO envía notificaciones desde el cliente.
///
/// El envío de notificaciones es EXCLUSIVAMENTE responsabilidad de Cloud Functions
/// (via `firebase-admin/messaging`) para evitar riesgos de seguridad.
class MessagingService {
  const MessagingService._();

  static final _messaging = FirebaseMessaging.instance;

  /// Inicializa FCM, pide permisos y guarda el token en Firestore.
  ///
  /// Debe llamarse DESPUÉS de `Firebase.initializeApp()` y `AppCheckService.initialize()`.
  /// Retorna `true` si la inicialización fue exitosa.
  static Future<bool> initialize() async {
    try {
      // En web, FCM no está soportado de la misma manera; saltar.
      if (kIsWeb) {
        debugPrint('[messaging] plataforma web: se omite inicialización FCM.');
        return false;
      }

      // Solicitar permisos (iOS requiere autorización explícita).
      final settings = await _messaging.requestPermission(
        alert: true,
        badge: true,
        sound: true,
        provisional: false,
      );

      if (settings.authorizationStatus != AuthorizationStatus.authorized) {
        debugPrint('[messaging] permisos denegados: ${settings.authorizationStatus}');
        // No fallar: la app puede funcionar sin notificaciones push.
        return false;
      }

      // Obtener token FCM actual.
      final token = await _messaging.getToken();
      if (token == null) {
        debugPrint('[messaging] no se pudo obtener token FCM');
        return false;
      }

      debugPrint('[messaging] token FCM obtenido: ${token.substring(0, 20)}...');

      // Guardar token en Firestore asociado al usuario actual.
      await _saveTokenToFirestore(token);

      // Escuchar actualizaciones de token (rotación automática).
      _messaging.onTokenRefresh.listen((newToken) {
        debugPrint('[messaging] token FCM actualizado');
        _saveTokenToFirestore(newToken);
      });

      // Configurar handlers de mensaje (solo para logging/UI, no para lógica de negocio).
      _setupMessageHandlers();

      debugPrint('[messaging] inicialización completada');
      return true;
    } catch (e) {
      // FCM no debe impedir que la app arranque: log y continúa.
      debugPrint('[messaging] error en inicialización: $e');
      return false;
    }
  }

  /// Guarda el token FCM en el documento del usuario en Firestore.
  ///
  /// Usa `set(..., SetOptions(merge: true))` para no sobrescribir otros campos.
  static Future<void> _saveTokenToFirestore(String token) async {
    try {
      final user = firebase_auth.FirebaseAuth.instance.currentUser;
      if (user == null) {
        debugPrint('[messaging] no hay usuario autenticado, token no guardado');
        return;
      }

      await FirebaseFirestore.instance
          .collection('users')
          .doc(user.uid)
          .set({'fcmToken': token, 'fcmTokenUpdatedAt': FieldValue.serverTimestamp()},
              SetOptions(merge: true));

      debugPrint('[messaging] token guardado para usuario ${user.uid}');
    } catch (e) {
      debugPrint('[messaging] error guardando token en Firestore: $e');
      // No relanzar: el token se reintentará en la próxima actualización.
    }
  }

  /// Configura handlers para mensajes en foreground/background.
  ///
  /// IMPORTANTE: Estos handlers son SOLO para mostrar notificaciones en la UI
  /// o actualizar estado local. NO ejecutan lógica de negocio crítica.
  static void _setupMessageHandlers() {
    // Mensaje recibido con la app en primer plano.
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      debugPrint('[messaging] mensaje en foreground: ${message.messageId}');
      // Aquí podrías mostrar un snackbar, actualizar un badge, etc.
      // NO procesar lógica de negocio (ej. no actualizar estado de viaje).
    });

    // Mensaje que abrió la app desde estado terminado (background).
    FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
      debugPrint('[messaging] mensaje abrió app: ${message.messageId}');
      // Aquí podrías navegar a la pantalla correspondiente.
      // La navegación se maneja mejor desde el estado de la app (AuthGate).
    });

    // Mensaje recibido con la app en background (solo datos).
    // FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);
  }

  /// Handler para mensajes en background (opcional, requiere función top-level).
  ///
  /// En la práctica, los mensajes de datos en background se entregan a
  /// `onMessageOpenedApp` cuando el usuario toca la notificación.
  // static Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  //   await Firebase.initializeApp();
  //   debugPrint('[messaging] background message: ${message.messageId}');
  // }
}