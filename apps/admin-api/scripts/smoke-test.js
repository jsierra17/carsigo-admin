/**
 * Prueba de humo de la Admin API.
 *
 * Levanta el servidor y ejercita los 5 endpoints core, COMPROBANDO que los
 * que devuelven PII o escriben en Firestore exigen un token de administrador
 * (la API usa el Admin SDK, que ignora las firestore.rules: sin este control
 * cualquiera podría leer o modificar viajes).
 *
 * Uso:  node scripts/smoke-test.js
 */
import { spawn } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const API_DIR = path.resolve(__dirname, '..')
const ROOT = path.resolve(API_DIR, '../..')
const PORT = process.env.SMOKE_PORT || '4124'
const BASE = `http://localhost:${PORT}`

// ── Credenciales ──────────────────────────────────────────────────────────
const env = {}
for (const envFile of ['.env', '.env.local', '.env.seed']) {
  const full = path.join(ROOT, envFile)
  if (!fs.existsSync(full)) continue
  for (const line of fs.readFileSync(full, 'utf8').split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#') || !line.includes('=')) continue
    const i = line.indexOf('=')
    const key = line.slice(0, i).trim()
    const value = line.slice(i + 1).trim().replace(/^["']|["']$/g, '')
    if (!(key in env)) env[key] = value
  }
}

const results = []
function check(name, ok, detail = '') {
  results.push({ name, ok, detail })
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? '  ->  ' + detail : ''}`)
}

// ── Token de administrador (para las pruebas autenticadas) ─────────────────
let adminToken = null
let nonAdminToken = null

async function mintToken(uid) {
  if (getApps().length === 0) {
    initializeApp({ credential: cert(JSON.parse(fs.readFileSync(env.FIREBASE_SERVICE_ACCOUNT, 'utf8'))) })
  }
  const auth = getAuth()
  const custom = await auth.createCustomToken(uid)
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: custom, returnSecureToken: true }),
    },
  )
  const body = await res.json()
  if (!res.ok) throw new Error(body?.error?.message || 'No se pudo obtener el token')
  return body.idToken
}

async function findUsers() {
  if (getApps().length === 0) {
    initializeApp({ credential: cert(JSON.parse(fs.readFileSync(env.FIREBASE_SERVICE_ACCOUNT, 'utf8'))) })
  }
  const list = await getAuth().listUsers(100)
  const superadmin = list.users.find((u) => u.customClaims?.role === 'superadmin')
  const other = list.users.find((u) => u.customClaims?.role !== 'superadmin')
  return { superadmin, other }
}

// ── Servidor ──────────────────────────────────────────────────────────────
const server = spawn(process.execPath, ['src/index.js'], {
  cwd: API_DIR,
  env: { ...process.env, ...env, PORT },
  stdio: ['ignore', 'pipe', 'pipe'],
})
let serverLog = ''
server.stdout.on('data', (d) => (serverLog += d))
server.stderr.on('data', (d) => (serverLog += d))

async function req(pathname, options = {}) {
  const res = await fetch(BASE + pathname, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  })
  const text = await res.text()
  let body
  try {
    body = JSON.parse(text)
  } catch {
    body = text
  }
  return { status: res.status, body }
}

async function waitForServer() {
  for (let i = 0; i < 40; i++) {
    try {
      if ((await fetch(`${BASE}/health`)).ok) return true
    } catch {
      /* reintento */
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  return false
}

async function main() {
  console.log('\n=== CarSiGo Admin API — prueba de humo ===\n')

  const up = await waitForServer()
  if (!up) {
    console.error('El servidor no levantó.\n' + serverLog)
    process.exit(1)
  }
  check('servidor arriba (/health)', true)

  // ── 0. Autorización (lo más importante) ────────────────────────────────
  const { superadmin, other } = await findUsers()
  adminToken = await mintToken(superadmin.uid)
  if (other) nonAdminToken = await mintToken(other.uid)

  const bearer = (t) => ({ Authorization: `Bearer ${t}` })

  const anonTrips = await req('/api/trips?limit=1')
  check(
    'GET /api/trips SIN token -> 401',
    anonTrips.status === 401,
    `status=${anonTrips.status}`,
  )

  const anonCreate = await req('/api/trips', {
    method: 'POST',
    body: JSON.stringify({
      passenger_id: 'ATACQUE',
      vehicle_type: 'car',
      pickup_address: 'x',
      dropoff_address: 'y',
      distance_km: 1,
    }),
  })
  check(
    'POST /api/trips SIN token -> 401',
    anonCreate.status === 401,
    `status=${anonCreate.status}`,
  )

  const anonPatch = await req('/api/trips/NOEXISTE', {
    method: 'PATCH',
    body: JSON.stringify({ status: 'completed' }),
  })
  check('PATCH /api/trips/:id SIN token -> 401', anonPatch.status === 401, `status=${anonPatch.status}`)

  const anonDrivers = await req('/api/drivers/nearby?lat=9.72&lng=-75.11')
  check('GET /api/drivers/nearby SIN token -> 401', anonDrivers.status === 401, `status=${anonDrivers.status}`)

  const anonZones = await req('/api/zones/check', {
    method: 'POST',
    body: JSON.stringify({ lat: 9.7205, lng: -75.1174 }),
  })
  check('POST /api/zones/check SIN token -> 401', anonZones.status === 401, `status=${anonZones.status}`)

  const anonPricing = await req('/api/pricing/estimate', {
    method: 'POST',
    body: JSON.stringify({ vehicle_type: 'car', distance_km: 8 }),
  })
  check(
    'POST /api/pricing/estimate SIN token -> 401',
    anonPricing.status === 401,
    `status=${anonPricing.status}`,
  )

  if (nonAdminToken) {
    const userTrips = await req('/api/trips?limit=1', { headers: bearer(nonAdminToken) })
    check(
      'GET /api/trips con token NO admin -> 403',
      userTrips.status === 403,
      `status=${userTrips.status}`,
    )
  }

  // ── 1. pricing/estimate (autenticado) ─────────────────────────────────
  const pricing = await req('/api/pricing/estimate', {
    method: 'POST',
    headers: bearer(adminToken),
    body: JSON.stringify({
      vehicle_type: 'car',
      distance_km: 8,
      zone_id: 'el-carmen-de-bolivar',
    }),
  })
  check(
    'POST /api/pricing/estimate (admin)',
    pricing.status === 200 && typeof pricing.body.final_fare === 'number',
    `status=${pricing.status} fare=${pricing.body?.final_fare} incl=${pricing.body?.included_km}`,
  )

  const pricingBad = await req('/api/pricing/estimate', {
    method: 'POST',
    headers: bearer(adminToken),
    body: JSON.stringify({ vehicle_type: 'patinete' }),
  })
  check('pricing/estimate valida vehicle_type', pricingBad.status === 400, `status=${pricingBad.status}`)

  // ── 2. drivers/nearby (admin) ─────────────────────────────────────────
  const drivers = await req('/api/drivers/nearby?lat=9.7205&lng=-75.1174&radius_km=10', {
    headers: bearer(adminToken),
  })
  check(
    'GET /api/drivers/nearby (admin)',
    drivers.status === 200 && Array.isArray(drivers.body),
    `status=${drivers.status} n=${Array.isArray(drivers.body) ? drivers.body.length : 'n/a'}`,
  )

  // ── 3. trips (admin) ──────────────────────────────────────────────────
  const tripsList = await req('/api/trips?limit=5', { headers: bearer(adminToken) })
  check(
    'GET /api/trips (admin)',
    tripsList.status === 200 && Array.isArray(tripsList.body),
    `status=${tripsList.status} n=${Array.isArray(tripsList.body) ? tripsList.body.length : 'n/a'}`,
  )

  const tripId = Array.isArray(tripsList.body) && tripsList.body[0]?.id
  if (tripId) {
    const one = await req(`/api/trips/${tripId}`, { headers: bearer(adminToken) })
    check('GET /api/trips/:id (admin)', one.status === 200 && one.body.id === tripId, `status=${one.status}`)
  }

  // ── 4. zones/check (admin) ────────────────────────────────────────────
  const zoneIn = await req('/api/zones/check', {
    method: 'POST',
    headers: bearer(adminToken),
    body: JSON.stringify({ lat: 9.7205, lng: -75.1174 }),
  })
  check(
    'POST /api/zones/check (dentro)',
    zoneIn.status === 200 && zoneIn.body.zone !== null,
    `status=${zoneIn.status} zona=${zoneIn.body?.zone?.municipality_name}`,
  )

  const zoneOut = await req('/api/zones/check', {
    method: 'POST',
    headers: bearer(adminToken),
    body: JSON.stringify({ lat: 4.711, lng: -74.0721 }),
  })
  check(
    'POST /api/zones/check (fuera)',
    zoneOut.status === 200 && zoneOut.body.zone === null,
    `status=${zoneOut.status}`,
  )

  // ── 5. roles (superadmin) ─────────────────────────────────────────────
  const noToken = await req(`/api/admin/users/${other?.uid || 'x'}/role`, {
    method: 'POST',
    body: JSON.stringify({ role: 'admin' }),
  })
  check('POST /api/admin/users/:uid/role sin token -> 401', noToken.status === 401, `status=${noToken.status}`)

  // ── 6. Cabeceras de seguridad y 404 ───────────────────────────────────
  const healthRes = await fetch(`${BASE}/health`)
  check(
    'cabeceras de seguridad presentes',
    healthRes.headers.get('x-content-type-options') === 'nosniff' &&
      healthRes.headers.get('x-frame-options') === 'DENY',
    `nosniff=${healthRes.headers.get('x-content-type-options')} frame=${healthRes.headers.get('x-frame-options')}`,
  )

  const missing = await req('/api/no-existe', { headers: bearer(adminToken) })
  check('ruta inexistente -> 404', missing.status === 404, `status=${missing.status}`)

  const failed = results.filter((r) => !r.ok)
  console.log(`\n=== Resultado: ${results.length - failed.length}/${results.length} OK ===\n`)
  if (failed.length) {
    console.log('Fallos:')
    failed.forEach((f) => console.log(`  - ${f.name} (${f.detail})`))
  }
  server.kill()
  process.exit(failed.length ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  server.kill()
  process.exit(1)
})
