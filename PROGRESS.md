# Progress Log

## 2026-11-09 (Sesión 9: fixes estructurales de tarifas)

**Completado:**
- FIX 1 (doble horario): `TarifasView.save()` para turnos ahora sincroniza `start_time`/`end_time` = `shift_start`/`shift_end` Y `window_label` = `shift_label` (el motor lee con preferencia por los primeros; antes los cambios de horario desde la web eran ignorados)
- FIX 2 (festivos): ejecutado `scripts/cleanup-dynamic-pricing.mjs --apply` — borrados 4 docs duplicados/solapados (rangos date_range de Semana Santa 3-10abr, Carnaval 19-22feb, Fiestas patronales 14jul-18ago, y "18 Jul" redundante). Creada la regla faltante "Semana Santa Jueves" (2026-04-02, specific_date x1.3). Resultado: 9 reglas activas, 1 por festivo-día, todas annual-recurring
- FIX 3 (techos visibles y editables): `ZonasView` — sección "Techos por distancia (rings)" en el detalle de zona (tabla max_km/car/moto) + modal de edición (añadir/eliminar anillos, orden ascendente automático al guardar porque el motor corta en el primer ring que alcanza la distancia), guarda vía `zonesService.update`
- FIX 4 (campos muertos ocultos): modal de tarjeta reduce a los campos que el motor consume (nombre, vehículo, base, mínimo, km incluidos, comisión, tiers 1/2, zona); eliminados price_per_km/price_per_minute/waiting del modal y del `emptyCard()` (los docs existentes conservan sus valores legacy; al editar se preservan por merge)
- Build OK

**Notas:**
- `geofences.rings` es editable ahora desde el panel; reglas: geofences write = isAdmin (OK para admin)
- Script cleanup es re-ejecutable (dry-run por defecto), guardas de identidad por doc

## 2026-11-09 (Sesión 8: parches de seguridad V1/M1/M2/M4)

**Completado (solo código local; sin tocar producción):**
- FIX 1 (V1, BOLA): `GET /api/admin/users/:uid` ahora exige `requireAuth, requireAdmin` — un passenger/driver ya no puede leer perfiles de otros vía Admin SDK
- FIX 2 (M2): 401 de `verifyIdToken` sin `detail: error.message` — solo "Token inválido o expirado" (el detalle del verifier solo ayuda al atacante)
- FIX 3 (M1): `app.set('trust proxy', 1)` ya existía en app.js; fix real en `middleware/rate-limit.js` — `clientKey()` ahora usa `req.ip` (primer hop NO confiable con trust proxy) en vez del primer valor de `x-forwarded-for` (spoofable por el cliente)
- FIX 4 (M4): `storage.rules` — `driver_documents` valida además `request.resource.contentType.matches('image/')`
- Validación: `npm run test:api` 8/8 OK suite del endpoint de roles

**Pendiente de deploy (producción, requiere ejecución del usuario):**
- `firebase deploy --only storage:rules` para que FIX 4 aplique en producción
- Los fixes 1-3 son de la Admin API: aplican en `next deploy` de functions/api (Cloud Run) — no afectan al panel web
- Diferido por decisión del usuario: V2 (rate limit distribuido con Redis) y M3 (límites de viajes en reglas)

## 2026-11-09 (Sesión 7: auditoría de seguridad + rediseño del Home)

**Completado:**
- Auditoría de seguridad (solo lectura) con los skills disponibles (`firebase-security-rules-auditor`, `api-security-best-practices`; los skills `z-audit` y `frontend-design` no existen en este entorno). Hallazgos clave, order por severidad:
  - Mayor: `GET /api/admin/users/:uid` solo exige `requireAuth` — cualquier usuario autenticado (passenger/driver) puede leer perfil Auth + doc users de CUALQUIER uid vía Admin SDK (ignora reglas). Debería ser `requireAdmin` o self-only
  - Mayor/moderada: rate limit en memoria por proceso — en Cloud Run multi-instancia se pueden eluder escalando réplicas; migrar a Redis o capa LB (Cloud Armor)
  - Moderada: `clientKey()` usa el primer IP de `x-forwarded-for` (spoofable); usar la última IP confiable con `trust proxy` correcto
  - Moderada: `trips` create por pasajero sin límite de tamaño/tarifa (strings sin `size()` checks, sin límite de viaje activo por pasajero)
  - Menor: `detail: error.message` en 401s de auth.js filtra detalles del verificador de tokens
  - Menor: storage `driver_documents` valida tamaño/extensión del fileName pero no `request.resource.contentType`
  - Positivo: reglas de geofences/rate_*/dynamic_pricing_rules usan claim `role` (no user data); users.create fuerza `role == 'passenger'` con hasOnly; trips update/create con diff+hasOnly y ownership; storage con whitelist de nombres y 8MB; .env gitignored y service account FUERA del repo (Downloads); frontend sin secretos (solo config pública Web SDK + Maps key con restricción referrer)
- HomeView.vue rediseñado: landing dark mode (neutral-950 + resplandor radial carsigo), hero con badge "Hiperlocal · El Carmen de Bolívar", CTA grande a /login, grid de 4 características (geofences, tarifas por zona, precio dinámico, operación protegida), footer con enlace a /terminos
- terms: nueva vista TermsView.vue + ruta pública /terminos en el router (el footer no apunta a 404)
- Build OK

## 2026-11-09 (Sesión 6: Tarifas y Precios Dinámicos funcionales)

**Completado:**
- Fix crítico de correlación zona↔tarifas: `rate_cards/rate_schedules/dynamic_pricing_rules.zone_id` guardan el SLUG (`el-carmen-de-bolivar`), no el doc id de geofences; `TarifasView`/PrecioDinamico usaban doc id como value del selector (solo funcionaba de casualidad con 1 zona). Ahora `listZones()` devuelve `{id, slug, municipality_name, is_active}` y las vistas usan `zoneKey(z) = z.slug || z.id` para selector, filtrado y `zoneName()`; fallback en `getAll().defaultZoneId` también por slug
- `firestore.js`: helper `describeFirestoreError()` — traduce FirestoreError a banner accionable: `failed-precondition` → extrae URL de creación de índice del mensaje del SDK (`https://console.firebase.google.com/...create_index=...`); `permission-denied` → mensaje de reglas
- `TarifasView.vue`: banner de error con enlace "Crear índice en Firebase Console"; modal de tarjeta ahora incluye `price_per_km` y `price_per_minute` (campos reales verificados en producción); selector/tabla filtrado por slug
- `PrecioDinamicoView.vue`: añadido selector de zona ("Todas las zonas" + por slug), `visibleRules` con filtro, banner de error igual; "Nueva regla" hereda la zona del filtro; estratégia de estados vacíos (aviso si no hay zonas)
- Datos de producción verificados (solo lectura): rate_cards tiene price_per_km/price_per_minute (0 en la maestra), dynamic_pricing_rules ya tiene reglas para `cartagena-de-indias` y `el-carmen-de-bolivar` (specific_date x1.3)
- Build OK

**Notas:**
- `rate_schedules` (turnos por día/hora con `hourly_increase_percent`) se administran en la pestaña "Turnos y horarios" de Tarifas; por diseño no se duplican en Precio Dinámico
- Odén por múltiples campos sin `where` no requiere índice compuesto; las consultas actuales de las vistas no deberían disparar `failed-precondition`, pero el banner cubre el caso (los filtros futuros con where+orderBy sí lo necesitarán)

## 2026-11-09 (Sesión 5: lógica definitiva de Zonas — clonación de tarifas y borrado en cascada)

**Completado:**
- Análisis Fase 1 (sin tocar código): la "línea azul" era `COLORS.selected` (#3b82f6) en `ZoneMap.renderZones()` + auto-select `selectZone(data[0].id)` en `ZonasView.load()`. Relación zona↔tarifas verificada en PRODUCCIÓN con Admin SDK (solo lectura): `rate_cards.zone_id`, `rate_schedules.zone_id` y `dynamic_pricing_rules.zone_id` = **slug** de la zona (`el-carmen-de-bolivar`, doc geofences `17oKw6fEKDE7vkHZkHwe`, boundary 1512 pts, boundaries GeoJSON string, rings 4)
- `services/firestore.js`: añadidos `cloneZoneTariffs()` (clona rate_cards+rate_schedules+dynamic_pricing_rules de zona maestra→nueva con writeBatch, chunks de 500), `deleteZoneCascade()` (borra geofence + tarifas del slug en batch(s) atómico), `countZoneTariffs()` (getCountFromServer)
- `services/data.js`: añadidos `slugifyName()` ('El Carmen De Bolívar'→'el-carmen-de-bolivar'), `MASTER_ZONE_SLUG` y `createZoneWithTariffs()` (valida duplicado por nombre normalizado, crea geofence con slug + boundaries GeoJSON + boundary array para la móvil, clona tarifas de la maestra); `zonesService` +`removeCascade`/`countTariffs`, -`create` (flujo viejo de dibujo)
- `ZoneMap.vue` reescrito definitivo: SIN polígonos de zona ni azul (`#3b82f6` eliminado); mapa pinta municipios vía `map.data`: verde `is_active:true` / gris `is_active:false` / invisible sin geofence (`syncZoneStyles()` con flag `zoneStyled`, re-sync con watch de props.zones); búsqueda exige match único (avisa si hay N coincidencias); botón "Agregar zona: {name}" emite `create-zone` con `{municipality_name, official_name, boundaries (GeoJSON string), boundary (array anillo exterior)}` via `featureToPayload()`; sin Geocoder ni dibujo manual; `gm_authFailure` escuchado
- `ZonasView.vue` reescrito: eliminados auto-select (sin azul al cargar), modal de creación manual, modo dibujo (`startDrawing`/`openNewZone`/`draftPath`/`addVertex`/`cancelDrawing`/`openCreateForm`/`saveDraftZone`) y props/eventos `selectedId`/`draftPath`/`drawing`/`select-zone`/`add-vertex`; `@create-zone` → `createZoneWithTariffs` (toast con counts de tarifas clonadas); ConfirmDialog "Al eliminar esta zona, se eliminarán también sus tarifas asociadas. ¿Estás seguro?" y `confirmDelete` → `zonesService.removeCascade(id, slug)` con toast de counts
- `services/google-maps.js`: eliminados helpers muertos del flujo viejo (`isMapsConfigured`, `pathsToGeoJson`, `geoJsonToPaths`, `centerOf`); queda `getMapsApiKey` + `loadGoogleMaps`
- Build OK (`npm run build`)

**Integridad garantizada:**
- NO se toca el doc `el-carmen-de-bolivar` ni sus tarifas: la app móvil lee `boundary` (array {lat,lng}) y `slug` (zone_service.dart / pricing_engine.dart), campos intactos
- El borrado en cascada SOLO elimina tarifas con `zone_id == slug` de la zona eliminada; las de la maestra y de otras zonas no se tocan
- La creación con match único genera el `boundary` array desde el anillo exterior del GeoJSON (la móvil funciona con nuevos municipios sin cambios)

**Pendiente de validación del usuario:**
- Probar en Brave: crear "San Jacinto" (verificar clonación con slug `san-jacinto` y colores verde/gris en mapa) y luego eliminarla (verificar cascada sin afectar a la maestra)
- Validar en producción que la app móvil sigue resolviendo precios para `el-carmen-de-bolivar`

**Fix posterior (bug reportado por usuario: botón "Agregar zona" no hacía nada):**
- Root cause night: `featureToPayload` llamaba `feature.toObject()`, método que NO existe en `google.maps.Data.Feature` → TypeError síncrono en el click handler ANTES del `emit('create-zone')` → flujo muerto silencioso
- Fix: `geometryToGeoJson()` extrae coordenadas de forma síncrona con `feature.getGeometry().getArray()` (Polygon/MultiPolygon, LatLng→[lng,lat]); `decimateRing()` limita los anillos a 4000 vértices (DANE llega a ~70k; documento Firestore = máx 1MB) para `boundary` (array móvil) y `boundaries` (string)
- Luces de emergencia: logs numerados 1-6 en `createZoneWithTariffs` (data.js: inicio, slug validado con regex `[a-z0-9-]+`, sin duplicados, geofence creado, clonando tarifas, tarifas clonadas); try/catch + `console.error('ERROR...')` + toast en `emitCreateZone` (ZoneMap) y `handleCreateZone` (ZonasView)
- Reglas Firestore verificadas: `allow write: if isAdmin()` en geofences/rate_cards/rate_schedules/dynamic_pricing_rules (C:\projects\carsigo-admin\firebase\firestore.rules líneas 101-116) — cubren create/batch si el token trae rol admin|superadmin
- Build OK

## 2026-11-09 (Sesión 4: silueta real de municipios con GeoJSON)

**Completado:**
- Fuentes GeoJSON: descargado `geoBoundaries-COL-ADM2_simplified.geojson` (DANE vía geoBoundaries/OCHA, CC BY 4.0) a `apps/admin-web/public/geo/colombia-municipios.geojson` (10 MB, 1122 municipios, propiedad `shapeName` del DANE; el gist de john-guerra es TopoJSON y no sirve para `map.data`)
- `ZoneMap.vue` refactor: capa `map.data` con `setStyle` (verde translúcido, `clickable: false` para no robar clicks a los polígonos de zonas), `loadGeoJson` con promesa squash para la búsqueda; buscador ahora RECORRE el GeoJSON (`map.data.forEach`), compara `shapeName` normalizado (sin acentos) con jerarquía exacto→empezar-por→contener, resalta con `map.data.overrideStyle` y encuadra `map.fitBounds` con bounds reales del feature. El Geocoder quedó ELIMINADO del componente (dibujar con viewport era incorrecto: no es la silueta)
- `ZonasView.vue` limpieza: eliminado el "Buscador de zonas" del encabezado que no filtraba nada (y su `searchQuery`/icono Search); queda un solo buscador functional (el del mapa) y un solo botón "Nueva zona"
- Validación end-to-end en navegador real: carga de `1122` features OK, búsqueda "el carmen de bolivar" → exacta `["El Carmen De Bolívar"]` con bounds OK y fitBounds ejecutado; "cartagena" → `["Cartagena De Indias","Cartagena Del Chairá"]`; build OK

**Notas técnica:**
- El GeoJSON de 10 MB se sirve estático desde `public/` (Vite dev, Firebase Hosting en prod); primera carga lenta, luego cache del navegador
- Nombres del DANE con mayúsculas internas ("El Carmen De Bolívar"): el normalizador quita acentos y baja a minúsculas para el emparejamiento

## 2026-11-09 (Sesión 3: migración Google Maps en Zonas)

**Completado:**
- `.env`: eliminada la clave duplicada de Maps. Había DOS `VITE_GOOGLE_MAPS_KEY` (dotenv conserva la primera, o sea que el bundle usaba la clave vieja). Dejada solo la nueva: `AIzaSyCvqIGm4kHYXvylfdNhyYI-8QnbipFTCUw`
- `ZonasView.vue`: función explícita `openNewZone()` como único punto de entrada del botón "Nueva zona"; valida `isMapsConfigured()` y muestra toast de error si falta la clave; confirmado que no queda botón flotante duplicado
- `ZoneMap.vue`: añadido listener global de `gm_authFailure` (Google disparar el evento cuando la API key es rechazada); muestra error claro en pantalla y consola
- Diagnóstico empírico de REQUEST_DENIED (clave/restricciones): probe REST con ambas claves de Maps → `REQUEST_DENIED: API keys with referer restrictions cannot be used with this API` (esperado: claves con restricción por referrer NO sirven para la API REST, solo cliente JS). Probe real en navegador (origen http://localhost:5173, servicio de la app `/src/services/google-maps.js`) con `google.maps.Geocoder` callback → `status: OK`, `Cartagena de Indias` con viewport. La app actual sirve con la clave `AIzaSyCtit5sux...` (restaurada en `.env`, sin conflicto de duplicados). El REQUEST_DENIED que veía el usuarioprovino de bundle viejo / prueba con REST, no del código actual: no hay fetch ni axios a Google en el frontend (rasterizado por grep); prueba del usuario debe repetirse tras reiniciar Vite
- `services/google-maps.js`: validación post-carga del loader (comprueba `typeof maps.Map === 'function'`; si falta, rechaza con error claro). Evita "maps.Map is not a constructor"
- `ZoneMap.vue`: reescrito con `await nextTick()` antes de instanciar el mapa, contenedor con alto garantizado (`h-full min-h-[600px]` sobre wrapper con altura explícita en `ZonasView`)
- Buscador de municipios con lupa sobre el mapa: Geocoding (`maps.Geocoder`, `region: 'co'`) → `fitBounds(viewport)` + `Rectangle` verde sobre los bounds (reemplaza la "franja verde" de Mapbox), con limpiar y mensajes de error
- `ZonasView.vue`: eliminado el botón flotante duplicado de "Nueva zona" (queda solo el del encabezado); wrapper del mapa a `h-[600px] lg:h-[calc(100vh-16rem)]`
- `StatCard.vue`: prop `icon` ahora `[Object, Function]` (los iconos de lucide-vue-next son functional components, causaba el warning "Invalid prop: type check failed for prop 'icon'")
- Build web OK; app compila en HMR sin errores de consola ni warnings de props en la landing

**Pendiente:**
- Probar flujo completo de Zonas en Brave con sesión real (renderizado del mapa, búsqueda de "El Carmen de Bolívar", dibujo de zona, guardado)
- (de sesiones anteriores) probar login con credenciales reales; smoke test UI desactualizado; emuladores Auth/Firestore para modo local; alinear `users/{uid}.role`='passenger' en Firestore con el claim 'superadmin' si se quiere espejo consistente

## 2026-11-06 (Sesión 2: Fix login + App Check local + mapa)

**Completado:**
- App Check desactivado en DEV: `initAppCheck()` hace `return` temprano si `import.meta.env.DEV`; no intenta reCAPTCHA ni tokens
- `.env` raíz: eliminada `VITE_RECAPTCHA_SITE_KEY` inválida (34 chars, formato debug token, no site key v3)
- `ZoneMap.vue`: altura fija `height: 500px` en el contenedor del mapa para asegurar el renderizado de Google Maps
- Store `auth.js`: nueva acción `login(email, password)` con manejo completo de errores; fuerza `getIdToken(true)` tras el sign-in para recoger custom claims (role); si el usuario no es admin, desloguea y lanza error claro; el alias `signInWithEmail` delega en ella
- Observador `onAuthStateChanged`: ahora renueva el token antes de validar el rol (evita kick en silencio por rol detectado como null)
- `LoginView.vue`: `errorMessage` reactivo local; el submit limpia el error, llama `authStore.login`, muestra el error en un `<p role="alert">` rojo y en éxito hace `router.replace(redirect || '/dashboard')`
- Router guard: revisado, no requiere cambios; el bug estaba en el store (rol sin renovar token → auto-signOut silencioso)
- Validación manual en navegador: credenciales erróneas muestran "Correo o contraseña incorrectos" en el recuadro rojo; consola limpia (solo los 400 esperados de Identity Toolkit)
- Router guard: eliminado el bloque que forzaba `{ name: 'dashboard' }` para toda ruta privada no llamada 'dashboard' (era el bug que impedía navegar a Zonas/Tarifas/etc. desde la barra lateral; la URL no cambiaba porque el guard devolvía un redirect en cada intento)
- Validado: `/zonas` sin sesión → redirige a `/login` (guard funcionando); con sesión debe navegar normal
- Build web OK

**Pendiente:**
- Probar login con credenciales reales (usuario debe validar en su teléfono Android)
- Smoke test UI (`scripts/ui-smoke-test.js`) con 4 expectativas desactualizadas: espera redirect de `/` a `/login` sin sesión, botón "Continuar con Google" (el login actual es solo email) y texto del landing; no son regresiones del fix de login
- Confirmar en consola Firebase si hay plan Blaze / funciones desplegadas (dato no visible desde el repo)
- Soporte de emuladores para Auth/Firestore en el cliente web (conectar `connectAuthEmulator`/`connectFirestoreEmulator` en `firebase.js` si se opta por modo emulador)

**Problemas conocidos:**
- (previos, ver sesión 1 abajo)
- Desincronización de rol en datos reales: `customClaims.role = 'superadmin'` (Auth) vs `users/{uid}.role = 'passenger'` (Firestore) para `todoobraparabien1998@gmail.com`. El código ahora prioriza el claim del token (diseño correcto); el doc de Firestore queda desincronizado como espejo — alinearlo desde la vista Administradores o escribir el doc manualmente si se desea

## 2026-11-06
**Completado:**
- Limpieza profunda del monorepo: eliminados archivos Next.js/React/Mapbox/Supabase
- Consolidación de variables de entorno (11 → 3 archivos: `.env`, `.env.production`, `.env.example`)
- Migración `NEXT_PUBLIC_*` → `VITE_*` en frontend, sin prefijo en servidor
- Configuración única `firebase.json` con hosting + functions + emuladores
- Documentación actualizada: `CLAUDE.md`, `AGENTS.md`, `README.md`, `apps/mobile/README.md`, `docs/DEPLOY.md`
- Eliminadas 14 skills obsoletas (Expo, Mapbox, Next.js, React Native, etc.)
- Tests pasando: 48/48 (API 18/18, roles 8/8, UI 13/13, hosting 9/9)
- Build web OK, Dart analyze sin incidencias
- `check-local-mode.js`: 36/36 verificaciones pasando
- Merge a rama `Jose` y push a GitHub exitoso
- Fix Node.js version: `functions/package.json` engines.node 24 → 20 (alineado con `firebase.json` runtime `nodejs20`)

**Pendiente:**
- Eliminar 14 skills obsoletas de `.agents/skills/`
- Instalar 5 nuevas skills (flutter-dart-code-review, frontend-design, z-audit, Flutter agent-plugins, claude-legal-skill)
- Auditar `firebase/firestore.rules` y custom claims con nueva skill `z-audit`
- Crear página `/terminos` con `unplugin-vue-markdown`
- Implementar notificaciones FCM (solo token en Flutter, envío desde Cloud Functions)
- Cloud Functions para trips (validación geocerca + notificaciones)
- Agregar `GOOGLE_WEB_SERVICES_KEY_IOS` en `apps/mobile/.env`
- Validar iOS API Key en móvil
- Hardening: deshabilitar 16 APIs sin uso, bajar cuotas Cloud Run/Build

**Problemas conocidos:**
- `apps/mobile/.env` falta `GOOGLE_WEB_SERVICES_KEY_IOS` (iOS rechazará clave Android)
- `firebase.json` runtime `nodejs20` vs `functions/package.json` engines.node `24` → ya corregido a 20
- Rama `limpieza-vue-migracion` fusionada, se puede borrar

---