# CarSiGo — Documentación del Proyecto

## Resumen

CarSiGo es una plataforma de movilidad hiperlocal para Colombia. Consta de dos aplicaciones:

| App | Stack | Propósito |
|-----|-------|-----------|
| **carsigo-admin** | Next.js 16 + Supabase | Panel web de administración |
| **carsigo-mobile** | Flutter 3 + Supabase | App móvil para pasajeros y conductores |

---

## Stack Tecnológico

### Web Admin (`carsigo-admin/`)
- **Framework:** Next.js 16 (App Router)
- **Lenguaje:** TypeScript 5
- **Estilos:** Tailwind CSS 4
- **Backend:** Supabase (PostgreSQL + Auth + Realtime)
- **Mapas:** Mapbox GL JS + react-map-gl
- **PDFs:** jsPDF + jspdf-autotable
- **Iconos:** Lucide React

### App Móvil (`carsigo-mobile/`)
- **Framework:** Flutter 3.10+
- **Lenguaje:** Dart
- **Estado:** Riverpod 2
- **Backend:** Supabase Flutter SDK
- **Auth:** Supabase Auth (Google OAuth vía google_sign_in)
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
│   ├── supabase.ts               # Helpers de datos (dashboard metrics, etc.)
│   ├── types.ts                  # Tipos compartidos (Driver, Zone)
│   ├── pdfGenerator.ts           # Generación de PDF de liquidaciones
│   └── supabase/
│       ├── client.ts             # Cliente Supabase browser (anon key)
│       ├── server.ts             # Cliente Supabase SSR (cookies)
│       └── service.ts            # Cliente Supabase admin (service_role key)
├── middleware.ts                 # Protección de rutas a nivel servidor
└── .env.local                    # Variables de entorno (NO COMMITEAR)

carsigo-mobile/
├── lib/
│   ├── main.dart                 # Entry point, inicialización Supabase
│   ├── models/user_profile.dart  # Modelo UserProfile
│   ├── providers/auth_provider.dart  # Riverpod providers de auth
│   ├── services/
│   │   ├── auth_service.dart     # Servicio de auth Supabase (Google, email, OTP)
│   │   └── supabase_service.dart # Inicialización de Supabase Flutter
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
│          →  Google OAuth     →  signInWithOAuth              │
│              → redirect Google → /auth/callback              │
│              → exchangeCodeForSession → /admin               │
│                                                             │
│  /reset-password  →  resetPasswordForEmail (email link)     │
│                   →  /reset-password?token=...               │
│                   →  updateUser({ password })                │
│                                                             │
│  middleware.ts:                                              │
│    - Rutas públicas: /, /login, /auth/*, /reset-password    │
│    - Rutas protegidas: /admin/* → redirect /login si no auth │
│    - Si ya autenticado y va a /login → redirect /admin      │
│                                                             │
│  AuthContext:                                                │
│    - Al montar: getUser() → consulta rol en DB              │
│    - onAuthStateChange: SIGNED_OUT → redirect /login        │
│                        TOKEN_REFRESHED → refresca sesión    │
│    - Owner bypass: OWNER_EMAIL → rol 'superadmin'           │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ APP MÓVIL                                                   │
│                                                             │
│  Onboarding → Google Sign-In                                │
│    google_sign_in → idToken                                 │
│    supabase.auth.signInWithIdToken(google, idToken)         │
│                                                             │
│  Login → Email/Password → signInWithPassword                │
│       → Registro → signUp (email + password + nombre)       │
│                                                             │
│  Selección de rol → upsert en public.users                  │
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

El email definido en `OWNER_EMAIL` (.env.local) siempre recibe rol `superadmin`, sin necesidad de existir en la tabla `public.users`. Esto garantiza que el dueño nunca pierda acceso.

### Mecanismo de autorización

- **Servidor (server actions):** `lib/auth.ts` exporta `checkIsAdmin()` y `checkIsSuperAdmin()`. Cada action file las importa y verifica antes de ejecutar operaciones.
- **Cliente (UI):** `AuthContext` expone `{ user, role, isLoading }`. El `Sidebar` filtra menú por rol. La página de Dashboard oculta widgets según rol.
- **Middleware:** `middleware.ts` bloquea acceso a `/admin/*` si no hay sesión.

---

## Base de Datos (Supabase)

### Tablas principales

| Tabla | Propósito |
|-------|-----------|
| `public.users` | Perfiles de todos los usuarios (id, name, email, phone, role, status) |
| `public.driver_profiles` | Datos de conductor (vehicle_type, plate, status, total_rides, user_id FK) |
| `public.trips` | Viajes (passenger_id, driver_id, status, fare_amount, commission_amount, pickup/dropoff) |
| `public.geofences` | Geocercas (municipality_name, boundaries GeoJSON, is_active, base_multiplier) |
| `public.settlements` | Liquidaciones (total_amount, drivers_involved, volume_base, reference, status) |
| `public.wallets` | Billeteras de conductores (balance) |

### RLS (Row Level Security)

Las tablas deben tener políticas RLS configuradas en Supabase para que:
- Usuarios autenticados lean su propio perfil
- Admins lean/actualicen perfiles de otros
- Superadmins tengan acceso total

---

## Variables de Entorno

### Web Admin (`.env.local`)

| Variable | Descripción |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave anónima/pública de Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave service_role (solo servidor, NUNCA exponer) |
| `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` | Token de Mapbox GL |
| `NEXT_PUBLIC_SITE_URL` | URL base del sitio (default: http://localhost:3000) |
| `OWNER_EMAIL` | Email del dueño con bypass de superadmin |

### App Móvil (`carsigo-mobile/.env`)

| Variable | Descripción |
|----------|-------------|
| `SUPABASE_URL` | URL del proyecto Supabase |
| `SUPABASE_ANON_KEY` | Clave anónima de Supabase |
| `MAPBOX_ACCESS_TOKEN` | Token de Mapbox |
| `GOOGLE_WEB_CLIENT_ID` | Client ID OAuth de Google (web) |
| `GOOGLE_IOS_CLIENT_ID` | Client ID OAuth de Google (iOS) |

---

## Configuración Pendiente (Requisitos para QA/Producción)

### Supabase Dashboard
1. **Authentication > Providers > Google** — Habilitar con Client ID y Secret de Google Cloud
2. **Authentication > URL Configuration**:
   - Site URL: `http://localhost:3000` (dev) o URL de producción
   - Redirect URLs: `http://localhost:3000/auth/callback`, `https://TU_PROYECTO.supabase.co/auth/v1/callback`

### Google Cloud Console
1. Crear OAuth 2.0 Client ID tipo "Web application"
2. Authorized redirect URIs:
   - `http://localhost:3000/auth/callback`
   - `https://gyfbazbvrgmwtwkkswdy.supabase.co/auth/v1/callback`
3. Para Android: verificar SHA-1 fingerprint registrado
4. Para iOS: configurar URL scheme

### Base de datos
1. Crear todas las tablas listadas arriba en `public`
2. Configurar políticas RLS
3. Crear primer admin insertando directamente en `public.users` con rol `superadmin`

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
- [x] Dashboard con métricas en tiempo real (Supabase Realtime)
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

- **Nunca exponer `SUPABASE_SERVICE_ROLE_KEY`** en el cliente. Solo se usa en server actions y `lib/supabase/service.ts`.
- **No modificar `OWNER_EMAIL`** a menos que cambie el dueño del proyecto.
- **El middleware** usa `createServerClient` de `@supabase/ssr` con las cookies del request. No usar `createClient` del browser en el middleware.
- **AuthContext** se monta solo dentro de `/admin/layout.tsx`. No está disponible en la landing page ni en el login.
- **La app móvil** usa `google_sign_in` para obtener el ID token de Google, luego `supabase.auth.signInWithIdToken` para crear la sesión de Supabase. No usa Firebase para nada.
