# 📱 CarSiGo Mobile — App de pasajero y conductor (Flutter)

> ⚠️ Este proyecto es **100 % Flutter y Dart** con **Firebase** como backend y
> **Google Maps** para los mapas. No usa Supabase, Mapbox ni React Native.
> Las reglas para asistentes de IA están en [`CLAUDE.md`](../../CLAUDE.md).

---

## 🤖 Contexto para asistentes de IA

Si eres una IA leyendo este archivo, este es tu manual operativo para la
aplicación móvil de CarSiGo.

**Contexto:** estás dentro de `apps/mobile/`. El proyecto es Flutter + Dart.

**Backend:** Firebase (Firestore + Firebase Auth + Firebase Storage +
Firebase Messaging). Usa los paquetes oficiales `firebase_core`,
`firebase_auth`, `cloud_firestore`, `firebase_storage`, `firebase_messaging` y
`firebase_app_check`.

**Mapas:** `google_maps_flutter` (Google Maps SDK) + `geolocator` para el GPS.
**Geocodificación y rutas:** Google Places / Geocoding / Directions vía REST.

**Reglas de negocio:** CarSiGo es una app de transporte hiperlocal (estilo
inDrive). Comisión del 10 %, saldo mínimo de billetera para conductores,
negociación de tarifas.

---

## 🛠️ Stack tecnológico móvil

| Capa | Tecnología |
|---|---|
| Framework | Flutter 3.10+ |
| Lenguaje | Dart |
| Estado | Riverpod 2 (`flutter_riverpod`) |
| Base de datos y auth | Firebase (Firestore + Firebase Auth) |
| Mapas y GPS | `google_maps_flutter`, `geolocator` |
| Ubicación / rutas | Google Places / Geocoding / Directions (REST) |
| Push | `firebase_messaging` |
| Seguridad | `firebase_app_check` (Play Integrity en Android, DeviceCheck en iOS) |

---

## 📂 Estructura de `lib/`

```
lib/
├── main.dart                # Entry point: Firebase + App Check + tema + AuthGate
├── firebase_options.dart    # Config de Firebase (generada por FlutterFire CLI)
├── models/
│   ├── trip.dart            # Modelo Trip
│   └── user_profile.dart    # Modelo UserProfile
├── providers/
│   ├── auth_provider.dart   # Riverpod providers de auth
│   └── theme_provider.dart  # Riverpod provider del tema claro/oscuro
├── screens/
│   ├── onboarding/          # Onboarding + Google Sign-In
│   ├── auth/                # Login (email + Google)
│   ├── passenger/           # Home del pasajero + búsqueda de destino
│   ├── driver/              # Home del conductor
│   ├── profile_screen.dart  # Perfil y ajustes
│   └── trip_history_screen.dart
├── services/
│   ├── auth_service.dart          # Auth (email, Google, custom claims)
│   ├── location_service.dart      # Places / Geocoding / Directions
│   ├── zone_service.dart          # Zonas de servicio (geofences)
│   ├── trip_service.dart          # Solicitudes y aceptar viajes
│   ├── pricing_engine.dart        # Cálculo de tarifa
│   ├── map_markers.dart           # Marcadores del mapa
│   ├── preferences_service.dart   # Preferencias locales
│   ├── recent_destinations.dart   # Destinos recientes
│   └── app_check_service.dart     # Play Integrity / DeviceCheck
└── theme/carsigo_theme.dart  # Tema Material 3 de la marca
```

---

## 🔑 Variables de entorno

`apps/mobile/.env` (ignorado por git,usa `.env.example` como plantilla):

| Variable | Descripción |
|---|---|
| `GOOGLE_WEB_SERVICES_KEY` | API key de Google Web Services **para Android** (`com.carsigo.app`) |
| `GOOGLE_WEB_SERVICES_KEY_IOS` | API key de Google Web Services **para iOS** (`com.example.carsigoMobile`) |
| `GOOGLE_WEB_CLIENT_ID` | Client ID OAuth de Google (web) |
| `GOOGLE_IOS_CLIENT_ID` | Client ID OAuth de Google (iOS) |

> Las API keys de Google solo admiten **una** familia de restricción de cliente
> por clave (browser | android | ios | server), así que hacen falta **dos**
> claves de Web Services: una por plataforma. `location_service.dart` elige la
> correcta según `Platform.isIOS`.

---

## 🚀 Estado de implementación

### ✅ Hecho

- [x] Bootstrap de Firebase (`firebase_core`) y App Check (`firebase_app_check`).
- [x] Onboarding con Google Sign-In.
- [x] Login con email/contraseña.
- [x] Selección de rol (pasajero / conductor) sobre `users`.
- [x] Home del pasajero con mapa y búsqueda de destino (Google Places).
- [x] Home del conductor con nearby yacceptación de solicitudes.
- [x] Geocodificación y cálculo de ruta (Geocoding + Directions).
- [x] Historial de viajes y perfil.
- [x] Tema claro/oscuro persistido.
- [x] Carga de documentos del conductor a Firebase Storage.

### 🚧 Pendiente

- [ ] Solicitud de viaje con negociación de tarifa inDrive (oferta/contraoferta).
- [ ] Tracking GPS en tiempo real del viaje.
- [ ] Pagos integrados y billetera del conductor en la app.
- [ ] Chat pasajero-conductor.
- [ ] Push real configurado (FCM) — falta el servidor emisor.

---

## 🧪 Comandos

```bash
cd apps/mobile
flutter pub get        # Instalar dependencias
flutter run            # Ejecutar en dispositivo/emulador
flutter build apk      # Build Android
flutter build ios      # Build iOS
flutter analyze        # Análisis estático
```

> La app **no arranca sin `apps/mobile/.env`**: `dotenv.load(fileName: ".env")`
> falla si no existe.
