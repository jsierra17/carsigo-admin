/**
 * Prueba de humo del panel admin en un navegador real (Chromium/Edge).
 *
 * Levanta el dev server de Vite y la Admin API, carga la app, verifica que
 * el login se renderiza y que no hay errores de consola.
 *
 * Uso:  node scripts/ui-smoke-test.js
 */
import { spawn, spawnSync } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const WEB_PORT = process.env.UI_WEB_PORT || '5199'
const API_PORT = process.env.UI_API_PORT || '4199'
const WEB_URL = `http://localhost:${WEB_PORT}`
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'

// ── .env de la raíz ────────────────────────────────────────────────────────
const env = {}
for (const file of ['.env', '.env.local', '.env.seed']) {
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

const results = []
function check(name, ok, detail = '') {
  results.push({ name, ok, detail })
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? '  ->  ' + detail : ''}`)
}

// ── Token de administrador (para probar la API autenticada) ────────────────
let adminToken = null
try {
  const { cert, getApps, initializeApp } = await import('firebase-admin/app')
  const { getAuth } = await import('firebase-admin/auth')
  if (getApps().length === 0) {
    initializeApp({ credential: cert(JSON.parse(fs.readFileSync(env.FIREBASE_SERVICE_ACCOUNT, 'utf8'))) })
  }
  const list = await getAuth().listUsers(100)
  const superadmin = list.users.find((u) => u.customClaims?.role === 'superadmin')
  if (superadmin) {
    const custom = await getAuth().createCustomToken(superadmin.uid)
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: custom, returnSecureToken: true }),
      },
    )
    const body = await res.json()
    adminToken = body.idToken || null
  }
} catch (e) {
  console.log(`  (aviso: no se pudo obtener token admin: ${e.message})`)
}

// ── Procesos ───────────────────────────────────────────────────────────────

/**
 * Libera los puertos que usa el test. Si quedó una instancia huérfana de
 * Vite o de la API de una corrida anterior, el test hablaría con ella y
 * mediría la configuración vieja.
 */
function freePort(port) {
  try {
    const out = spawnSync('netstat', ['-ano', '-p', 'TCP'], { encoding: 'utf8' })
    const pids = new Set()
    for (const line of (out.stdout || '').split(/\r?\n/)) {
      if (!line.includes(`:${port}`)) continue
      if (!/LISTENING/i.test(line)) continue
      const pid = line.trim().split(/\s+/).pop()
      if (pid && pid !== String(process.pid)) pids.add(pid)
    }
    for (const pid of pids) {
      spawn('taskkill', ['/pid', pid, '/f', '/t'], { stdio: 'ignore' })
    }
    if (pids.size) {
      console.log(`  (puerto ${port}: liberado ${[...pids].join(', ')})`)
    }
  } catch {
    /* best effort */
  }
}

freePort(WEB_PORT)
freePort(API_PORT)

const api = spawn(process.execPath, ['src/index.js'], {
  cwd: path.join(ROOT, 'apps/admin-api'),
  env: { ...process.env, ...env, PORT: API_PORT },
  stdio: ['ignore', 'pipe', 'pipe'],
})
let apiLog = ''
api.stdout.on('data', (d) => (apiLog += d))
api.stderr.on('data', (d) => (apiLog += d))

const web = spawn('npm', ['run', 'dev', '--workspace=@carsigo/admin-web', '--', '--port', WEB_PORT], {
  cwd: ROOT,
  env: {
    ...process.env,
    ...env,
    VITE_API_PROXY_TARGET: `http://localhost:${API_PORT}`,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
  shell: true,
})
let webLog = ''
web.stdout.on('data', (d) => (webLog += d))
web.stderr.on('data', (d) => (webLog += d))

async function waitFor(url, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url)
      if (res.ok) return true
    } catch {
      /* reintento */
    }
    await new Promise((r) => setTimeout(r, 700))
  }
  return false
}

async function main() {
  console.log('\n=== CarSiGo Admin Web — prueba en navegador ===\n')

  const apiUp = await waitFor(`http://localhost:${API_PORT}/health`)
  check('API Express arriba', apiUp, apiUp ? '' : apiLog.slice(-300))

  const webUp = await waitFor(WEB_URL)
  check('dev server de Vite arriba', webUp, webUp ? '' : webLog.slice(-300))

  if (!webUp) {
    console.error(webLog)
    cleanup()
    process.exit(1)
  }

  const browser = await chromium.launch({
    executablePath: EDGE,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()

  const consoleErrors = []
  const pageErrors = []
  const failedRequests = []

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => pageErrors.push(err.message))
  page.on('requestfailed', (req) => {
    const url = req.url()
    if (url.includes('localhost') || url.includes('127.0.0.1')) {
      failedRequests.push(`${req.method()} ${url} — ${req.failure()?.errorText}`)
    }
  })

  try {
    await page.goto(WEB_URL, { waitUntil: 'networkidle', timeout: 45000 })
    check('la app carga', true, page.url())

    // El router debe redirigir a /login (no hay sesión)
    await page.waitForURL(/\/login/, { timeout: 15000 }).catch(() => {})
    check('redirige a /login sin sesión', page.url().includes('/login'), page.url())

    // Elementos clave del login
    const hasLogo = await page.locator('img[alt="CarSiGo"]').first().isVisible().catch(() => false)
    check('logo visible en el login', hasLogo)

    const hasGoogleBtn = await page
      .locator('button', { hasText: 'Continuar con Google' })
      .first()
      .isVisible()
      .catch(() => false)
    check('botón de Google visible', hasGoogleBtn)

    const hasEmail = await page.locator('input[type="email"]').first().isVisible().catch(() => false)
    const hasPassword = await page.locator('input[type="password"]').first().isVisible().catch(() => false)
    check('formulario email + contraseña', hasEmail && hasPassword)

    // Validación de Firestore inicializado (debe cortar con "Inicializando"
    // o mostrar la pantalla; si Firebase no cargara, la app se quedaría en blanco)
    const bodyText = await page.locator('body').innerText()
    check('renderiza contenido', bodyText.includes('Panel de administración'), bodyText.slice(0, 60).replace(/\n/g, ' '))

    // La API exige un token de administrador (usa el Admin SDK, que ignora
    // las firestore.rules). Sin token DEBE responder 401.
    const anonApi = await page.evaluate(async () => {
      try {
        const res = await fetch('/api/pricing/estimate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ vehicle_type: 'car', distance_km: 3 }),
        })
        return res.status
      } catch (e) {
        return `error: ${e.message}`
      }
    })
    check(
      'proxy /api → Admin API rechaza sin token (401)',
      anonApi === 401,
      `status=${anonApi}`,
    )

    // Con token de administrador debe funcionar.
    const authApi = await page.evaluate(async (token) => {
      try {
        const res = await fetch('/api/pricing/estimate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ vehicle_type: 'car', distance_km: 3 }),
        })
        return res.status
      } catch (e) {
        return `error: ${e.message}`
      }
    }, adminToken)
    check('proxy /api → Admin API con token admin (200)', authApi === 200, `status=${authApi}`)
  } catch (e) {
    check('sin excepciones durante la navegación', false, e.message)
  }

  // Los errores de consola de la app (ignorando los de red externos).
  // Se descarta el 401 que provoke la propia prueba al llamar a la API
  // sin token: es la respuesta esperada tras endurecer la autorización.
  const relevantConsoleErrors = consoleErrors.filter(
    (e) => !/favicon|ERR_INTERNET_DISCONNECTED|net::ERR_/i.test(e) && !/status of 401/i.test(e),
  )
  check(
    'sin errores de consola',
    relevantConsoleErrors.length === 0,
    relevantConsoleErrors.slice(0, 3).join(' | '),
  )
  check('sin errores de página (uncaught)', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '))
  check(
    'sin peticiones fallidas a localhost',
    failedRequests.length === 0,
    failedRequests.slice(0, 3).join(' | '),
  )

  await browser.close()

  const failed = results.filter((r) => !r.ok)
  console.log(`\n=== Resultado: ${results.length - failed.length}/${results.length} OK ===\n`)
  if (failed.length) {
    console.log('Fallos:')
    failed.forEach((f) => console.log(`  - ${f.name} (${f.detail})`))
    console.log('\n--- log de Vite (últimas líneas) ---')
    console.log(webLog.split(/\r?\n/).slice(-15).join('\n'))
    console.log('--- log de la API (últimas líneas) ---')
    console.log(apiLog.split(/\r?\n/).slice(-15).join('\n'))
  }

  cleanup()
  process.exit(failed.length ? 1 : 0)
}

function cleanup() {
  // En Windows, `spawn` con shell:true deja nietos (cmd -> npm -> vite).
  // Hay que matar el árbol completo con taskkill.
  for (const [label, proc] of [['api', api], ['web', web]]) {
    try {
      if (proc.pid) {
        spawn('taskkill', ['/pid', String(proc.pid), '/f', '/t'], { stdio: 'ignore' })
      }
    } catch {
      /* best effort */
    }
    try {
      proc.kill()
    } catch {
      /* best effort */
    }
  }
}

main().catch((e) => {
  console.error(e)
  cleanup()
  process.exit(1)
})
