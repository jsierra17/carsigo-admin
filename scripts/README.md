# Scripts

Utilidades de línea de comandos del monorepo.

---

## `geofence-builder.js`

Genera el polígono de **área de servicio** de una zona a partir de:

- un círculo para el **casco urbano** (radio configurable), y
- el **buffer de N metros** alrededor del eje de cada **corredor vial**, usando la
  polilínea real de la Google Directions API.

### Uso

```bash
node scripts/geofence-builder.js                  # genera y muestra el resultado
node scripts/geofence-builder.js --write          # actualiza Firestore
node scripts/geofence-builder.js --corridor=cansona
```

### Variables de entorno
| Variable | Descripción |
|---|---|
| `GOOGLE_WEB_SERVICES_KEY` | API key de Google Maps (Directions/Geocoding) |
| `FIREBASE_SERVICE_ACCOUNT` | Ruta al service account (necesaria con `--write`) |
| `ZONE_ID` | Documento de `geofences` a actualizar (por defecto el de El Carmen de Bolívar) |

### Salida
Genera `geofence_output.json` en la raíz (ignorado por git) con el formato que
consume `zone_service.dart` (Flutter) y el panel admin:

```json
{
  "boundary_array":   [{ "lat": 9.73, "lng": -75.11 }],
  "boundaries_geojson": "{\"type\":\"Polygon\", ...}",
  "urban_polygons_map": { "town": [...], "cansona": [...], ... }
}
```

- `boundary_array` → array de `{lat, lng}` (un anillo). Lo usa `contains()`.
- `boundaries_geojson` → GeoJSON en string. Lo dibuja el mapa del panel.
- `urban_polygons_map` → mapa de anillos por corredor. Lo usa `containsUrban()`
  para filtrar destinos permitidos.

### Modificar los corredores
Edita el objeto `CONFIG` al inicio del script: destino, waypoints (fuerzan el
recorrido por vías concretas) y el radio del casco urbano / el buffer.

> **Ojo con la distancia vial vs la geográfica:** Google Directions devuelve la
> distancia **por carretera**, que puede ser muy superior a la línea recta
> (p. ej. Cansona son ~42 km por vía frente a ~16 km en línea recta).

---

## `ui-smoke-test.js`

Prueba de humo del **panel admin en un navegador real** (Chromium/Edge vía
`playwright-core`). Levanta la Admin API y el dev server de Vite, carga la app y
verifica que el login se renderiza, que el router protege las rutas y que el
proxy `/api` funciona.

### Uso

```bash
npm run test:ui
```

### Qué comprueba (12 checks)

| Check | Qué valida |
|---|---|
| API Express arriba | `/health` responde |
| Vite arriba | el dev server sirve la app |
| La app carga | no hay pantalla en blanco |
| Redirige a `/login` | el guard de autenticación bloquea sin sesión |
| Logo visible | los assets se sirven |
| Botón de Google | el login con popup está montado |
| Formulario email + contraseña | los inputs del login |
| Renderiza contenido | el HTML tiene el título esperado |
| Proxy `/api` → API | el cliente HTTP del panel llega a la API |
| Sin errores de consola | ninguna excepción en el navegador |
| Sin errores de página | ningún `uncaught` |
| Sin peticiones fallidas | nada roto contra localhost |

### Notas
- Libera los puertos `5199`/`4199` antes de arrancar (mata instancias huérfanas).
- Si no tienes Edge/Chrome, ajusta la constante `EDGE` en el script.
- Requiere que el `.env` de la raíz tenga `VITE_FIREBASE_*`.

---

## Scripts de mantenimiento y seguridad

| Script | Para qué |
|---|---|
| `check-local-mode.js` | Verifica que el repo sigue en modo local (scripts de deploy, configs de Firebase, auth de la API, reglas). Imprime `N aplicados · M pendientes`. |
| `check-syntax.js` | Revisa la sintaxis de todos los `.js`/`.mjs` del repo. |
| `fix-mojibake.js` | Repara la doble codificación UTF-8 ("MÃ³dulo" en vez de "Módulo"). Sin argumentos: recorre todo el repo. |
| `restore-clean.js` | Restaura ficheros desde git eligiendo la versión sin mojibake (índice o HEAD). |
| `apply-local-scripts.js` | Reaplica los scripts de modo local al `package.json` raíz (quita `deploy`, añade `deploy:prod*` con guarda). |
| `apply-seed-env.js` | Normaliza la lista de ficheros de entorno que leen los scripts (`['.env', '.env.production']`). |
| `confirm-prod.js` | **Puerta de seguridad**: aborta el despliegue a producción salvo que se pase `CONFIRM_PROD=1` o `--yes`. |
| `unpublish-hosting.js` | Despublica el Hosting (borra releases y versions). Necesario porque el `DEFAULT_SITE` no se puede eliminar. Acepta `--dry-run`. |
| `infra-readonly-audit.js` | Inventario de infraestructura (APIs, Cloud Run, Artifact Registry, builds, schedulers). Solo peticiones GET. |
| `enable-apis.js` | Habilita las APIs de Google Cloud necesarias (run, cloudbuild, artifactregistry…). Se invoca con `npm run prod:enable:apis`. |
| `prepare-functions.js` | Copia `apps/admin-api/src` a `functions/api-src` e inyecta la etiqueta `api-build` (hash) para que el CLI detecte cambios internos. |

### Reglas de oro al editar ficheros de texto

**Nunca uses `Set-Content` / `Out-File` de PowerShell sobre ficheros UTF-8.**
PowerShell 5.1 las escribe con BOM y puede doble-codificar los acentos, lo que
rompe el build de Vite y las comparaciones de los tests.

Usa en su lugar:
- el editor del agente (escritura directa en UTF-8), o
- Node: `fs.writeFileSync(fichero, contenido, 'utf8')`.

Si ya se rompió, se arregla con:
```bash
node scripts/fix-mojibake.js            # todo el repo
node scripts/check-syntax.js            # verificar
```
