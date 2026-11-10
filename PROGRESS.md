# Progress Log

## 2026-11-10 (Sesión 12: limpieza global de extensiones de VS Code)

**Completado:**
- Auditoría con `code --list-extensions`: 177 extensiones instaladas, 30 clasificadas como MANTENER y 147 como ELIMINAR
- `scripts/uninstall-unused-vscode-extensions.ps1`: lista de los 147 IDs agrupada por categoría, con detección de la CLI, aborto si VS Code está abierto y resumen de fallos (sintaxis verificada con el parser de PowerShell, 0 errores)
- Verificación por diferencia de conjuntos: ningún ID de ELIMINAR empieza por vue/dart/flutter/firebase/tailwind/eslint/prettier
- `.vscode/extensions.json`: 6 recomendaciones (Volar, Tailwind, ESLint, Prettier, Flutter, OpenCode) y 12 `unwantedRecommendations`

**Pendiente:**
- Ejecutar el script con VS Code cerrado (lo ejecuta el usuario)
- Volver a medir con `code --status` después de la limpieza

**Problemas conocidos:**
- Se conservan las 6 extensiones de IA por decisión del usuario; Gemini Code Assist (266 MB) y el agent-host de Copilot (264 MB) siguen siendo el mayor coste restante
- No hay extensión oficial de Firebase instalada; el flujo del repo usa la CLI (`npm run deploy:*`)

## 2026-11-10 (Sesión 11: consumo de memoria de VS Code)

**Completado:**
- Medición con `code --status` + recorrido del árbol de procesos: 4.24 GB en total (2.91 GB solo de `Code.exe`; el resto son procesos hijos java, dart, cloudcode_cli y copilot-runtime)
- Causa raíz identificada: la extension host y sus servidores, no los language servers de TypeScript (no había `tsserver` ni JDT activos)
- Desglose: extension host 799 MB + Gemini a2a 266 + Cloud Code CLI 279 + Gradle (server 193 + daemon 226) + Dart/Flutter (LS 246 + daemon 120 + tooling 50 + devtools 49) + Tailwind 123 + SQLTools 120 + gutter-preview 113 + JSON LS 104; aparte el agent-host de Copilot (264)
- `.vscode/settings.json`: `files.watcherExclude` (15 patrones), `search.exclude` (11), `files.exclude` (7), `search.followSymlinks=false`, `dart.analysisExcludedFolders`, `tailwindCSS.files.exclude`, `typescript.disableAutomaticTypeAcquisition`, `git.autofetch=false`, minimap desactivado
- Descartado `dart.onlyAnalyzeProjectsWithOpenFiles`: deprecado en dart-code 3.146.0 y desaconsejado por el fabricante

**Pendiente:**
- Desactivar por workspace las extensiones que suman ~1.5 GB (Gemini Code Assist, Google Cloud Code, Gradle, SQLTools, gutter-preview) mediante un perfil de VS Code; requiere decisión del usuario
- Medir tras recargar la ventana y tras un ciclo completo de `flutter analyze`

**Problemas conocidos:**
- `files.exclude` oculta `node_modules`, `dist` y `.gradle` del explorador; los archivos siguen accesibles por ruta, Ctrl+P e "Ir a definición"
- Las exclusiones no liberan memoria ya ocupada en la sesión abierta: requieren recargar la ventana

## 2026-11-10 (Sesión 10: rendimiento móvil + CI de APK)

**Completado:**
- Auditoría de rendimiento en `driver_home_screen.dart`:
  - Feed de oportunidades migrado de `SingleChildScrollView` + `Column` + `.map().toList()` (renderizaba las 20 tarjetas) a `ListView.builder` con altura acotada (160-300 px).
  - `_resolveTripInfos` ahora resuelve tarifas en paralelo (`Future.wait`) y con cache por `trip.id`; se añadió cache de zona por celda de ~110 m (`_zoneCache`) y descarte de respuestas obsoletas (`_resolveSeq`).
  - Ruta del viaje activo: se recalcula solo si cambia estado/pickup/dropoff; el stream de GPS ya no dispara Directions cada 10 m (throttle 25 s + guard `_loadingRoute`).
  - `onError` en los streams de Firestore (antes un error de red quedaba sin manejar).
  - Distancia conductor→recogida calculada por tarjeta visible con `Geolocator.distanceBetween`.
- `passenger_home_screen.dart`: `dispose()` cancela streams antes de liberar `ValueNotifier`; revalidación de zona limitada a 1 consulta cada 6 s; la verificación de `profile_completed` espera el perfil si el provider aún carga.
- `.github/workflows/build_apk.yml`: build de APK universal en Ubuntu con Java 17 + Flutter stable, inyección de `google-services.json` (secret `GOOGLE_SERVICES_JSON`) y `.env` (secret `MOBILE_ENV_B64`), artifact `carsigo-apk`. Disparadores: `workflow_dispatch` y push a `main`.
- `flutter analyze`: No issues found.

**Hallazgos pendientes (no aplicados):**
- `assets/sub1.png` y `assets/sub3.png` pesan 1.24 MB cada uno y no se referencian en `lib/`: candidatos a eliminar (2.5 MB del APK).
- El build de CI usa la firma debug (`signingConfig = signingConfigs.getByName("debug")`); para distribuir hay que crear keystore y `key.properties`.
- `gradle.properties` vuelve a `-Xmx1024m` para que el build local no muera por Metaspace en equipos con poca RAM; el build oficial se hace en CI.

## 2026-11-09 (SesiÃ³n 9: fixes estructurales de tarifas)

**Completado:**
- FIX 1 (doble horario): `TarifasView.save()` para turnos ahora sincroniza `start_time`/`end_time` = `shift_start`/`shift_end` Y `window_label` = `shift_label` (el motor lee con preferencia por los primeros; antes los cambios de horario desde la web eran ignorados)
- FIX 2 (festivos): ejecutado `scripts/cleanup-dynamic-pricing.mjs --apply` â€” borrados 4 docs duplicados/solapados (rangos date_range de Semana Santa 3-10abr, Carnaval 19-22feb, Fiestas patronales 14jul-18ago, y "18 Jul" redundante). Creada la regla faltante "Semana Santa Jueves" (2026-04-02, specific_date x1.3). Resultado: 9 reglas activas, 1 por festivo-dÃ­a, todas annual-recurring
- FIX 3 (techos visibles y editables): `ZonasView` â€” secciÃ³n "Techos por distancia (rings)" en el detalle de zona (tabla max_km/car/moto) + modal de ediciÃ³n (aÃ±adir/eliminar anillos, orden ascendente automÃ¡tico al guardar porque el motor corta en el primer ring que alcanza la distancia), guarda vÃ­a `zonesService.update`
- FIX 4 (campos muertos ocultos): modal de tarjeta reduce a los campos que el motor consume (nombre, vehÃ­culo, base, mÃ­nimo, km incluidos, comisiÃ³n, tiers 1/2, zona); eliminados price_per_km/price_per_minute/waiting del modal y del `emptyCard()` (los docs existentes conservan sus valores legacy; al editar se preservan por merge)
- Build OK

**Notas:**
- `geofences.rings` es editable ahora desde el panel; reglas: geofences write = isAdmin (OK para admin)
- Script cleanup es re-ejecutable (dry-run por defecto), guardas de identidad por doc

## 2026-11-09 (SesiÃ³n 8: parches de seguridad V1/M1/M2/M4)

**Completado (solo cÃ³digo local; sin tocar producciÃ³n):**
- FIX 1 (V1, BOLA): `GET /api/admin/users/:uid` ahora exige `requireAuth, requireAdmin` â€” un passenger/driver ya no puede leer perfiles de otros vÃ­a Admin SDK
- FIX 2 (M2): 401 de `verifyIdToken` sin `detail: error.message` â€” solo "Token invÃ¡lido o expirado" (el detalle del verifier solo ayuda al atacante)
- FIX 3 (M1): `app.set('trust proxy', 1)` ya existÃ­a en app.js; fix real en `middleware/rate-limit.js` â€” `clientKey()` ahora usa `req.ip` (primer hop NO confiable con trust proxy) en vez del primer valor de `x-forwarded-for` (spoofable por el cliente)
- FIX 4 (M4): `storage.rules` â€” `driver_documents` valida ademÃ¡s `request.resource.contentType.matches('image/')`
- ValidaciÃ³n: `npm run test:api` 8/8 OK suite del endpoint de roles

**Pendiente de deploy (producciÃ³n, requiere ejecuciÃ³n del usuario):**
- `firebase deploy --only storage:rules` para que FIX 4 aplique en producciÃ³n
- Los fixes 1-3 son de la Admin API: aplican en `next deploy` de functions/api (Cloud Run) â€” no afectan al panel web
- Diferido por decisiÃ³n del usuario: V2 (rate limit distribuido con Redis) y M3 (lÃ­mites de viajes en reglas)

## 2026-11-09 (SesiÃ³n 7: auditorÃ­a de seguridad + rediseÃ±o del Home)

**Completado:**
- AuditorÃ­a de seguridad (solo lectura) con los skills disponibles (`firebase-security-rules-auditor`, `api-security-best-practices`; los skills `z-audit` y `frontend-design` no existen en este entorno). Hallazgos clave, order por severidad:
  - Mayor: `GET /api/admin/users/:uid` solo exige `requireAuth` â€” cualquier usuario autenticado (passenger/driver) puede leer perfil Auth + doc users de CUALQUIER uid vÃ­a Admin SDK (ignora reglas). DeberÃ­a ser `requireAdmin` o self-only
  - Mayor/moderada: rate limit en memoria por proceso â€” en Cloud Run multi-instancia se pueden eluder escalando rÃ©plicas; migrar a Redis o capa LB (Cloud Armor)
  - Moderada: `clientKey()` usa el primer IP de `x-forwarded-for` (spoofable); usar la Ãºltima IP confiable con `trust proxy` correcto
  - Moderada: `trips` create por pasajero sin lÃ­mite de tamaÃ±o/tarifa (strings sin `size()` checks, sin lÃ­mite de viaje activo por pasajero)
  - Menor: `detail: error.message` en 401s de auth.js filtra detalles del verificador de tokens
  - Menor: storage `driver_documents` valida tamaÃ±o/extensiÃ³n del fileName pero no `request.resource.contentType`
  - Positivo: reglas de geofences/rate_*/dynamic_pricing_rules usan claim `role` (no user data); users.create fuerza `role == 'passenger'` con hasOnly; trips update/create con diff+hasOnly y ownership; storage con whitelist de nombres y 8MB; .env gitignored y service account FUERA del repo (Downloads); frontend sin secretos (solo config pÃºblica Web SDK + Maps key con restricciÃ³n referrer)
- HomeView.vue rediseÃ±ado: landing dark mode (neutral-950 + resplandor radial carsigo), hero con badge "Hiperlocal Â· El Carmen de BolÃ­var", CTA grande a /login, grid de 4 caracterÃ­sticas (geofences, tarifas por zona, precio dinÃ¡mico, operaciÃ³n protegida), footer con enlace a /terminos
- terms: nueva vista TermsView.vue + ruta pÃºblica /terminos en el router (el footer no apunta a 404)
- Build OK

## 2026-11-09 (SesiÃ³n 6: Tarifas y Precios DinÃ¡micos funcionales)

**Completado:**
- Fix crÃ­tico de correlaciÃ³n zonaâ†”tarifas: `rate_cards/rate_schedules/dynamic_pricing_rules.zone_id` guardan el SLUG (`el-carmen-de-bolivar`), no el doc id de geofences; `TarifasView`/PrecioDinamico usaban doc id como value del selector (solo funcionaba de casualidad con 1 zona). Ahora `listZones()` devuelve `{id, slug, municipality_name, is_active}` y las vistas usan `zoneKey(z) = z.slug || z.id` para selector, filtrado y `zoneName()`; fallback en `getAll().defaultZoneId` tambiÃ©n por slug
- `firestore.js`: helper `describeFirestoreError()` â€” traduce FirestoreError a banner accionable: `failed-precondition` â†’ extrae URL de creaciÃ³n de Ã­ndice del mensaje del SDK (`https://console.firebase.google.com/...create_index=...`); `permission-denied` â†’ mensaje de reglas
- `TarifasView.vue`: banner de error con enlace "Crear Ã­ndice en Firebase Console"; modal de tarjeta ahora incluye `price_per_km` y `price_per_minute` (campos reales verificados en producciÃ³n); selector/tabla filtrado por slug
- `PrecioDinamicoView.vue`: aÃ±adido selector de zona ("Todas las zonas" + por slug), `visibleRules` con filtro, banner de error igual; "Nueva regla" hereda la zona del filtro; estratÃ©gia de estados vacÃ­os (aviso si no hay zonas)
- Datos de producciÃ³n verificados (solo lectura): rate_cards tiene price_per_km/price_per_minute (0 en la maestra), dynamic_pricing_rules ya tiene reglas para `cartagena-de-indias` y `el-carmen-de-bolivar` (specific_date x1.3)
- Build OK

**Notas:**
- `rate_schedules` (turnos por dÃ­a/hora con `hourly_increase_percent`) se administran en la pestaÃ±a "Turnos y horarios" de Tarifas; por diseÃ±o no se duplican en Precio DinÃ¡mico
- OdÃ©n por mÃºltiples campos sin `where` no requiere Ã­ndice compuesto; las consultas actuales de las vistas no deberÃ­an disparar `failed-precondition`, pero el banner cubre el caso (los filtros futuros con where+orderBy sÃ­ lo necesitarÃ¡n)

## 2026-11-09 (SesiÃ³n 5: lÃ³gica definitiva de Zonas â€” clonaciÃ³n de tarifas y borrado en cascada)

**Completado:**
- AnÃ¡lisis Fase 1 (sin tocar cÃ³digo): la "lÃ­nea azul" era `COLORS.selected` (#3b82f6) en `ZoneMap.renderZones()` + auto-select `selectZone(data[0].id)` en `ZonasView.load()`. RelaciÃ³n zonaâ†”tarifas verificada en PRODUCCIÃ“N con Admin SDK (solo lectura): `rate_cards.zone_id`, `rate_schedules.zone_id` y `dynamic_pricing_rules.zone_id` = **slug** de la zona (`el-carmen-de-bolivar`, doc geofences `17oKw6fEKDE7vkHZkHwe`, boundary 1512 pts, boundaries GeoJSON string, rings 4)
- `services/firestore.js`: aÃ±adidos `cloneZoneTariffs()` (clona rate_cards+rate_schedules+dynamic_pricing_rules de zona maestraâ†’nueva con writeBatch, chunks de 500), `deleteZoneCascade()` (borra geofence + tarifas del slug en batch(s) atÃ³mico), `countZoneTariffs()` (getCountFromServer)
- `services/data.js`: aÃ±adidos `slugifyName()` ('El Carmen De BolÃ­var'â†’'el-carmen-de-bolivar'), `MASTER_ZONE_SLUG` y `createZoneWithTariffs()` (valida duplicado por nombre normalizado, crea geofence con slug + boundaries GeoJSON + boundary array para la mÃ³vil, clona tarifas de la maestra); `zonesService` +`removeCascade`/`countTariffs`, -`create` (flujo viejo de dibujo)
- `ZoneMap.vue` reescrito definitivo: SIN polÃ­gonos de zona ni azul (`#3b82f6` eliminado); mapa pinta municipios vÃ­a `map.data`: verde `is_active:true` / gris `is_active:false` / invisible sin geofence (`syncZoneStyles()` con flag `zoneStyled`, re-sync con watch de props.zones); bÃºsqueda exige match Ãºnico (avisa si hay N coincidencias); botÃ³n "Agregar zona: {name}" emite `create-zone` con `{municipality_name, official_name, boundaries (GeoJSON string), boundary (array anillo exterior)}` via `featureToPayload()`; sin Geocoder ni dibujo manual; `gm_authFailure` escuchado
- `ZonasView.vue` reescrito: eliminados auto-select (sin azul al cargar), modal de creaciÃ³n manual, modo dibujo (`startDrawing`/`openNewZone`/`draftPath`/`addVertex`/`cancelDrawing`/`openCreateForm`/`saveDraftZone`) y props/eventos `selectedId`/`draftPath`/`drawing`/`select-zone`/`add-vertex`; `@create-zone` â†’ `createZoneWithTariffs` (toast con counts de tarifas clonadas); ConfirmDialog "Al eliminar esta zona, se eliminarÃ¡n tambiÃ©n sus tarifas asociadas. Â¿EstÃ¡s seguro?" y `confirmDelete` â†’ `zonesService.removeCascade(id, slug)` con toast de counts
- `services/google-maps.js`: eliminados helpers muertos del flujo viejo (`isMapsConfigured`, `pathsToGeoJson`, `geoJsonToPaths`, `centerOf`); queda `getMapsApiKey` + `loadGoogleMaps`
- Build OK (`npm run build`)

**Integridad garantizada:**
- NO se toca el doc `el-carmen-de-bolivar` ni sus tarifas: la app mÃ³vil lee `boundary` (array {lat,lng}) y `slug` (zone_service.dart / pricing_engine.dart), campos intactos
- El borrado en cascada SOLO elimina tarifas con `zone_id == slug` de la zona eliminada; las de la maestra y de otras zonas no se tocan
- La creaciÃ³n con match Ãºnico genera el `boundary` array desde el anillo exterior del GeoJSON (la mÃ³vil funciona con nuevos municipios sin cambios)

**Pendiente de validaciÃ³n del usuario:**
- Probar en Brave: crear "San Jacinto" (verificar clonaciÃ³n con slug `san-jacinto` y colores verde/gris en mapa) y luego eliminarla (verificar cascada sin afectar a la maestra)
- Validar en producciÃ³n que la app mÃ³vil sigue resolviendo precios para `el-carmen-de-bolivar`

**Fix posterior (bug reportado por usuario: botÃ³n "Agregar zona" no hacÃ­a nada):**
- Root cause night: `featureToPayload` llamaba `feature.toObject()`, mÃ©todo que NO existe en `google.maps.Data.Feature` â†’ TypeError sÃ­ncrono en el click handler ANTES del `emit('create-zone')` â†’ flujo muerto silencioso
- Fix: `geometryToGeoJson()` extrae coordenadas de forma sÃ­ncrona con `feature.getGeometry().getArray()` (Polygon/MultiPolygon, LatLngâ†’[lng,lat]); `decimateRing()` limita los anillos a 4000 vÃ©rtices (DANE llega a ~70k; documento Firestore = mÃ¡x 1MB) para `boundary` (array mÃ³vil) y `boundaries` (string)
- Luces de emergencia: logs numerados 1-6 en `createZoneWithTariffs` (data.js: inicio, slug validado con regex `[a-z0-9-]+`, sin duplicados, geofence creado, clonando tarifas, tarifas clonadas); try/catch + `console.error('ERROR...')` + toast en `emitCreateZone` (ZoneMap) y `handleCreateZone` (ZonasView)
- Reglas Firestore verificadas: `allow write: if isAdmin()` en geofences/rate_cards/rate_schedules/dynamic_pricing_rules (C:\projects\carsigo-admin\firebase\firestore.rules lÃ­neas 101-116) â€” cubren create/batch si el token trae rol admin|superadmin
- Build OK

## 2026-11-09 (SesiÃ³n 4: silueta real de municipios con GeoJSON)

**Completado:**
- Fuentes GeoJSON: descargado `geoBoundaries-COL-ADM2_simplified.geojson` (DANE vÃ­a geoBoundaries/OCHA, CC BY 4.0) a `apps/admin-web/public/geo/colombia-municipios.geojson` (10 MB, 1122 municipios, propiedad `shapeName` del DANE; el gist de john-guerra es TopoJSON y no sirve para `map.data`)
- `ZoneMap.vue` refactor: capa `map.data` con `setStyle` (verde translÃºcido, `clickable: false` para no robar clicks a los polÃ­gonos de zonas), `loadGeoJson` con promesa squash para la bÃºsqueda; buscador ahora RECORRE el GeoJSON (`map.data.forEach`), compara `shapeName` normalizado (sin acentos) con jerarquÃ­a exactoâ†’empezar-porâ†’contener, resalta con `map.data.overrideStyle` y encuadra `map.fitBounds` con bounds reales del feature. El Geocoder quedÃ³ ELIMINADO del componente (dibujar con viewport era incorrecto: no es la silueta)
- `ZonasView.vue` limpieza: eliminado el "Buscador de zonas" del encabezado que no filtraba nada (y su `searchQuery`/icono Search); queda un solo buscador functional (el del mapa) y un solo botÃ³n "Nueva zona"
- ValidaciÃ³n end-to-end en navegador real: carga de `1122` features OK, bÃºsqueda "el carmen de bolivar" â†’ exacta `["El Carmen De BolÃ­var"]` con bounds OK y fitBounds ejecutado; "cartagena" â†’ `["Cartagena De Indias","Cartagena Del ChairÃ¡"]`; build OK

**Notas tÃ©cnica:**
- El GeoJSON de 10 MB se sirve estÃ¡tico desde `public/` (Vite dev, Firebase Hosting en prod); primera carga lenta, luego cache del navegador
- Nombres del DANE con mayÃºsculas internas ("El Carmen De BolÃ­var"): el normalizador quita acentos y baja a minÃºsculas para el emparejamiento

## 2026-11-09 (SesiÃ³n 3: migraciÃ³n Google Maps en Zonas)

**Completado:**
- `.env`: eliminada la clave duplicada de Maps. HabÃ­a DOS `VITE_GOOGLE_MAPS_KEY` (dotenv conserva la primera, o sea que el bundle usaba la clave vieja). Dejada solo la nueva: `AIzaSyCvqIGm4kHYXvylfdNhyYI-8QnbipFTCUw`
- `ZonasView.vue`: funciÃ³n explÃ­cita `openNewZone()` como Ãºnico punto de entrada del botÃ³n "Nueva zona"; valida `isMapsConfigured()` y muestra toast de error si falta la clave; confirmado que no queda botÃ³n flotante duplicado
- `ZoneMap.vue`: aÃ±adido listener global de `gm_authFailure` (Google disparar el evento cuando la API key es rechazada); muestra error claro en pantalla y consola
- DiagnÃ³stico empÃ­rico de REQUEST_DENIED (clave/restricciones): probe REST con ambas claves de Maps â†’ `REQUEST_DENIED: API keys with referer restrictions cannot be used with this API` (esperado: claves con restricciÃ³n por referrer NO sirven para la API REST, solo cliente JS). Probe real en navegador (origen http://localhost:5173, servicio de la app `/src/services/google-maps.js`) con `google.maps.Geocoder` callback â†’ `status: OK`, `Cartagena de Indias` con viewport. La app actual sirve con la clave `AIzaSyCtit5sux...` (restaurada en `.env`, sin conflicto de duplicados). El REQUEST_DENIED que veÃ­a el usuarioprovino de bundle viejo / prueba con REST, no del cÃ³digo actual: no hay fetch ni axios a Google en el frontend (rasterizado por grep); prueba del usuario debe repetirse tras reiniciar Vite
- `services/google-maps.js`: validaciÃ³n post-carga del loader (comprueba `typeof maps.Map === 'function'`; si falta, rechaza con error claro). Evita "maps.Map is not a constructor"
- `ZoneMap.vue`: reescrito con `await nextTick()` antes de instanciar el mapa, contenedor con alto garantizado (`h-full min-h-[600px]` sobre wrapper con altura explÃ­cita en `ZonasView`)
- Buscador de municipios con lupa sobre el mapa: Geocoding (`maps.Geocoder`, `region: 'co'`) â†’ `fitBounds(viewport)` + `Rectangle` verde sobre los bounds (reemplaza la "franja verde" de Mapbox), con limpiar y mensajes de error
- `ZonasView.vue`: eliminado el botÃ³n flotante duplicado de "Nueva zona" (queda solo el del encabezado); wrapper del mapa a `h-[600px] lg:h-[calc(100vh-16rem)]`
- `StatCard.vue`: prop `icon` ahora `[Object, Function]` (los iconos de lucide-vue-next son functional components, causaba el warning "Invalid prop: type check failed for prop 'icon'")
- Build web OK; app compila en HMR sin errores de consola ni warnings de props en la landing

**Pendiente:**
- Probar flujo completo de Zonas en Brave con sesiÃ³n real (renderizado del mapa, bÃºsqueda de "El Carmen de BolÃ­var", dibujo de zona, guardado)
- (de sesiones anteriores) probar login con credenciales reales; smoke test UI desactualizado; emuladores Auth/Firestore para modo local; alinear `users/{uid}.role`='passenger' en Firestore con el claim 'superadmin' si se quiere espejo consistente

## 2026-11-06 (SesiÃ³n 2: Fix login + App Check local + mapa)

**Completado:**
- App Check desactivado en DEV: `initAppCheck()` hace `return` temprano si `import.meta.env.DEV`; no intenta reCAPTCHA ni tokens
- `.env` raÃ­z: eliminada `VITE_RECAPTCHA_SITE_KEY` invÃ¡lida (34 chars, formato debug token, no site key v3)
- `ZoneMap.vue`: altura fija `height: 500px` en el contenedor del mapa para asegurar el renderizado de Google Maps
- Store `auth.js`: nueva acciÃ³n `login(email, password)` con manejo completo de errores; fuerza `getIdToken(true)` tras el sign-in para recoger custom claims (role); si el usuario no es admin, desloguea y lanza error claro; el alias `signInWithEmail` delega en ella
- Observador `onAuthStateChanged`: ahora renueva el token antes de validar el rol (evita kick en silencio por rol detectado como null)
- `LoginView.vue`: `errorMessage` reactivo local; el submit limpia el error, llama `authStore.login`, muestra el error en un `<p role="alert">` rojo y en Ã©xito hace `router.replace(redirect || '/dashboard')`
- Router guard: revisado, no requiere cambios; el bug estaba en el store (rol sin renovar token â†’ auto-signOut silencioso)
- ValidaciÃ³n manual en navegador: credenciales errÃ³neas muestran "Correo o contraseÃ±a incorrectos" en el recuadro rojo; consola limpia (solo los 400 esperados de Identity Toolkit)
- Router guard: eliminado el bloque que forzaba `{ name: 'dashboard' }` para toda ruta privada no llamada 'dashboard' (era el bug que impedÃ­a navegar a Zonas/Tarifas/etc. desde la barra lateral; la URL no cambiaba porque el guard devolvÃ­a un redirect en cada intento)
- Validado: `/zonas` sin sesiÃ³n â†’ redirige a `/login` (guard funcionando); con sesiÃ³n debe navegar normal
- Build web OK

**Pendiente:**
- Probar login con credenciales reales (usuario debe validar en su telÃ©fono Android)
- Smoke test UI (`scripts/ui-smoke-test.js`) con 4 expectativas desactualizadas: espera redirect de `/` a `/login` sin sesiÃ³n, botÃ³n "Continuar con Google" (el login actual es solo email) y texto del landing; no son regresiones del fix de login
- Confirmar en consola Firebase si hay plan Blaze / funciones desplegadas (dato no visible desde el repo)
- Soporte de emuladores para Auth/Firestore en el cliente web (conectar `connectAuthEmulator`/`connectFirestoreEmulator` en `firebase.js` si se opta por modo emulador)

**Problemas conocidos:**
- (previos, ver sesiÃ³n 1 abajo)
- DesincronizaciÃ³n de rol en datos reales: `customClaims.role = 'superadmin'` (Auth) vs `users/{uid}.role = 'passenger'` (Firestore) para `todoobraparabien1998@gmail.com`. El cÃ³digo ahora prioriza el claim del token (diseÃ±o correcto); el doc de Firestore queda desincronizado como espejo â€” alinearlo desde la vista Administradores o escribir el doc manualmente si se desea

## 2026-11-06
**Completado:**
- Limpieza profunda del monorepo: eliminados archivos Next.js/React/Mapbox/Supabase
- ConsolidaciÃ³n de variables de entorno (11 â†’ 3 archivos: `.env`, `.env.production`, `.env.example`)
- MigraciÃ³n `NEXT_PUBLIC_*` â†’ `VITE_*` en frontend, sin prefijo en servidor
- ConfiguraciÃ³n Ãºnica `firebase.json` con hosting + functions + emuladores
- DocumentaciÃ³n actualizada: `CLAUDE.md`, `AGENTS.md`, `README.md`, `apps/mobile/README.md`, `docs/DEPLOY.md`
- Eliminadas 14 skills obsoletas (Expo, Mapbox, Next.js, React Native, etc.)
- Tests pasando: 48/48 (API 18/18, roles 8/8, UI 13/13, hosting 9/9)
- Build web OK, Dart analyze sin incidencias
- `check-local-mode.js`: 36/36 verificaciones pasando
- Merge a rama `Jose` y push a GitHub exitoso
- Fix Node.js version: `functions/package.json` engines.node 24 â†’ 20 (alineado con `firebase.json` runtime `nodejs20`)

**Pendiente:**
- Eliminar 14 skills obsoletas de `.agents/skills/`
- Instalar 5 nuevas skills (flutter-dart-code-review, frontend-design, z-audit, Flutter agent-plugins, claude-legal-skill)
- Auditar `firebase/firestore.rules` y custom claims con nueva skill `z-audit`
- Crear pÃ¡gina `/terminos` con `unplugin-vue-markdown`
- Implementar notificaciones FCM (solo token en Flutter, envÃ­o desde Cloud Functions)
- Cloud Functions para trips (validaciÃ³n geocerca + notificaciones)
- Agregar `GOOGLE_WEB_SERVICES_KEY_IOS` en `apps/mobile/.env`
- Validar iOS API Key en mÃ³vil
- Hardening: deshabilitar 16 APIs sin uso, bajar cuotas Cloud Run/Build

**Problemas conocidos:**
- `apps/mobile/.env` falta `GOOGLE_WEB_SERVICES_KEY_IOS` (iOS rechazarÃ¡ clave Android)
- `firebase.json` runtime `nodejs20` vs `functions/package.json` engines.node `24` â†’ ya corregido a 20
- Rama `limpieza-vue-migracion` fusionada, se puede borrar

---
