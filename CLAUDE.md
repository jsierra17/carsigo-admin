# CarSiGo — Instrucciones para asistentes de IA

> Este documento es la fuente de verdad para cualquier IA que trabaje en este repositorio.
> Si una instrucción aquí contradice a un README, a un comentario en el código o a tu
> memoria previa sobre este proyecto, **gana este documento**.

---

## ⛔ PROHIBICIONES ABSOLUTAS

Este proyecto **ya no usa Next.js, React ni Mapbox**. Son restos de una versión
anterior del panel y **no deben volver a aparecer**.

| ❌ Prohibido | ✅ Correcto |
|---|---|
| React, JSX, `useState`, `useEffect`, `next/link`, `next/navigation`, `next/headers`, `next/cache` | Vue 3 Composition API (`ref`, `computed`, `watch`, `onMounted`), `vue-router` |
| Next.js (`app/`, `page.tsx`, `layout.tsx`, `route.ts`, `middleware.ts`, `proxy.ts`, server actions) | Vite + Vue Router SPA en `apps/admin-web` |
| `NEXT_PUBLIC_*` (prefijo de Next.js) | `VITE_*` para el navegador; sin prefijo para el servidor (`FIREBASE_API_KEY`) |
| Mapbox, `mapbox-gl`, `react-map-gl`, `mapbox_maps_flutter`, `MAPBOX_ACCESS_TOKEN` | Google Maps: `@googlemaps/js-api-loader` (web) y `google_maps_flutter` (móvil) |
| Supabase, `supabase_flutter`, PostgreSQL/PostGIS | Firebase: Firestore + Firebase Auth + Storage + Messaging |
| TypeScript en el panel o en la API | JavaScript puro (JSDoc). Solo `functions/` usa TypeScript |
| `lucide-react` | `lucide-vue-next` |
| Tests con Vitest/Jest en el panel | Scripts Node propios (`scripts/ui-smoke-test.js`) + Playwright |

Si encuentras código con estas características, **es código muerto**: bórralo
(no lo "adaptes").

---

## 📐 Arquitectura real

Monorepo con **npm workspaces**. Cada piece habla con su Runtime y con un
proyecto de Firebase compartido.

```
carsigo-admin/
├── apps/
│   ├── admin-web/       Panel de administración — Vue 3 + Vite + JavaScript
│   ├── admin-api/       API del panel — Express 4 (ESM) + firebase-admin
│   └── mobile/          App de pasajero y conductor — Flutter (Android/iOS)
├── functions/           Cloud Functions (TypeScript) — copia de apps/admin-api/src
├── firebase/            firestore.rules · storage.rules · firestore.indexes.json
├── scripts/             Utilidades de CLI (16 scripts)
├── docs/                DEPLOY.md · SECURITY.md · CHECKLIST-HARDENING.md
├── firebase.json        Config ÚNICA del CLI de Firebase (raíz)
└── package.json         Raíz con workspaces y scripts
```

### `apps/admin-web` — Panel (Vue 3 + Vite)

- **JavaScript puro**, sin TypeScript. Tipos documentados con JSDoc.
- **Composition API** con `<script setup>` en todos los SFC.
- Estado global: **Pinia** (`stores/auth.js`).
- Enrutado: **Vue Router 4** (`router/index.js`) con guarda de autenticación.
- Estilos: **TailwindCSS 4** vía `@tailwindcss/vite`.
- **Vite expone `import.meta.env` solo con el prefijo `VITE_`**
  (`vite.config.js` → `envPrefix: ['VITE_']`). Cualquier otra variable no existe
  en el navegador.
- `vite.config.js` fija `envDir` a la **raíz del monorepo**: el `.env` vive en la raíz.

```
apps/admin-web/src/
├── main.js                  # bootstrap: Pinia + Router + initAppCheck()
├── App.vue
├── style.css                # Tailwind 4 + tokens de marca
├── router/index.js          # rutas + guarda de autenticación
├── stores/auth.js           # store Pinia (login, perfil, roles)
├── services/
│   ├── firebase.js          # Firebase Web SDK (config desde import.meta.env)
│   ├── app-check.js         # App Check con reCAPTCHA v3
│   ├── api.js               # cliente HTTP (Bearer token) + endpoints
│   ├── data.js              # CRUD de dominio contra Firestore (Web SDK)
│   ├── firestore.js         # helpers de queries, CRUD y batch
│   └── google-maps.js       # carga la Maps JS API + conversión GeoJSON
├── composables/             # useAsyncData.js, useToast.js
├── components/
│   ├── ZoneMap.vue          # mapa de zonas con Google Maps
│   └── ui/                  # Badge, ConfirmDialog, DataTable, FormField, Modal, StatCard, ToastContainer
├── layouts/AdminLayout.vue  # sidebar + header
├── lib/                     # mock-data.js, pdf-generator.js, types.js
└── views/                   # 12 vistas (Dashboard, Zonas, Tarifas, PrecioDinamico,
                               # Conductores, Solicitudes, Viajes, Finanzas,
                               # Administradores, Login, NotFound)
```

### `apps/admin-api` — API (Express 4, ESM)

- **JavaScript puro** con módulos ESM (`"type": "module"`).
- **firebase-admin** (SDK privilegiado) → **ignora las `firestore.rules`**.
  La API valida los roles de los custom claims **explícitamente** en cada
  endpoint sensible. No añadas endpoints que confíen en las rules.
- Middleware: `auth.js` (`requireAuth`, `requireAdmin`, `requireSuperAdmin`),
  `rate-limit.js`, `error-handler.js`.
- Configuración: `src/config.js` (lee `.env` de la raíz del monorepo).
- Rutas en `src/routes/`: `trips.js`, `drivers.js`, `zones.js`, `pricing.js`, `admin.js`.

### `apps/mobile` — App móvil (Flutter)

- **Dart** con **Riverpod** para el estado.
- **Firebase**: `firebase_core`, `firebase_auth`, `cloud_firestore`,
  `firebase_storage`, `firebase_messaging`, `firebase_app_check`.
- **Mapas: `google_maps_flutter`** (Google Maps SDK) + `geolocator` para el GPS.
- Servicios externos: **Google Places / Directions / Geocoding** vía REST.
- Config: `lib/firebase_options.dart` (generada por FlutterFire CLI).

### `functions/` — Cloud Functions

- **TypeScript** (única piece del proyecto que lo usa).
- `functions/api-src/` es una **copia generada** de `apps/admin-api/src`:
  no la edites a mano, se regenera con `npm run prepare:functions`.
- Se despliega como función HTTP `adminApi`.

---

## 🔐 Seguridad (reglas invariables)

1. **Nunca** expongas credenciales privilegiadas al navegador.
   `FIREBASE_SERVICE_ACCOUNT` es solo de servidor.
2. **Nunca** confíes en las `firestore.rules` para proteger datos dentro de la
   API: el Admin SDK las ignora. Valida `role` (custom claim) explícitamente.
3. El panel usa el **Web SDK** con las reglas del usuario → respeta las rules.
4. **App Check** debe inicializarse antes de la primera llamada a Firebase
   (`main.js` → `initAppCheck()`; móvil → `AppCheckService.initialize()`).
5. Las API Keys de Google están **ancladas por plataforma** (referrer / package +
   SHA-1 / bundle-id) y con `apiTargets` acotados. No las amplíes sin motivo.
6. No reintroduzcas `firebase.prod.json` ni `firebase.local.json`: hay **un solo**
   `firebase.json` en la raíz.

---

## 🧾 Convenciones

- **Idioma**: comentarios y documentación en **español**.
- **Encoding**: siempre UTF-8. **Nunca** uses `Set-Content`/`Out-File` de
  PowerShell sobre ficheros de texto (añade BOM y rompe el build). Usa el editor
  del agente o `fs.writeFileSync(f, contenido, 'utf8')` de Node.
- **Antes de dar por terminado** un cambio, ejecuta:
  ```bash
  npm test          # 48 comprobaciones (18 API + 8 roles + 13 UI + 9 hosting)
  npm run build     # build de producción del panel
  node scripts/check-local-mode.js
  ```
- Si tocas el panel, ejecuta además `npm run test:ui` (abre un navegador real).
- Si tocas la API, `npm run test:api`.

---

## 📚 Documentos relacionados

| Documento | Contenido |
|---|---|
| [`README.md`](README.md) | Estructura, stack, comandos y despliegue |
| [`docs/DEPLOY.md`](docs/DEPLOY.md) | Guía de despliegue (Hosting, Functions, CORS) |
| [`docs/SECURITY.md`](docs/SECURITY.md) | Reglas, roles y superficie de ataque |
| [`docs/CHECKLIST-HARDENING.md`](docs/CHECKLIST-HARDENING.md) | Blindaje de coste (API Keys, presupuesto, cuotas) |
| [`scripts/README.md`](scripts/README.md) | Utilidades de línea de comandos |
| [`AGENTS.md`](AGENTS.md) | Contexto mínimo para agentes (Firebase) |

## 🔧 Codebase Memory MCP

El proyecto usa **codebase-memory-mcp** (configurado en `opencode.jsonc`) como
grafo de conocimiento del código. Úsalo en lugar de búsquedas manuales:

- `index_repository` — (re)construir el grafo. Ejecútalo cuando cambien ficheros.
- `search_graph` — buscar nodos por nombre y etiqueta.
- `trace_path` — trazar cadenas de llamadas.
- `get_architecture` — vista general del proyecto.
- `search_code` — búsqueda semántica.
- `query_graph` — consultas Cypher.
- `get_code_snippet` — fuente completa de un nodo.
- `detect_changes` — qué cambió desde el último indexado.

Empieza con `get_architecture(aspects=['all'])` y luego baja al detalle con
`search_graph` o `trace_path`.
