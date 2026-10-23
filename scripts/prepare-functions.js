/**
 * Prepara las Cloud Functions para servir la Admin API.
 *
 * Copia el código de `apps/admin-api/src` a `functions/api-src/` (excluyendo
 * la carpeta de referencia `_legacy_next_api`, que es TypeScript de Next.js y
 * no debe compilarse) y genera `functions/src/index.ts` con la función HTTP.
 *
 * Motivo del copiado: el CLI de Firebase despliega únicamente la carpeta
 * `functions/`, así que la API debe estar dentro para poder compilarse
 * allí dentro.
 *
 * Uso:  node scripts/prepare-functions.js
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const SRC = path.join(ROOT, 'apps/admin-api/src')
const DEST = path.join(ROOT, 'functions/api-src')
const FUNCTIONS_SRC = path.join(ROOT, 'functions/src')

// ── 1. Copia el código de la API ──────────────────────────────────────────
function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true })
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (entry.name === '_legacy_next_api' || entry.name === 'node_modules') continue
    const src = path.join(from, entry.name)
    const dst = path.join(to, entry.name)
    if (entry.isDirectory()) copyDir(src, dst)
    else fs.copyFileSync(src, dst)
  }
}

fs.rmSync(DEST, { recursive: true, force: true })
copyDir(SRC, DEST)

// ── 1.b Hash del código de la API ────────────────────────────────────────
// El CLI de Firebase calcula el hash de "cambio" sobre la DEFINICIÓN de la
// función (trigger + opciones), no sobre el contenido de los archivos. Por eso
// un cambio interno en la API no dispara un redeploy y la función sigue
// sirviendo la versión anterior.
//
// Se aplica ese hash como etiqueta de la función: al cambiar el código,
// cambia la definición y el CLI detecta que hay algo nuevo que desplegar.
const hash = crypto
  .createHash('sha256')
  .update(
    fs
      .readdirSync(DEST, { recursive: true })
      .filter((f) => fs.statSync(path.join(DEST, f)).isFile())
      .sort()
      .map((f) => `${f}:${fs.readFileSync(path.join(DEST, f), 'utf8')}`)
      .join('\n'),
  )
  .digest('hex')
  .slice(0, 12)

// ── 2. Genera la función HTTP ────────────────────────────────────────────
const indexTs = `/**
 * Cloud Function HTTP que expone la CarSiGo Admin API (Express).
 *
 * El código de la API vive en \`apps/admin-api\` y se copia a \`api-src/\`
 * antes de compilar (ver scripts/prepare-functions.js). Cloud Functions
 * despliega únicamente el contenido de esta carpeta.
 */
import { onRequest } from 'firebase-functions/https'
import { setGlobalOptions } from 'firebase-functions'
import { createApp } from '../api-src/app.js'

setGlobalOptions({ maxInstances: 10, region: 'us-central1' })

const app = createApp()

/**
 * GET/POST/PATCH /api/** -> Admin API
 */
export const adminApi = onRequest(
  {
    region: 'us-central1',
    // Invocación pública: el rewrite de Firebase Hosting no envía un
    // header Authorization, así que la función debe ser alcanzable.
    // La seguridad real la aporta la API: cada endpoint sensible valida
    // el Bearer token y el custom claim del rol.
    invoker: 'public',
    // Hash del código de la API. Fuerza al CLI de Firebase a detectar el
    // cambio y desplegar, porque por defecto solo compara la definición
    // de la función (no su implementación interna).
    labels: { 'api-build': '${hash}' },
    // Cuenta de servicio con permisos plenos de Firebase Admin
    // (Firestore, Auth y Storage). Requerida porque la API usa el Admin SDK.
    serviceAccount: 'firebase-adminsdk-fbsvc@carsigo-9e508.iam.gserviceaccount.com',
  },
  app,
)
`

fs.mkdirSync(FUNCTIONS_SRC, { recursive: true })
fs.writeFileSync(path.join(FUNCTIONS_SRC, 'index.ts'), indexTs, 'utf8')

const count = fs.readdirSync(DEST, { recursive: true }).filter((f) =>
  fs.statSync(path.join(DEST, f)).isFile(),
).length

console.log(`  ✓ ${count} archivos de la API copiados a functions/api-src/`)
console.log(`  ✓ functions/src/index.ts generado`)
console.log(
  `  ℹ  Recordatorio: el deploy real es "npm run deploy:prod:functions" (exige confirmación).`,
)
