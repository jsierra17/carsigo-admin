# 🚀 Guía de despliegue — CarSiGo

Arquitectura de producción (la que está desplegada hoy):

```
Navegador
  │  https://carsigo-9e508.web.app
  ▼
Firebase Hosting  ───────────────────  sirve apps/admin-web/dist (Vue 3)
  │
  ├─ /api/**  ──rewrite──▶  Cloud Function `adminApi`  (2ª gen, us-central1)
  │                          └─ Express (apps/admin-api → functions/api-src)
  │                             └─ Firestore / Auth / Storage
  │
  └─ /**      ──rewrite──▶  /index.html   (fallback SPA)

App móvil (Flutter) ──▶ Firebase Auth / Firestore / Storage / Messaging
```

Todo en el proyecto Firebase **`carsigo-9e508`** (plan Blaze).

| Recurso | Identificador |
|---|---|
| Hosting | `https://carsigo-9e508.web.app` |
| Cloud Function | `https://us-central1-carsigo-9e508.cloudfunctions.net/adminApi` |
| URL de la función | `https://adminapi-bf3ynnmg7q-uc.a.run.app` |
| Firestore | `southamerica-east1` (11 colecciones) |

---

## 0. Requisitos

| Herramienta | Para qué | Estado |
|---|---|---|
| Node.js ≥ 20 | build del panel y la API | ✅ |
| Firebase CLI 15.x | deploy de hosting / rules / functions | ✅ instalado |
| Google Cloud CLI 590 | inspección de Cloud Run, IAM, Artifact Registry | ✅ instalado (portable, en `C:\Users\todoo\gcloud`) |
| Docker | build local de imagen (opcional) | ❌ no hace falta: Cloud Build lo hace en la nube |

### gcloud (instalación portable, sin admin)
```powershell
# Ya está en C:\Users\todoo\gcloud\google-cloud-sdk
# Para añadirlo al PATH del usuario:
[Environment]::SetEnvironmentVariable("Path", $env:Path + ";C:\Users\todoo\gcloud\google-cloud-sdk\bin", "User")
$env:CLOUDSDK_PYTHON = "C:\Python314\python.exe"
gcloud version
```

> **Ojo:** `gcloud` con la service account de Firebase Admin **no** puede
> desplegar infraestructura (solo tiene el rol `firebaseAdmin`). Para eso hay
> que autenticarse con tu cuenta: `gcloud auth login`.

---

## 1. Configurar las variables del panel (build)

Vite lee el `.env` / `.env.local` de la **raíz del monorepo** (`envDir`).
Para producción, crea un `.env.production` en la raíz:

```bash
cp .env.example .env.production
```

| Variable | Dónde sacarla |
|---|---|
| `VITE_FIREBASE_API_KEY` | Firebase Console → Project settings → Your apps |
| `VITE_FIREBASE_APP_ID` | ídem |
| `VITE_GOOGLE_MAPS_KEY` | Google Cloud Console → APIs & Services → Credentials |
| `OWNER_EMAIL` | tu correo (bypass de superadmin) |

> Se **incrustan en el bundle** en tiempo de build: si cambian, hay que
> re-construir y re-desplegar el panel.

---

## 2. Desplegar la Admin API (Cloud Function)

La API es una Cloud Function de 2ª gen. El CLI de Firebase despliega **solo**
la carpeta `functions/`, así que el código de la API se copia allí antes de
compilar:

```bash
npm run prepare:functions   # copia apps/admin-api/src → functions/api-src/
                            # y genera functions/src/index.ts
npm run build --prefix functions
firebase deploy --only functions
```

O en un solo paso:
```bash
npm run deploy:functions
```

### Detalles importantes

1. **ESM**: `functions/package.json` lleva `"type": "module"`. El `tsconfig`
   usa `module: NodeNext`, `rootDir: "."` y `allowJs: true` para compilar
   también los `.js` de la API. Por eso `import.meta.url` sigue funcionando.

2. **`@firebase/app` como dependencia explícita**: `firebase-admin` →
   `@firebase/database-compat` → `@firebase/app`. npm no siempre resuelve esa
   peer dependency, y el contenedor falla con
   `Cannot find module '@firebase/app'`. Está añadida a mano en
   `functions/package.json`.

3. **`invoker: 'public'`**: el rewrite de Hosting **no** envía header
   `Authorization`, así que la función debe ser invocable sin IAM. La
   seguridad real la aporta la API (Bearer token + custom claim de rol).

4. **Service account**: la función usa
   `firebase-adminsdk-fbsvc@carsigo-9e508.iam.gserviceaccount.com`, que
   tiene permisos plenos de Firebase Admin (Firestore, Auth, Storage) y
   **ignora las `firestore.rules`** — por eso la API valida los roles a mano.

5. **Cleanup policy**: `firebase functions:artifacts:setpolicy` (ya aplicado)
   borra las imágenes de contenedor con más de 1 día.

6. ⚠️ **La etiqueta `api-build` es obligatoria**. El CLI de Firebase calcula el
   hash de "cambio" sobre la **definición** de la función (trigger + opciones),
   **no** sobre el contenido de los archivos. Por eso un cambio interno en la
   API (por ejemplo, editar `routes/zones.js`) **no dispara un redeploy** y la
   función sigue sirviendo la versión anterior en silencio.

   `scripts/prepare-functions.js` calcula un hash SHA-256 del código de la API y
   lo injecta como etiqueta `api-build`. Al cambiar el código, cambia la
   definición, el CLI detecta el cambio y despliega. **No borres esa etiqueta.**
   Si alguna vez necesitas forzar un redeploy: `firebase deploy --only functions --force`.

---

## 3. Desplegar el panel (Hosting)

```bash
npm run deploy:hosting
# = npm run build:web && firebase deploy --only hosting
```

### Qué hace la configuración de `firebase.json`
| Clave | Para qué |
|---|---|
| `public: "apps/admin-web/dist"` | El build de Vite (relativo a la raíz, donde vive el config) |
| `rewrites: /api/**` | Proxy a la Cloud Function `adminApi` |
| `rewrites: **` | Fallback a `index.html` (SPA: `/zonas`, `/tarifas`…) |
| `headers: /assets/**` | `Cache-Control: immutable, max-age=1y` (llevan hash) |
| `headers: /index.html` | `no-cache` (siempre se descarga el HTML nuevo) |
| `cleanUrls` | `/zonas` en vez de `/zonas.html` |
| `headers: **` | `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` |

> **El orden de los rewrites importa**: primero `/api/**`, luego `**`.
>
> `firebase.json` debe estar en la **raíz**: el CLI resuelve esas rutas
> relativas a la carpeta del config y rechaza rutas fuera de ella
> (`is outside of project directory`).

---

## 4. Reglas, índices y Storage

```bash
npm run deploy:rules
```
Despliega `firebase/firestore.rules`, `firebase/firestore.indexes.json` y
`firebase/storage.rules`.

---

## 5. APIs de Google Cloud

Solo hace falta una vez por proyecto. El script usa las credenciales del
Firebase CLI (tu cuenta) porque la service account de Admin SDK no tiene
permisos de infraestructura:

```bash
npm run enable:apis
```

Habilita: `run`, `cloudbuild`, `artifactregistry`, `cloudresourcemanager`,
`serviceusage`, `iam`.

---

## 6. Verificar el despliegue

```bash
# El panel carga
curl -I https://carsigo-9e508.web.app

# La API responde a través del rewrite
curl https://carsigo-9e508.web.app/api/health
curl -X POST https://carsigo-9e508.web.app/api/pricing/estimate \
  -H "Content-Type: application/json" \
  -d '{"vehicle_type":"car","distance_km":8,"zone_id":"el-carmen-de-bolivar"}'

# Una ruta profunda (rewrite SPA) devuelve el HTML
curl -I https://carsigo-9e508.web.app/zonas
```

---

## 🧪 Probar la configuración SIN desplegar

Hay un simulador que reproduce localmente lo que hace Hosting:

```bash
npm run build:web
npm run preview:hosting      # http://localhost:5299
npm run test:hosting         # 8 checks en navegador real
```

---

## Alternativa: Cloud Run en vez de Functions

Si necesitas más control (escalado, CPU, VPC), puedes mover la API a Cloud Run.
El `Dockerfile` de `apps/admin-api/` ya está listo:

```bash
cd apps/admin-api
gcloud builds submit --tag gcr.io/carsigo-9e508/carsigo-admin-api
gcloud run deploy carsigo-admin-api \
  --image gcr.io/carsigo-9e508/carsigo-admin-api \
  --region us-central1 --platform managed --allow-unauthenticated \
  --set-env-vars NODE_ENV=production,ALLOWED_ORIGINS=https://carsigo-9e508.web.app
```

Y en `firebase.json`, cambia el rewrite:
```jsonc
{ "source": "/api/**", "run": { "serviceId": "carsigo-admin-api", "region": "us-central1" } }
```

> Requiere `gcloud auth login` con tu cuenta (la service account de Admin SDK
> no tiene permisos de `run.admin`).

---

## ⚠️ Cosas que hay que tener en cuenta

1. **CORS**: aunque el panel y la API están en el mismo dominio (gracias al
   rewrite), el navegador envía `Origin: https://carsigo-9e508.web.app`. Ese
   origen está en la lista por defecto de `ALLOWED_ORIGINS`
   (`apps/admin-api/src/config.js`). Con dominio personalizado, **agrégalo
   ahí** y en las variables de entorno de la función.
2. **La API tiene permisos elevados** (Admin SDK, ignora las rules). El control
   de acceso real lo hacen los custom claims (`role`) validados en cada
   endpoint sensible.
3. **Cold start**: la función tarda ~2-4 s en arrancar tras un periodo de
   inactividad. Para un panel de administración es aceptable; si molesta,
   activa `minInstanceCount: 1` (implica coste fijo).
4. **Regla de oro**: cualquier cambio en `VITE_*` del panel
   requiere **re-build + re-deploy** de Hosting.
5. **`functions/api-src/`** es código generado: se regenera con
   `npm run prepare:functions` antes de cada deploy de functions.
