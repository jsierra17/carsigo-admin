# CarSiGo — Documentación del Proyecto

## Resumen

CarSiGo es una plataforma de movilidad hiperlocal para Colombia. Consta de dos aplicaciones:

| App | Stack | Propósito |
|-----|-------|-----------|
| **carsigo-admin** | Next.js 16 + Firebase | Panel web de administración |
| **carsigo-mobile** | Flutter 3 + Firebase | App móvil para pasajeros y conductores |

---

## Stack Tecnológico

### Web Admin (`carsigo-admin/`)
- **Framework:** Next.js 16 (App Router)
- **Lenguaje:** TypeScript 5
- **Estilos:** Tailwind CSS 4
- **Backend:** Firebase (Firestore + Firebase Auth)
- **Mapas:** Mapbox GL JS + react-map-gl
- **PDFs:** jsPDF + jspdf-autotable
- **Iconos:** Lucide React

### App Móvil (`carsigo-mobile/`)
- **Framework:** Flutter 3.10+
- **Lenguaje:** Dart
- **Estado:** Riverpod 2
- **Backend:** Firebase Flutter SDK
- **Auth:** Firebase Auth (Google OAuth vía google_sign_in)
- **UI:** Material 3 + Google Fonts (Poppins)

---

## Estructura del Proyecto

```
carsigo-admin/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root layout (fuentes, metadatos)
│   ├── page.tsx                  # Landing page pública
│   ├── login/
│   │   ├── page.tsx              # Login (email/password + Google OAuth + recuperación)
│   │   └── actions.ts            # Server actions: login, resetPassword, signInWithGoogle
│   ├── auth/callback/route.ts    # OAuth callback — intercambia code por sesión
│   ├── reset-password/page.tsx   # Formulario de nueva contraseña
│   └── admin/
│       ├── layout.tsx            # Layout del panel (AuthProvider + Sidebar + Header)
│       ├── page.tsx              # Dashboard con métricas en tiempo real
│       ├── conductores/          # Gestión de conductores (aprobar, suspender)
│       │   ├── page.tsx
│       │   └── actions.ts
│       ├── viajes/page.tsx       # Historial de viajes
│       ├── zonas/                # Geocercas con Mapbox GL
│       │   ├── page.tsx
│       │   └── actions.ts
│       ├── finanzas/             # Liquidaciones, comisiones, estadísticas
│       │   ├── page.tsx
│       │   └── actions.ts
│       └── administradores/      # Gestión de admins (solo superadmin)
│           ├── page.tsx
│           └── actions.ts
├── components/
│   ├── Header.tsx                # Barra superior con nombre, rol, logout
│   ├── Sidebar.tsx               # Menú lateral con filtrado por rol
│   ├── DocumentModal.tsx         # Modal de documentos de conductor
│   ├── NewZoneModal.tsx          # Modal para crear geocercas
│   └── DrawControl.tsx           # Control de dibujo Mapbox GL
├── contexts/
│   ├── AuthContext.tsx           # Proveedor de autenticación (sesión + rol)
│   └── ToastContext.tsx          # Notificaciones toast
├── lib/
│   ├── auth.ts                   # Utilidades compartidas de autorización
│   ├── db.ts                     # Singleton Firebase para componentes cliente
│   ├── types.ts                  # Tipos compartidos (Driver, Zone)
│   ├── pdfGenerator.ts           # Generación de PDF de liquidaciones
│   └── firebase/
│       ├── client.ts             # Cliente Firebase browser
│       ├── server.ts             # Firebase SSR (cookies)
│       ├── service.ts            # Cliente Firebase admin (service account)
│       ├── admin-fs.ts           # Firestore admin (server actions)
│       ├── rest-auth.ts          # Auth admin via REST
│       └── firestore-compat.ts   # Capa de compatibilidad (API {data,error})
├── proxy.ts                      # Protección de rutas a nivel servidor
└── .env.local                    # Variables de entorno (NO COMMITEAR)

carsigo-mobile/
├── lib/
│   ├── main.dart                 # Entry point, inicialización Firebase
│   ├── models/user_profile.dart  # Modelo UserProfile
│   ├── providers/auth_provider.dart  # Riverpod providers de auth
│   ├── services/
│   │   ├── auth_service.dart     # Servicio de auth Firebase (Google, email, OTP)
│   │   └── firebase_service.dart # Inicialización de Firebase Flutter
│   └── screens/
│       ├── onboarding/           # Onboarding + Google Sign-In
│       ├── auth/                 # Login, OTP, selección de rol
│       ├── passenger/            # Home de pasajero
│       └── driver/               # Home de conductor
└── .env                          # Variables de entorno móvil (NO COMMITEAR)
```

---

## Arquitectura de Autenticación

### Flujo completo

```
┌─────────────────────────────────────────────────────────────┐
│ WEB ADMIN                                                   │
│                                                             │
│  /login  →  email/password  →  signInWithPassword           │
│          →  Google OAuth     →  signInWithPopup               │
│              → redirect Google → /auth/callback               │
│              → intercambia credenciales → /admin              │
│                                                             │
│  /reset-password  →  sendPasswordResetEmail (email link)     │
│                   →  /reset-password?token=...               │
│                   →  updatePassword({ password })            │
│                                                             │
│  proxy.ts:                                                   │
│    - Rutas públicas: /, /login, /auth/*, /reset-password    │
│    - Rutas protegidas: /admin/* → redirect /login si no auth │
│    - Si ya autenticado y va a /login → redirect /admin      │
│                                                             │
│  AuthContext:                                                │
│    - Al montar: getUser() → consulta rol en Firestore       │
│    - onAuthStateChanged: SIGNED_OUT → redirect /login        │
│    - Owner bypass: OWNER_EMAIL → rol 'superadmin'           │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ APP MÓVIL                                                   │
│                                                             │
│  Onboarding → Google Sign-In                                │
│    google_sign_in → idToken                                 │
│    FirebaseAuth -> GoogleAuthProvider → sesión               │
│                                                             │
│  Login → Email/Password → signInWithPassword                │
│       → Registro → createUser (email + password + nombre)   │
│                                                             │
│  Selección de rol → actualiza doc en users                  │
│                                                             │
│  AuthGate (main.dart):                                      │
│    - authStateChanges → si no hay sesión → Onboarding       │
│    - Si hay sesión → cargar perfil → Passenger o Driver     │
└─────────────────────────────────────────────────────────────┘
```

### Roles y permisos

| Rol | Acceso |
|-----|--------|
| `superadmin` | Dashboard, Conductores, Viajes, Zonas, Finanzas, Administradores |
| `admin` | Dashboard, Conductores, Viajes |
| `passenger` | App móvil — pantalla de pasajero |
| `driver` | App móvil — pantalla de conductor (requiere aprobación) |

### Owner bypass

El email definido en `OWNER_EMAIL` (.env.local) siempre recibe rol `superadmin`, sin necesidad de existir en la colección `users`. Esto garantiza que el dueño nunca pierda acceso.

### Mecanismo de autorización

- **Servidor (server actions):** `lib/auth.ts` exporta `checkIsAdmin()` y `checkIsSuperAdmin()`. Cada action file las importa y verifica antes de ejecutar operaciones.
- **Cliente (UI):** `AuthContext` expone `{ user, role, isLoading }`. El `Sidebar` filtra menú por rol. La página de Dashboard oculta widgets según rol.
- **Proxy:** `proxy.ts` bloquea acceso a `/admin/*` si no hay sesión.

---

## Base de Datos (Firestore)

### Colecciones principales

| Colección | Propósito |
|-----------|-----------|
| `users` | Perfiles de todos los usuarios (id, name, email, phone, role, status) |
| `driver_profiles` | Datos de conductor (vehicle_type, plate, status, total_rides, user_id) |
| `trips` | Viajes (passenger_id, driver_id, status, fare_amount, commission_amount, pickup/dropoff) |
| `geofences` | Geocercas (municipality_name, boundaries GeoJSON, is_active, base_multiplier) |
| `settlements` | Liquidaciones (total_amount, drivers_involved, volume_base, reference, status) |
| `wallets` | Billeteras de conductores (balance) |

### Reglas de seguridad

Configurar reglas en Firestore para que:
- Usuarios autenticados lean su propio perfil
- Admins lean/actualicen perfiles de otros
- Superadmins tengan acceso total

---

## Variables de Entorno

### Web Admin (`.env.local`)

| Variable | Descripción |
|----------|-------------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | API key pública del proyecto Firebase |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Dominio de auth (proyecto.firebaseapp.com) |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | ID del proyecto Firebase |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Bucket de Storage |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Sender ID de messaging |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | App ID web |
| `FIREBASE_SERVICE_ACCOUNT` | Ruta al JSON de service account (solo servidor, NUNCA exponer) |
| `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` | Token de Mapbox GL |
| `NEXT_PUBLIC_SITE_URL` | URL base del sitio (default: http://localhost:3000) |
| `OWNER_EMAIL` | Email del dueño con bypass de superadmin |

### App Móvil (`carsigo-mobile/.env`)

| Variable | Descripción |
|----------|-------------|
| `FIREBASE_API_KEY` | API key público de Firebase |
| `FIREBASE_APP_ID` | App ID de Firebase |
| `MAPBOX_ACCESS_TOKEN` | Token de Mapbox |
| `GOOGLE_WEB_CLIENT_ID` | Client ID OAuth de Google (web) |
| `GOOGLE_IOS_CLIENT_ID` | Client ID OAuth de Google (iOS) |

---

## Configuración Pendiente (Requisitos para QA/Producción)

### Firebase Console
1. **Authentication > Sign-in method > Google** — Habilitar con Client ID y Secret de Google Cloud
2. **Project settings > Your apps**:
   - Site URL: `http://localhost:3000` (dev) o URL de producción
   - Authorized domains: `localhost`, producción

### Google Cloud Console
1. Crear OAuth 2.0 Client ID tipo "Web application"
2. Authorized redirect URIs:
   - `http://localhost:3000/auth/callback`
   - URI de callback de Google Auth del proyecto Firebase
3. Para Android: verificar SHA-1 fingerprint registrado
4. Para iOS: configurar URL scheme

### Base de datos
1. Crear todas las colecciones listadas arriba en Firestore
2. Configurar reglas de seguridad
3. Crear primer admin insertando directamente en `users` con rol `superadmin`

---

## Comandos

```bash
# Web Admin
cd carsigo-admin
npm run dev        # Development server (localhost:3000)
npm run build      # Build de producción
npm run lint       # ESLint

# App Móvil
cd carsigo-mobile
flutter pub get    # Instalar dependencias
flutter run        # Ejecutar en dispositivo/emulador
flutter build apk  # Build Android
```

---

## Requisitos Funcionales

### Panel Admin
- [x] Login con email/password
- [x] Login con Google OAuth
- [x] Recuperación de contraseña
- [x] Protección de rutas con middleware
- [x] Roles: superadmin, admin
- [x] Dashboard con métricas en tiempo real (Firestore)
- [x] Gestión de conductores (aprobar, suspender, buscar)
- [x] Historial de viajes con filtros
- [x] Geocercas con Mapbox GL (crear, activar/desactivar, eliminar)
- [x] Finanzas: estadísticas, liquidaciones, exportación PDF
- [x] Gestión de administradores (solo superadmin)
- [ ] Notificaciones push/email para aprobación de conductores
- [ ] Exportación CSV de viajes y finanzas

### App Móvil
- [x] Onboarding con Google Sign-In
- [x] Login con email/password
- [x] Registro con email/password
- [x] Selección de rol (pasajero/conductor)
- [x] Home screen para pasajero
- [x] Home screen para conductor
- [ ] Solicitud de viajes
- [ ] Aceptación de viajes
- [ ] Tracking GPS en tiempo real
- [ ] Pagos integrados
- [ ] Chat pasajero-conductor

---

## Notas de Desarrollo

- **Nunca exponer `FIREBASE_SERVICE_ACCOUNT`** en el cliente. Solo se usa en server actions y `lib/firebase/service.ts`.
- **No modificar `OWNER_EMAIL`** a menos que cambie el dueño del proyecto.
- **El proxy.ts** valida las cookies de sesión de Firebase (SESSION_COOKIE, ROLE_COOKIE, STATUS_COOKIE) con `lib/firebase/server.ts`.
- **AuthContext** se monta solo dentro de `/admin/layout.tsx`. No está disponible en la landing page ni en el login.
- **Las server actions** usan el Admin SDK (`lib/firebase/service.ts`) para operaciones privilegiadas y devuelven `{data, error}`.
- **La app móvil** usa `google_sign_in` para obtener el ID token de Google y Firebase Auth para crear la sesión.
