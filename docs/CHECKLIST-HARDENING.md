# Blindaje de coste — Checklist final

**Proyecto:** `carsigo-9e508` (nº `621288515186`) · **Plan:** Blaze
**Billing:** `01C068-04B52A-074CB9` — ⚠️ **moneda COP**, no USD
**Objetivo:** estado "uso local/dev, coste $0 garantizado"
**Fecha:** 2026-11-06

---

## ✅ Hecho por OpenCode

### Auditoría (solo lectura)
- Inventario completo de **8 API Keys** con sus restricciones reales.
- **57 APIs habilitadas** revisadas: **cero APIs de IA** (Gemini/Vertex/Veo ya deshabilitadas).
- Recursos vivos: **0 Functions, 0 Cloud Run, 0 BigQuery, 0 Cloud SQL, 0 Pub/Sub,
  0 App Engine, 0 Artifact Registry, 0 Eventarc**.
- Firestore `(default)` en `southamerica-east1`, **Standard + freeTier activo**, 47 docs intactos.
- Storage de Firebase **no aprovisionado** (0 coste).
- Cuotas reales de Firestore leídas: 50k lecturas/día, 20k escrituras/día (fijas, free tier).

### Endurecimiento aplicado en el proyecto
| Qué | Detalle |
|---|---|
| **8 API Keys restringidas** | Cada clave anclada a su plataforma (referrer / package+SHA-1 / bundle-id) **y** con `apiTargets` acotados |
| **Clave Web Services iOS creada** | `AIzaSyC775YVZ77wH9IUTpHFzIIPxed0jKdheuc` — obligatoria: `client_restrictions` es un *oneof*, Android e iOS no pueden coexistir |
| **`firebaseappcheck.googleapis.com` habilitada** | Sin ella el intercambio de token de App Check devolvía 403 |
| **`firebaseappcheck.googleapis.com` añadida al allowlist** | Las claves del SDK de Firebase usan la allowlist oficial completa (20 APIs) |
| **Presupuesto corregido** | `CarSiGo` = **64 900 COP (≈ 20 USD)** con umbrales 50 / 90 / 100 % + 90 % previsto |
| **Alertas configuradas** | Canal de Monitoring `7144749836685317017` → `todoobraparabien1998@gmail.com` |

### Verificación empírica (llamadas reales a cada API con cada clave)
```
iOS key (auto)    IdentityToolkit OK · SecureToken OK · Firestore OK · Storage OK · AppCheck OK
Android key (auto) IdentityToolkit OK · SecureToken OK · Firestore OK · Storage OK · AppCheck OK
Browser key (auto) IdentityToolkit OK · SecureToken OK · Firestore OK · Storage OK · AppCheck OK
WS Android        Places OK · Geocode OK · Directions OK · (Auth bloqueada: correcto)
WS iOS            Places OK · Geocode OK · Directions OK · (Auth bloqueada: correcto)
Maps Android      Maps SDK OK · Places OK · (Auth bloqueada: correcto)
```
Cada clave **solo** responde a las APIs que su app usa. Una clave robada no alcanza
ninguna API de pago ni de IA.

### Código (App Check)
- `apps/admin-web/src/services/app-check.js` — reCAPTCHA v3, se activa antes del primer uso de Firebase.
- `apps/admin-web/src/main.js` — `initAppCheck()` en el arranque.
- `apps/mobile/lib/services/app_check_service.dart` — Play Integrity (Android) / DeviceCheck (iOS).
- `apps/mobile/lib/main.dart` — `AppCheckService.initialize()` tras `Firebase.initializeApp`.
- `apps/mobile/lib/services/location_service.dart` — clave de Web Services según plataforma.
- `apps/mobile/pubspec.yaml` — `firebase_app_check: ^0.4.6` (la única compatible con `firebase_core ^4.13.0`).

### Scripts
- `scripts/hardening-firebase.sh` — dry-run por defecto, imprime cada comando, pide confirmación.
- `scripts/check-costs.sh` — solo lectura; salida `TODO OK` o lista de pendientes.

### Calidad
- `npm test` → API **18/18**, roles **8/8**, UI **13/13**, hosting **9/9** — todo OK.
- `dart analyze lib/` → **sin incidencias**.
- `npm run build` (web) → OK.
- `.env` reales **intactos** (ignorados por git).
- **Sin push.**

---

## ⚠️ Pendiente (requiere consola web o tu confirmación)

### 1. SPEND CAP real — el único tope de gasto que existe
> Google Cloud **no tiene tope duro de gasto** fuera del spend cap. El presupuesto
> "Alerts only" **solo avisa**: no frena nada.

- **URL:** https://console.cloud.google.com/billing/budgets?project=carsigo-9e508
- `Create budget` → tipo **"Spend cap enforcement"** (NO "Alerts only")
- Scope: **un** proyecto + **un** servicio. Elegibles: Cloud Run, Cloud Run functions,
  Gemini API, Vertex AI (estos dos ya están deshabilitados).
- Target: **20 USD** (o 64 900 COP).
- Al superarse, Google **pausa el servicio** hasta el mes siguiente.
- ⚠️ Un alerts-only **no se puede convertir** en spend cap: hay que crear uno nuevo.

### 2. App Check — registrar las apps
- **URL:** https://console.firebase.google.com/project/carsigo-9e508/appcheck
- **Web** → registra `carsigo-9e508` → reCAPTCHA v3 → copia la **SITE KEY**.
- **Android** → Play Integrity → SHA-1 `2bd8d3c51561addaa36f3a0f1d2da6a325f20463`
- **iOS** → DeviceCheck → bundle id `com.example.carsigoMobile`
- ⚠️ Déjalo todo en **"Monitor"** hasta verificar que las apps funcionan; luego **"Enforce"**.

### 3. Deshabilitar las APIs sin uso (16)
BigQuery ×7, Dataform, Dataplex, Datastore, Cloud SQL, Pub/Sub, Artifact Registry,
Eventarc, App Engine, Analytics Hub.

- **URL:** https://console.cloud.google.com/apis/dashboard?project=carsigo-9e508
- Automatizable: `bash scripts/hardening-firebase.sh --apply`
- ⚠️ `artifactregistry` y `cloudbuild` los usa el flujo de deploy: no los quites si vas a redesplegar.

### 4. Bajar las cuotas de Cloud Run y Cloud Build
- Cloud Run: `instances` 100 → **3**, `running_executions` 1000 → **10** (us-central1 y southamerica-east1)
- Cloud Build: `create_requests` 50 → **2**, `all_else_requests` 300 → **60**
- Automatizable: `bash scripts/hardening-firebase.sh --apply`

### 5. Clave iOS en el entorno del móvil
Añade a `apps/mobile/.env` (no versionado):
```
GOOGLE_WEB_SERVICES_KEY_IOS=AIzaSyC775YVZ77wH9IUTpHFzIIPxed0jKdheuc
```
Sin ella, la app iOS seguirá usando la clave Android y Google la rechazará.

### 6. Variable de entorno del panel web
Añade a `.env.production` (no versionado):
```
VITE_RECAPTCHA_SITE_KEY=<site key de reCAPTCHA v3>
```
Sin ella, App Check web queda inactivo (la app sigue funcionando, sin protección).

### 7. Instalar la dependencia de Flutter
```bash
cd apps/mobile && flutter pub get
```
(`pubspec.lock` ya está actualizado; `flutter pub get` lo confirma.)

### 8. Commit y push (cuando quieras)
```bash
git add -A && git commit -m "chore(security): App Check + restricciones de API keys + cuotas"
git push origin Jose
```

---

## Comandos de referencia

```bash
# Verificación de estado (solo lectura)
bash scripts/check-costs.sh

# Hardening (dry-run por defecto)
bash scripts/hardening-firebase.sh

# Hardening real (pide confirmación en cada paso)
bash scripts/hardening-firebase.sh --apply
```

## Estado actual: coste ≈ $0

| Concepto | Coste |
|---|---|
| Hosting | **$0** — despublicado (`SITE_DISABLE`, la URL devuelve 404) |
| Cloud Functions | **$0** — 0 funciones |
| Cloud Run | **$0** — 0 servicios |
| Firestore | **$0** — free tier, 47 docs |
| Auth | **$0** — 4 usuarios |
| BigQuery / Cloud SQL / Pub/Sub | **$0** — sin recursos |
| Storage | **$0** — no aprovisionado |
| Maps / Places / Directions | **$0 en reposo** — claves acotadas a sus apps |

**Riesgo residual:** mientras no exista spend cap y las claves de pago no estén
protegidas por App Check, una clave filtrada puede generar gasto. Los pasos 1 y 2
de la columna derecha cierran ese hueco.
