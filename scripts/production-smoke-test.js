/**
 * Prueba de humo del panel contra PRODUCCIÓN (Firebase Hosting).
 *
 * Verifica en un navegador real que:
 *   - el panel carga desde https://carsigo-9e508.web.app,
 *   - el router redirige a /login (guard de autenticación),
 *   - el rewrite SPA resuelve rutas profundas,
 *   - el rewrite /api/** llega a la Cloud Function,
 *   - no hay errores de consola.
 *
 * Uso:  node scripts/production-smoke-test.js [url]
 */
import { chromium } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const BASE = process.argv[2] || 'https://carsigo-9e508.web.app'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'

// ── Token de administrador ────────────────────────────────────────────────
const env = {}
for (const file of ['.env.production', '.env']) {
  const full = path.join(ROOT, file)
  if (!fs.existsSync(full)) continue
  for (const line of fs.readFileSync(full, 'utf8').split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#') || !line.includes('=')) continue
    const i = line.indexOf('=')
    const key = line.slice(0, i).trim()
    const value = line.slice(i + 1).trim().replace(/^["']|["']$/g, '')
    if (!(key in env)) env[key] = value
  }
}

let adminToken = null
try {
  const { cert, getApps, initializeApp } = await import('firebase-admin/app')
  const { getAuth } = await import('firebase-admin/auth')
  if (getApps().length === 0) {
    initializeApp({ credential: cert(JSON.parse(fs.readFileSync(env.FIREBASE_SERVICE_ACCOUNT, 'utf8'))) })
  }
  const auth = getAuth()
  const list = await auth.listUsers(100)
  const superadmin = list.users.find((u) => u.customClaims?.role === 'superadmin')
  if (superadmin) {
    const custom = await auth.createCustomToken(superadmin.uid)
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${env.VITE_FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Referer: 'http://localhost:5173/' },
        body: JSON.stringify({ token: custom, returnSecureToken: true }),
      },
    )
    adminToken = (await res.json()).idToken || null
  }
} catch (e) {
  console.log(`  (aviso: sin token admin: ${e.message})`)
}

const results = []
function check(name, ok, detail = '') {
  results.push({ name, ok })
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? '  ->  ' + detail : ''}`)
}

async function main() {
  console.log(`\n=== Producción — ${BASE} ===\n`)

  const browser = await chromium.launch({
    executablePath: EDGE,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  const consoleErrors = []
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()))
  page.on('pageerror', (e) => consoleErrors.push(e.message))

  try {
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 })
    check('el panel carga', true, page.url())

    await page.waitForURL(/\/login/, { timeout: 20000 }).catch(() => {})
    check('redirige a /login sin sesión', page.url().includes('/login'), page.url())

    const body = await page.locator('body').innerText()
    check('renderiza el login', body.includes('Panel de administración'))
    check(
      'logo de CarSiGo visible',
      await page.locator('img[alt="CarSiGo"]').first().isVisible().catch(() => false),
    )

    // Rewrite SPA
    await page.goto(`${BASE}/zonas`, { waitUntil: 'networkidle', timeout: 60000 })
    check(
      'rewrite SPA: /zonas resuelve',
      page.url().endsWith('/zonas') && (await page.locator('body').innerText()).includes('Panel'),
      page.url(),
    )

    // La API exige token de administrador (Admin SDK ignora las rules).
    // Sin token DEBE responder 401; con token, 200 con datos reales.
    const anon = await page.evaluate(async (base) => {
      const res = await fetch(`${base}/api/pricing/estimate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicle_type: 'car', distance_km: 8 }),
      })
      return res.status
    }, BASE)
    check('rewrite /api/** rechaza sin token (401)', anon === 401, `status=${anon}`)

    const health = await page.evaluate(async (base) => {
      const res = await fetch(`${base}/api/health`)
      return { status: res.status, body: await res.text() }
    }, BASE)
    check(
      'rewrite /api/health responde',
      health.status === 200,
      `status=${health.status} ${health.body?.slice(0, 60)}`,
    )

    const pricing = await page.evaluate(async ({ base, token }) => {
      const res = await fetch(`${base}/api/pricing/estimate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ vehicle_type: 'car', distance_km: 8, zone_id: 'el-carmen-de-bolivar' }),
      })
      return { status: res.status, body: await res.json().catch(() => null) }
    }, { base: BASE, token: adminToken })
    check(
      'POST /api/pricing/estimate con token admin y datos reales',
      pricing.status === 200 && typeof pricing.body?.final_fare === 'number',
      `status=${pricing.status} fare=${pricing.body?.final_fare}`,
    )

    const zones = await page.evaluate(async ({ base, token }) => {
      const res = await fetch(`${base}/api/zones/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ lat: 9.7205, lng: -75.1174 }),
      })
      return { status: res.status, body: await res.json().catch(() => null) }
    }, { base: BASE, token: adminToken })
    check(
      'POST /api/zones/check resuelve la zona',
      zones.status === 200 && zones.body?.zone?.municipality_name === 'El Carmen de Bolívar',
      `zona=${zones.body?.zone?.municipality_name}`,
    )
  } catch (e) {
    check('sin excepciones durante la navegación', false, e.message)
  }

  const relevant = consoleErrors.filter(
    (e) => !/favicon|ERR_INTERNET|net::ERR_/i.test(e) && !/status of 401/i.test(e),
  )
  check('sin errores de consola', relevant.length === 0, relevant.slice(0, 2).join(' | '))

  await browser.close()

  const failed = results.filter((r) => !r.ok)
  console.log(`\n=== Resultado: ${results.length - failed.length}/${results.length} OK ===\n`)
  process.exit(failed.length ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
