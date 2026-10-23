# 🔐 Informe de seguridad — CarSiGo

**Fecha:** 21 de octubre de 2026
**Alcance:** `apps/admin-web` · `apps/admin-api` · `apps/mobile` · `functions` · `firebase/*.rules`
**Método:** auditoría con las skills `security-and-hardening` y `firebase-security-rules-auditor`, más pruebas de explotación contra la API desplegada.

---

## Resumen ejecutivo

| Severidad | Abiertas | Corregidas |
|---|---|---|
| 🔴 Crítica | 0 | **2** |
| 🟠 Alta | 0 | **3** |
| 🟡 Media | **2** | 1 |
| 🟢 Baja | **2** | 0 |

**Puntuación de las reglas de Firestore: 4/5** (antes 3/5).

La decisión de diseño que origina casi todo: **la Admin API usa el Admin SDK de
Firebase, que ignora las `firestore.rules`**. Por eso la autorización **no puede
depender de las reglas**: tiene que estar en el código de la API. Antes de esta
auditoría, 5 de los 6 endpoints de la API no exigían autenticación.

---

## 🔴 Críticas — corregidas

### C-1. Fuga de PII: cualquier persona podía leer todos los viajes
**Endpoint:** `GET /api/trips`, `GET /api/trips/:id`
**Impacto:** devolvía sin autenticación `passenger_id`, direcciones exactas de
recogida y destino, coordenadas, tarifas y teléfonos. Datos personales de
usuarios reales, expuestos en internet.
**Prueba:** `GET /api/trips?limit=5` → **HTTP 200** con 5 viajes reales.
**Causa:** la ruta usaba `createAdminClient()` sin ninguna comprobación de sesión.
**Corrección:** `requireAuth` + `requireAdmin` en todas las rutas de `trips`.

### C-2. Inyección de viajes: cualquiera podía crear y modificar viajes
**Endpoints:** `POST /api/trips`, `PATCH /api/trips/:id`
**Impacto:** creación de viajes falsos (manipulación de la oferta y del cobro),
cancelación de viajes de terceros, y alteration de `driver_id`/`status` de
viajes ajenos.
**Prueba:** `POST /api/trips` sin token → **HTTP 201** (viaje creado en producción;
se eliminó tras la prueba).
**Corrección:** `requireAuth` + `requireAdmin` + validación del vocabulario de
estados + rate limit de escritura.

---

## 🟠 Altas — corregidas

### A-1. Las Storage Rules no compilaban
**Causa:** la función `isAdmin()` estaba declarada **fuera** del bloque
`service firebase.storage { }`. En Storage Rules las funciones deben declararse
dentro del bloque `service`.
**Impacto:** `firebase deploy --only storage` fallaba → **las reglas de Storage
nunca se habían desplegado**. Además, `firebase.json` **no tenía bloque
`storage`**, así que el CLI ni siquiera las subía.
**Corrección:** función movida dentro del bloque + bloque `storage` añadido al
`firebase.json`. Verificado con el emulador de Storage.

### A-2. Vocabulario de estados de viaje inconsistente (lógica rota)
**Causa:** tres piezas usaban tres vocabularios distintos:

| Pieza | Valores |
|---|---|
| App móvil (`trip_service.dart`) | `pending, accepted, **inProgress**, completed, cancelled` |
| `firestore.rules` (conductor) | `accepted, **started**, completed, cancelled` |
| Admin API (`trips.js`) | `accepted, **active**, completed, cancelled` |

**Impacto:** cuando el conductor iniciaba un viaje con `inProgress`, la regla lo
**denegaba en silencio** → el viaje se quedaba en `accepted` para siempre. El
ciclo de vida del viaje, que es el corazón de la app, estaba roto.
**Corrección:** vocabulario único en las tres piezas
(`pending → accepted → inProgress → completed | cancelled`), con `started` y
`active` aceptados como alias. La API ahora **valida** el estado recibido.

### A-3. Sin rate limiting en una API pública
**Impacto:** la función es invocable públicamente (`invoker: 'public'`), así que
cualquier agente podía agotar la cuota de Firestore del proyecto a coste cero.
**Corrección:** limitador por IP y por ruta (`middleware/rate-limit.js`):
200/15 min global, 120/15 min lectura, 30/15 min escritura.

---

## 🟡 Media

### M-1. Sin límites de tamaño en las reglas (agujero de cuota) — **corregida**
`users` no limitaba la longitud de `name`, `email` ni `phone`. Un usuario
autenticado podía crear documentos de ~1 MB (límite de Firestore) en bucle.
**Corrección:** límites `size() <= 120 / 200 / 40` en create y update.

### M-2. Viajes pendientes legibles por cualquier usuario autenticado — **abierta**
`allow read` de `trips` incluye `(status == 'pending' && driver_id == null)`:
cualquier pasajero autenticado puede leer el **feed de viajes pendientes**,
incluyendo `passenger_id` y direcciones de otros usuarios.
**Evaluación:** es el diseño de un marketplace de viajes (el conductor necesita
ver el feed), pero expone `passenger_id` y la dirección exacta de partida.
**Recomendación:** projection en el cliente (pedir solo los campos necesarios) o
un documento público de feed sin `passenger_id`. **Requiere decisión de producto.**

---

## 🟢 Bajas

### B-1. Cabeceras de seguridad incompletas en la API
`X-Powered-By` expuesto, sin `X-Frame-Options`, `Referrer-Policy` ni
`Permissions-Policy`. **Corregido** en `app.js`.

### B-2. El manejador de errores filtraba stack traces
El `errorHandler` devolvía `err.stack` al cliente. **Corregido**: ahora registra
en el servidor y devuelve un mensaje genérico con un `reference` correlacionable.

---

## ✅ Aspectos que pasaron la auditoría

| Comprobación | Resultado |
|---|---|
| **Escalada de privilegios en `users`** | ✅ `create` exige `role == 'passenger'`; `update` exige `role` y `status` idénticos. Test automatizado: *"create users role superadmin (DENY)"* |
| **Origen de la autoridad** | ✅ `isAdmin()` usa `request.auth.token.role` (custom claims), **nunca** datos del cliente |
| **Bootstrapping de admin** | ✅ Sin emails hardcodeados; los claims los fija el Admin SDK |
| **XSS en el panel** | ✅ Cero `v-html` / `innerHTML` / `eval` |
| **Tokens en almacenamiento cliente** | ✅ El panel no guarda nada en `localStorage`; el móvil solo persiste tema y destinos recientes |
| **Secretos en el código** | ✅ Solo claves públicas de Firebase en `firebase_options.dart` (por diseño) y en el bundle. Ninguna private key |
| **Service account expuesta** | ✅ Solo en la raíz, gitignorada |
| **CRUD de `driver_applications`** | ✅ Los 19 campos que escribe el móvil coinciden con el `hasOnly` de la regla |
| **Firestore rules** | ✅ Compilan y pasan los tests del emulador |
| **Storage rules** | ✅ Compilan (tras corregir A-1) |

---

## 📦 Dependencias

`npm audit`: **0 críticas**, 7 altas, 9 moderadas (antes: 0/7/10).

### Corregida
- **DOMPurify 3.3.3 → 3.4.17** (vía `jspdf`): 5 avisos de XSS por contaminación
  de hooks/`ALLOWED_ATTR`. Alcanzable: el panel genera PDFs con `jspdf`, que
  sanea el texto con DOMPurify.

### Triadas, no alcanzables (documentadas, revisar en la próxima actualización)

| Paquete | Cadena | Por qué no es alcanzable |
|---|---|---|
| `@grpc/grpc-js` | ← `firebase-admin`, `@firebase/firestore` | El SDK **web** usa WebChannel (HTTP), no gRPC. En Node los avisos son de validación de certificados TLS y fuga de mensajes de error |
| `@fastify/busboy` | ← `firebase-admin` | DoS/CRLF en parsing de multipart. La API **nunca** sube ficheros |
| `picomatch` | dev | ReDoS en patrones glob. Solo en tooling |
| `@firebase/rules-unit-testing` | dev | Solo en tests |

**Revisión programada:** siguiente actualización de dependencias.

---

## 🔐 Estado final de la autorización de la API

| Endpoint | Sin token | Con token no admin | Con token admin |
|---|---|---|---|
| `POST /api/pricing/estimate` | **401** | 200 | 200 |
| `POST /api/zones/check` | **401** | 200 | 200 |
| `GET /api/drivers/nearby` | **401** | **403** | 200 |
| `GET /api/trips` | **401** | **403** | 200 |
| `POST /api/trips` | **401** | **403** | 200 |
| `GET/PATCH /api/trips/:id` | **401** | **403** | 200 |
| `POST /api/admin/users/:uid/role` | **401** | **403** | 200 (solo superadmin) |
| `GET /api/health` | 200 | 200 | 200 |

Verificado **contra la API desplegada en producción**.

---

## ⚠️ Pendientes que requieren acción del dueño

1. **🔴 Bucket de Storage.** `firebase deploy --only storage` falla:
   *"Firebase Storage has not been set up"*. Hay que ir a
   https://console.firebase.google.com/project/carsigo-9e508/storage → **Get Started**.
   Hasta entonces los conductores **no pueden subir sus documentos**.

2. **🟠 Restricción de las API keys.** Las claves de Firebase y Google Maps son
   públicas por diseño, pero deben restringirse por dominio
   (`carsigo-9e508.web.app`, `carsigo-9e508.firebaseapp.com`) y por paquete
   Android/iOS. Sin esa restricción, cualquiera puede usarlas y gastar tu cuota.

3. **🟠 Desactivar el despliegue público** mientras el proyecto esté inestable
   (ver `docs/DEPLOY.md` → "Poner en pausa el despliegue").

4. **🟡 Desincronización de roles.** El usuario
   `todoobraparabien1998@gmail.com` tiene `role: 'passenger'` en
   `users/{uid}.role` pero `superadmin` en los custom claims. El panel ahora
   prioriza el claim (que es lo que valida la API), pero conviene alinear el
   dato en Firestore.

5. **🟡 Zona desactivada.** `geofences/17oKw6fEKDE7vkHZkHwe` llevaba
   `is_active: false` desde el 26 de agosto, lo que hacía que la app móvil
   (`where('is_active', true)`) **no encontrara ninguna zona**. Ya se reactivó.
   Conviene comprobar el flujo completo de la app con la zona activa.

---

## 🧪 Pruebas de seguridad ejecutables

```bash
npm run test:api        # incluye 7 checks de autorización sin token
npm run test:prod       # 10 checks contra producción
firebase emulators:exec --only firestore --project demo-carsigo \
  "node tests/firestore-rules.test.mjs"
```

`tests/firestore-rules.test.mjs` verifica, entre otros casos, que un usuario
**no puede** crear su propio documento con `role: 'superadmin'`.
