/**
 * Inventario de qué cambios del "modo local" siguen aplicados tras la
 * restauración desde git.
 *
 * Uso:  node scripts/check-local-mode.js
 */
import fs from 'node:fs'

const checks = [
  // ── Paso 5: repo en modo local ──
  ['package.json', 'sin script "deploy"', (t) => !/"deploy":\s*"/.test(t)],
  ['package.json', 'sin script "deploy:hosting"', (t) => !/"deploy:hosting":\s*"/.test(t)],
  ['package.json', 'script "deploy:prod"', (t) => /"deploy:prod":/.test(t)],
  ['package.json', 'script "quarantine:hosting"', (t) => /"quarantine:hosting":/.test(t)],
  ['firebase.json', 'sin bloque "hosting"', (t) => !/"hosting"/.test(t)],
  ['firebase.json', 'sin bloque "functions"', (t) => !/"functions"/.test(t)],
  ['firebase.prod.json', 'existe con hosting+functions', (t) => /"hosting"/.test(t) && /"functions"/.test(t)],
  ['firebase.local.json', 'existe con emulators', (t) => /"emulators"/.test(t)],
  ['scripts/confirm-prod.js', 'existe', (t) => /CANCELADO/.test(t)],

  // ── Paso 8: higiene de .env ──
  ['.env.local', 'SIN FIREBASE_SERVICE_ACCOUNT', (t) => !/^FIREBASE_SERVICE_ACCOUNT=/m.test(t)],
  ['.env.seed', 'contiene FIREBASE_SERVICE_ACCOUNT', (t) => /^FIREBASE_SERVICE_ACCOUNT=/m.test(t)],

  // ── Auditoría de seguridad (debe seguir vigente) ──
  ['apps/admin-api/src/routes/trips.js', 'requireAuth en GET /', (t) => /router\.get\('\/', requireAuth/.test(t)],
  ['apps/admin-api/src/routes/trips.js', 'requireAuth en POST /', (t) => /router\.post\('\/', requireAuth/.test(t)],
  ['apps/admin-api/src/routes/drivers.js', 'requireAuth+requireAdmin', (t) => /requireAuth, requireAdmin/.test(t)],
  ['apps/admin-api/src/routes/zones.js', 'requireAuth', (t) => /router\.post\('\/check', requireAuth/.test(t)],
  ['apps/admin-api/src/routes/pricing.js', 'requireAuth', (t) => /requireAuth/.test(t)],
  ['apps/admin-api/src/routes/admin.js', 'requireSuperAdmin', (t) => /requireSuperAdmin/.test(t)],
  ['apps/admin-api/src/app.js', 'cabeceras de seguridad', (t) => /X-Content-Type-Options/.test(t)],
  ['apps/admin-api/src/app.js', 'rate limit global', (t) => /rateLimit/.test(t)],
  ['apps/admin-api/src/middleware/rate-limit.js', 'existe', (t) => /export function rateLimit/.test(t)],

  // ── Alojamiento local: .env.seed como fallback + aviso ──
  ['apps/admin-api/src/config.js', 'carga .env.seed', (t) => /\.env\.seed/.test(t)],
  ['apps/admin-api/src/config.js', 'exporta FIREBASE_PROJECT_ID', (t) => /export const FIREBASE_PROJECT_ID/.test(t)],
  ['apps/admin-api/src/index.js', 'aviso de produccion', (t) => /PRODUCCI/.test(t)],

  // ── Reglas corregidas ──
  ['firebase/storage.rules', 'isAdmin dentro de service', (t) => /service firebase\.storage \{[\s\S]*function isAdmin/.test(t)],
  ['firebase/firestore.rules', 'vocabulario inProgress', (t) => /'inProgress'/.test(t)],
  ['firebase/firestore.rules', 'limites de tamano', (t) => /name\.size\(\) <= 120/.test(t)],
]

let ok = 0
let fail = 0
for (const [file, label, test] of checks) {
  let content = null
  try {
    content = fs.readFileSync(file, 'utf8')
  } catch {
    console.log(`  ✗ ${file.padEnd(44)} ${label}  (fichero no existe)`)
    fail++
    continue
  }
  const good = test(content)
  if (good) ok++
  else fail++
  console.log(`  ${good ? '✓' : '✗'} ${file.padEnd(44)} ${label}`)
}

console.log(`\n  ${ok} aplicados · ${fail} pendientes de reaplicar\n`)
