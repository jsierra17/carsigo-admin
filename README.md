# CarSiGo

Monorepo de **CarSiGo**, plataforma de transporte hiperlocal de El Carmen de Bolívar (Bolívar, Colombia).

> ⚠️ **Este proyecto usa Vue 3, no Next.js.** Si vienes de una versión anterior del
> repo (Next.js 16 + React + Mapbox), todo eso ya no existe: el panel se migró a
> Vue 3 + Vite. Las reglas para asistentes de IA están en [`CLAUDE.md`](CLAUDE.md).

---

## Estructura

```
carsigo-admin/
├── apps/
│   ├── admin-web/          Panel de administración — Vue 3 + Vite + JavaScript
│   ├── admin-api/          API del panel — Express 4 (ESM) + firebase-admin
│   └── mobile/             App móvil — Flutter (pasajero + conductor)
├── functions/              Cloud Functions — TypeScript (expone la Admin API)
├── firebase/               Reglas e índices de Firebase
│   ├── firestore.rules
│   ├── storage.rules
│   └── firestore.indexes.json
├── scripts/                16 scripts de utilidad (deploy, auditoría, tests)
├── docs/                   DEPLOY.md · SECURITY.md · CHECKLIST-HARDENING.md
├── tests/                  firestore-rules.test.mjs
├── package.json            Raíz con npm workspaces
├── firebase.json           Configuración del CLI de Firebase (RAÍZ)
└── README.md
```

> `packages/` se reservará para `shared-types` (pendiente).
>
> `firebase.json` vive en la **raíz** porque el CLI de Firebase resuelve las
> rutas de `hosting.public` y `functions.source` relativas a la carpeta del
> config y **rechaza rutas fuera de ella** (`is outside of project directory`).
> Las reglas y los índices sí están agrupados en `firebase/`.
> **No hay** `firebase.prod.json` ni `firebase.local.json`: hay un único config.

---

## Stack

| Capa | Tecnología | Para qué |
|---|---|---|
| **Panel admin** | **Vue 3.5** (SFC, `<script setup>`) | Interfaz del panel de administración |
| | **Vite 6** | Bundler y dev server (HMR, proxy a la API) |
| | **TailwindCSS 4** (`@tailwindcss/vite`) | Estilos utility-first con tokens de marca |
| | **Pinia 2** | Estado global (sesión, roles, perfil) |
| | **Vue Router 4** | Enrutamiento SPA con guarda de autenticación |
| | **Firebase Web SDK 12** | Auth, Firestore, Storage desde el navegador |
| | **@googlemaps/js-api-loader 1.16** | Google Maps JS API (mapa de zonas) |
| | **lucide-vue-next** | Iconografía |
| | **jsPDF + autotable** | Reportes PDF |
| | **JavaScript puro + JSDoc** | Sin TypeScript en el panel |
| **API** | **Express 4** (ESM) | Servidor HTTP de la Admin API |
| | **firebase-admin 13** | Acceso privilegiado a Firestore / Auth / Storage |
| | **cors** · **dotenv** | CORS y configuración por entorno |
| | **JavaScript puro** | Sin TypeScript; consultas nativas `db.collection().where()` |
| **Functions** | **firebase-functions 7** (2ª gen) | Despliegue de la Admin API como función HTTP |
| | **TypeScript 6** | Único piece del proyecto que mantiene TypeScript |
| **App móvil** | **Flutter 3.10 / Dart** | App de pasajero y conductor (Android/iOS) |
| | **Riverpod 2** | Estado de la app |
| | **google_maps_flutter 2.18** | Mapa, marcadores y puck de ubicación |
| | **geolocator 13** | GPS del dispositivo |
| | **Google Places / Directions / Geocoding** | Búsqueda, rutas y reverse geocoding |
| | **Firebase SDK (Flutter)** | Auth, Firestore, Storage, Messaging, App Check |
| **Backend** | **Firestore** (`southamerica-east1`) | Base de datos (11 colecciones) |
| | **Firebase Auth** | Email/contraseña + Google OAuth + custom claims |
| | **Firebase Storage** | Documentos del conductor (Cédula, SOAT, licencia…) |
| | **Firebase Messaging** | Notificaciones push |
| **Infraestructura** | **Firebase Hosting** | Sirve el panel (SPA + rewrite) |
| | **Cloud Functions / Cloud Run** | Backend HTTP de la Admin API |
| | **Artifact Registry** | Imágenes de las Functions |
| **Tooling** | **npm workspaces** | Monorepo (`apps/*`) |
| | **ESLint 9** (flat config) · **TypeScript 5** | Lint y tipos (solo `functions/`) |
| | **Vite 6** · **Playwright** | Build y pruebas en navegador real |
| | **@turf/turf 7** | Geometría geospatial (buffers, unión de polígonos) |
| | **Google Cloud CLI** | Gestión de Cloud Run / Functions / IAM |

---

## Puesta en marcha

### Requisitos
- Node.js ≥ 20
- Flutter 3.10+ (para `apps/mobile`)
- Una service account de Firebase (ruta en `FIREBASE_SERVICE_ACCOUNT`)

### 1. Instalar dependencias
```bash
npm install
```
> `functions/` mantiene su propio `package.json` y `package-lock.json` (no es workspace).
> Instálalo aparte si vas a desplegarlo: `npm install --prefix functions`.

### 2. Configurar variables de entorno
Hay **tres** ficheros, todos en la **raíz** del monorepo:

| Fichero | Para qué | ¿Versionado? |
|---|---|---|
| `.env` | Desarrollo local | ❌ (ignorado por git) |
| `.env.production` | Producción | ❌ (ignorado por git) |
| `.env.example` | Plantilla de las 11 variables | ✅ |

```bash
# .env (raíz) — desarrollo
cp .env.example .env
```
Variables (todas en la raíz):

| Variable | Consumida por | Descripción |
|---|---|---|
| `VITE_FIREBASE_API_KEY` | navegador | API key pública de Firebase |
| `VITE_FIREBASE_AUTH_DOMAIN` | navegador | `proyecto.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | navegador + servidor | ID del proyecto |
| `VITE_FIREBASE_STORAGE_BUCKET` | navegador | Bucket de Storage |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | navegador | Sender ID de Messaging |
| `VITE_FIREBASE_APP_ID` | navegador | App ID web |
| `VITE_GOOGLE_MAPS_KEY` | navegador | Google Maps JavaScript API |
| `VITE_RECAPTCHA_SITE_KEY` | navegador | reCAPTCHA v3 para App Check |
| `VITE_SITE_URL` | navegador | URL base del sitio (`http://localhost:5173`) |
| `OWNER_EMAIL` | servidor | Email con bypass de `superadmin` |
| `FIREBASE_SERVICE_ACCOUNT` | servidor | Ruta al JSON de la service account |

> **Prefijos**: el navegador solo ve variables `VITE_` (`vite.config.js` →
> `envPrefix: ['VITE_']`). El servidor usa variables **sin prefijo**.
> `FIREBASE_SERVICE_ACCOUNT` es **solo de servidor**: nunca la expongas al bundle.

La app móvil tiene su propio `.env` en `apps/mobile/` (`GOOGLE_WEB_SERVICES_KEY`,
`GOOGLE_WEB_SERVICES_KEY_IOS`, `GOOGLE_WEB_CLIENT_ID`, `GOOGLE_IOS_CLIENT_ID`).

### 3. Levantar
```bash
npm run dev        # panel Vue  → http://localhost:5173
npm run dev:api    # API Express → http://localhost:4000
```

El dev server de Vite hace **proxy** de `/api` → `http://localhost:4000`, así que no hay CORS en desarrollo.

---

## Comandos

| Comando | Descripción |
|---|---|
| `npm run dev` | Panel Vue en modo desarrollo (puerto **5173**) |
| `npm run dev:api` | API Express con recarga automática (`node --watch`) |
| `npm run build` | Build de producción del panel → `apps/admin-web/dist` |
| `npm run preview` | Sirve el build de producción (puerto 4173) |
| `npm run start:api` | API en modo producción |
| `npm run test:api` | Pruebas de humo + autorización de la API (18 + 8 checks) |
| `npm run test:ui` | Prueba del panel en un navegador real (13 checks) |
| `npm run test:hosting` | Prueba de la config de Hosting (9 checks) |
| `npm run test` | Todas las pruebas (**48 checks**) |
| `npm run lint` | Lint de todos los workspaces |
| `npm run geofence` | Genera la geofence (ver `scripts/`) |
| `npm run build:web` | Build de producción del panel |
| `npm run preview:hosting` | Simulador local de Firebase Hosting |
| `npm run prepare:functions` | Copia `apps/admin-api/src` → `functions/api-src` |
| `npm run deploy:rules` | Deploy de `firestore.rules` + índices |
| `npm run deploy:prod` | **Producción** (exige confirmación) — build + deploy completo |
| `npm run deploy:prod:hosting` | **Producción** — solo el panel |
| `npm run deploy:prod:functions` | **Producción** — solo las Functions |
| `npm run prod:enable:apis` | Habilita run/cloudbuild/artifactregistry (solo 1 vez) |
| `npm run quarantine:hosting` | Despublica el Hosting |

> No existen `deploy`, `deploy:hosting` ni `deploy:functions` a secas: se eliminaron
> a propósito para que nadie publique por error. Usa los `deploy:prod*`, que
> exigen `CONFIRM_PROD=1` (ver `scripts/confirm-prod.js`).

---

## API — endpoints

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/health` | Sonda de salud (público) |
| `POST` | `/api/pricing/estimate` | Tarifa autoritativa (base + hora + km + anillos + reglas dinámicas) |
| `GET` | `/api/drivers/nearby` | Conductores activos dentro del radio |
| `GET`/`POST` | `/api/trips` | Listar / crear viajes |
| `GET`/`PATCH` | `/api/trips/:id` | Detalle / actualizar estado |
| `POST` | `/api/zones/check` | ¿El punto está en zona de servicio? |
| `POST` | `/api/admin/users/:uid/role` 🔒 | Asignar rol (requiere `superadmin`) |
| `GET` | `/api/admin/users/:uid` 🔒 | Ver usuario (Auth + Firestore) |

🔒 Requiere `Authorization: Bearer <idToken>` con el custom claim `role`.

Detalle completo en [`apps/admin-api/README.md`](apps/admin-api/README.md).

---

## Autenticación del panel

El login se resuelve **en el cliente** con el Firebase Web SDK:
- `signInWithPopup` (Google) o `signInWithEmailAndPassword`.
- El panel obtiene el ID token y lo envía a la API como `Authorization: Bearer <idToken>`.
- El rol vive en los **custom claims** (`decodedToken.role`) y se refleja en `users/{uid}.role`.

Cambiar un rol: `POST /api/admin/users/:uid/role` (solo `superadmin`).
Tras un cambio de rol, el usuario debe renovar su token (`getIdToken(true)`).

---

## Modelo de datos (Firestore)

| Colección | Contenido |
|---|---|
| `users` | Perfiles (pasajero, conductor, admin). Campo `role` |
| `driver_profiles` | Estado del conductor (`is_available`, `status`, `vehicle_type`, `plate`) |
| `driver_applications` | Solicitudes de conductor + documentos |
| `trips` | Viajes (con `pickup_location`/`dropoff_location` como GeoPoint) |
| `trip_fare_breakdown` | Desglose de tarifa por viaje |
| `geofences` | Zonas: `boundary`, `boundaries` (GeoJSON), `urban_polygons`, `rings`, `slug` |
| `rate_cards` | Tarifas base: `minimum_fare`, `included_km`, tiers de km, comisión |
| `rate_schedules` | Turnos: `base_fee`, `hourly_increase_percent`, `day_type` |
| `dynamic_pricing_rules` | Multiplicadores por fecha/día/hora |
| `wallets` / `settlements` | Saldos y liquidaciones |

---

## Seguridad

- `firebase/firestore.rules` y `firebase/storage.rules` controlan el acceso del cliente.
- La API usa el Admin SDK (privilegiado) → **ignora las rules**. Valida explícitamente
  los roles de los custom claims en cada endpoint sensible.
- El panel nunca habla con Firestore usando credenciales privilegiadas: usa el
  Web SDK del usuario, que sí respeta las rules.
- **App Check** (reCAPTCHA v3 en web, Play Integrity / DeviceCheck en móvil) evita
  que una API Key filtrada se use desde apps illegitimate.
- Detalle: [`docs/SECURITY.md`](docs/SECURITY.md) y
  [`docs/CHECKLIST-HARDENING.md`](docs/CHECKLIST-HARDENING.md).

---

## Firebase CLI

Hay **un solo** `firebase.json`, en la **raíz**. Ejecuta los comandos desde ahí:

```bash
firebase deploy --only firestore:rules,firestore:indexes
firebase deploy --only storage
firebase deploy --only functions
firebase emulators:start
```

---

## 🚀 Despliegue

Arquitectura en producción:

```
Navegador ──▶ Firebase Hosting ──┬── /assets/** ──▶ estáticos (cache inmutable)
   https://                        └── /api/**  ──▶ Cloud Function `adminApi`
   carsigo-9e508.web.app                    (apps/admin-api → functions/api-src)
                    │
                    └── /**  ──▶ /index.html  (fallback SPA)

App móvil (Flutter) ──▶ Firebase Auth / Firestore / Storage / Messaging
```

> ⚠️ **Estado actual del proyecto: Hosting despublicado y 0 Functions desplegadas.**
> El panel corre **solo en local**. Antes de volver a producción, revisa
> [`docs/CHECKLIST-HARDENING.md`](docs/CHECKLIST-HARDENING.md) (presupuesto, spend
> cap y App Check) y luego usa `npm run deploy:prod`.

### Comandos
```bash
npm run deploy:prod            # build del panel + Functions + deploy (pide confirmación)
npm run deploy:prod:hosting    # solo el panel
npm run deploy:prod:functions  # solo las Functions
npm run deploy:rules           # firestore.rules + índices + storage.rules
npm run prod:enable:apis       # habilita run/cloudbuild/artifactregistry (solo 1 vez)
```

### Verificar
```bash
curl https://carsigo-9e508.web.app/                                    # panel
curl https://carsigo-9e508.web.app/api/health                           # API
curl -X POST https://carsigo-9e508.web.app/api/pricing/estimate \
  -H "Content-Type: application/json" \
  -d '{"vehicle_type":"car","distance_km":8,"zone_id":"el-carmen-de-bolivar"}'
```

### Probar la config SIN desplegar
```bash
npm run preview:hosting    # simula Hosting localmente (estáticos + rewrite SPA + proxy /api)
npm run test:hosting       # 9 checks en navegador real
```

Guía completa (Cloud Run, CORS, dominios personalizados, VPS alternativo):
**[`docs/DEPLOY.md`](docs/DEPLOY.md)**

---

## Documentación

- [`CLAUDE.md`](CLAUDE.md) — instrucciones para asistentes de IA (prohibiciones y arquitectura)
- [`AGENTS.md`](AGENTS.md) — contexto mínimo de Firebase para agentes
- [`apps/admin-api/README.md`](apps/admin-api/README.md) — endpoints y auth de la API
- [`docs/DEPLOY.md`](docs/DEPLOY.md) — guía de despliegue
- [`docs/SECURITY.md`](docs/SECURITY.md) — reglas, roles y superficie de ataque
- [`docs/CHECKLIST-HARDENING.md`](docs/CHECKLIST-HARDENING.md) — blindaje de coste
- [`scripts/README.md`](scripts/README.md) — utilidades de línea de comandos

---

## Panel admin — estructura

```
apps/admin-web/src/
├── main.js                  # bootstrap (Pinia + Router + initAppCheck)
├── App.vue
├── style.css                # Tailwind 4 + tokens de marca
├── router/index.js          # rutas + guarda de autenticación
├── stores/auth.js           # store Pinia (login, perfil, roles)
├── services/
│   ├── firebase.js          # Firebase Web SDK
│   ├── app-check.js         # App Check (reCAPTCHA v3)
│   ├── api.js               # cliente HTTP (Bearer token) + endpoints
│   ├── data.js              # servicios de dominio (CRUD con el Web SDK)
│   ├── firestore.js         # helpers de Firestore (queries, CRUD, batch)
│   └── google-maps.js       # carga la Maps JS API + conversión GeoJSON
├── composables/             # useAsyncData.js, useToast.js
├── components/
│   ├── ZoneMap.vue          # mapa de zonas con Google Maps
│   └── ui/                  # Badge, ConfirmDialog, DataTable, FormField, Modal, StatCard, ToastContainer
├── layouts/AdminLayout.vue  # sidebar + header
├── lib/                     # mock-data.js, pdf-generator.js, types.js
└── views/                   # Dashboard, Zonas, Tarifas, PrecioDinamico,
                              # Conductores, Solicitudes, Viajes, Finanzas,
                              # Administradores, Login, NotFound
```

### Acceso a datos
- **CRUD de gestión** (tarifas, turnos, reglas de precio, zonas, solicitudes,
  conductores) → **directo contra Firestore** con el Web SDK del usuario.
  Las `firestore.rules` lo permiten a quien tenga rol `admin`/`superadmin`.
- **Solo lo que necesita lógica de servidor** va por la API: la tarifa
  autoritativa (`/api/pricing/estimate`) y la gestión de roles
  (`/api/admin/users/:uid/role`, que valida el custom claim `superadmin`).
