# CarSiGo Admin API

Backend del panel de administración. **Express + JavaScript (ES Modules) + Firebase Admin SDK.**

Sustituye las Route Handlers de Next.js que vivían en `app/api/`. Toda la lógica
de negocio del CRUD de tarifas/zonas se hará **directamente desde Vue contra
Firestore**; esta API solo expone los 5 endpoints core que requieren lógica de
servidor (tarifa autoritativa, geospatial, y gestión de roles).

---

## Arranque

```bash
cd apps/admin-api
npm install
cp .env.example .env     # completar FIREBASE_SERVICE_ACCOUNT
npm run dev              # http://localhost:4000
```

Variables de entorno (ver `.env.example`):

| Variable | Descripción |
|---|---|
| `PORT` | Puerto del servidor (default `4000`) |
| `FIREBASE_SERVICE_ACCOUNT` | Ruta **absoluta** al JSON del service account |
| `OWNER_EMAIL` | Email del dueño (bypass de superadmin en la UI) |
| `ALLOWED_ORIGINS` | Orígenes CORS permitidos, separados por coma |
| `DEFAULT_ZONE_ID` | Slug de la zona de precios por defecto |

> El `.env` de la raíz del monorepo también se carga como fallback.

---

## Endpoints

### `POST /api/pricing/estimate`
Estimación **autoritativa** de la tarifa. Calcula en servidor: base por turno +
incremento por hora transcurrida + km extra + topes por anillo de la geofence +
multiplicadores de precio dinámico.

```json
{ "vehicle_type": "car", "distance_km": 8, "zone_id": "el-carmen-de-bolivar" }
```

### `GET /api/drivers/nearby?lat=&lng=&radius_km=`
Conductores con `driver_profiles.status === 'active'`, enrichecidos con `users`
(nombre, teléfono, avatar) y filtrados por distancia real (haversine).

### `GET /api/trips` · `POST /api/trips` · `GET /api/trips/:id` · `PATCH /api/trips/:id`
Ciclo de vida del viaje. El `POST` calcula la tarifa en servidor y la persiste
en el documento junto con el desglose.

### `POST /api/zones/check`
```json
{ "lat": 9.7205, "lng": -75.1174 }
```
Resuelve la geofence activa que contiene el punto, con `contains` (polígono de
servicio) y `contains_urban` (corredores + casco urbano).

### `POST /api/admin/users/:uid/role` 🔒
Asigna el rol de un usuario. **Requiere `Authorization: Bearer <idToken>` con
`role === 'superadmin'` en los custom claims.**

```json
{ "role": "admin" }
```
Actualiza **dos** lugares:
1. `admin.auth().setCustomUserClaims(uid, { role })` → de ahí lee `decodedToken.role` el resto de la API.
2. `users/{uid}.role` en Firestore → para las consultas del panel.

> Tras cambiar un rol, el usuario debe **renovar su token** (`getIdToken(true)`)
> para que recoja el nuevo claim.

### `GET /api/admin/users/:uid` 🔒
Lee el usuario desde Auth + Firestore (útil para depurar roles).

---

## Autenticación

El panel Vue obtiene el ID token con el Firebase Web SDK
(`signInWithPopup` / `signInWithEmailAndPassword`) y lo envía como:

```
Authorization: Bearer <idToken>
```

| Middleware | Comportamiento |
|---|---|
| `requireAuth` | 401 si falta el header o el token es inválido/expirado. Deja `req.user` con el token decodificado |
| `requireRole(role)` | 403 si `req.user.role !== role` |
| `requireSuperAdmin` | Atajo de `requireRole('superadmin')` |

---

## Estructura

```
src/
├── index.js                    # punto de entrada (levanta el servidor)
├── app.js                      # factory de la app Express (testeable)
├── config.js                   # variables de entorno
├── lib/
│   ├── firebase-admin.js       # singleton del Admin SDK (db, auth, storage)
│   ├── pricing-engine.js       # motor de tarifas (consultas nativas)
│   ├── rate-limit.js           # limitador en memoria
│   └── firebase/rest-auth.js   # helpers REST de Identity Platform
├── middleware/
│   ├── auth.js                 # requireAuth / requireRole / requireSuperAdmin
│   └── error-handler.js        # 404 + manejador de errores
└── routes/
    ├── index.js
    ├── pricing.js
    ├── drivers.js
    ├── trips.js
    ├── zones.js
    ├── admin.js
    └── _legacy_next_api/       # REFERENCIA (no se ejecuta)
        ├── legacy-actions/     # los 12 actions.ts del panel Next (CRUD admin)
        ├── next-routes/        # los route.ts originales
        └── legacy-lib/         # client.ts, server.ts, admin.ts, db.ts, auth.ts...
```

### `_legacy_next_api/`
Contiene el código del panel Next.js **solo como referencia**. No se importa en
ningún momento (el `index.js` de routes no lo registra). Sirve para:
- recuperar la lógica de CRUD cuando se implemente en Vue;
- consultar el comportamiento anterior durante la migración.

---

## Pruebas

```bash
node scripts/smoke-test.js       # 10 checks sobre los 5 endpoints
node scripts/test-admin-role.js   # 8 checks de auth (401/403/400/200 + persistencia)
```

Ambos levantan el servidor en un puerto libre y talkean con Firestore real.
