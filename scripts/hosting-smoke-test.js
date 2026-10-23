/**
 * Prueba de la configuración de Hosting.
 *
 * Levanta el simulador (que imita a Firebase Hosting: estáticos + rewrite SPA
 * + rewrite `/api/**`) y verifica en un navegador real que:
 *   - la app carga en la raíz,
 *   - una ruta profunda (`/zonas`) se resuelve con el fallback a index.html,
 *   - el proxy `/api` llega a la Admin API,
 *   - no hay errores de consola.
 *
 * Uso:  node scripts/hosting-smoke-test.js
 */
import { spawn, spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const PORT = 5299
const API_PORT = 4299
const BASE = `http://localhost:${PORT}`
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'

const results = []
function check(name, ok, detail = '') {
  results.push({ name, ok })
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? '  ->  ' + detail : ''}`)
}

function freePort(port) {
  try {
    const out = spawnSync('netstat', ['-ano', '-p', 'TCP'], { encoding: 'utf8' })
    const pids = new Set()
    for (const line of (out.stdout || '').split(/\r?\n/)) {
      if (!line.includes(`:${port}`) || !/LISTENING/i.test(line)) continue
      const pid = line.trim().split(/\s+/).pop()
      if (pid && pid !== String(process.pid)) pids.add(pid)
    }
    for (const pid of pids) spawn('taskkill', ['/pid', pid, '/f', '/t'], { stdio: 'ignore' })
  } catch {
    /* best effort */
  }
}

freePort(PORT)
freePort(API_PORT)

const preview = spawn(process.execPath, ['scripts/hosting-preview.js', `--port=${PORT}`, `--api=${API_PORT}`], {
  cwd: ROOT,
  stdio: ['ignore', 'pipe', 'pipe'],
})
let log = ''
preview.stdout.on('data', (d) => (log += d))
preview.stderr.on('data', (d) => (log += d))

async function waitFor(url, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      if ((await fetch(url)).ok) return true
    } catch {
      /* reintento */
    }
    await new Promise((r) => setTimeout(r, 600))
  }
  return false
}

async function main() {
  console.log('\n=== Hosting — prueba de la configuración ===\n')

  const up = await waitFor(BASE)
  if (!up) {
    console.error('El simulador no levantó:\n' + log)
    preview.kill()
    process.exit(1)
  }
  check('simulador de hosting arriba', true)

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
    // 1. Raíz
    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 45000 })
    check('carga la raíz', true, page.url())

    // 2. Rewrite SPA: ruta profunda directa
    await page.goto(BASE + '/zonas', { waitUntil: 'networkidle', timeout: 45000 })
    const deepOk = page.url().endsWith('/zonas')
    const body = await page.locator('body').innerText()
    check(
      'rewrite SPA: /zonas directa resuelve a index.html',
      deepOk && body.includes('Panel de administración'),
      page.url(),
    )

    // 3. Otra ruta profunda
    await page.goto(BASE + '/tarifas?x=1', { waitUntil: 'domcontentloaded', timeout: 45000 })
    check('rewrite SPA: ruta con query', page.url().includes('/tarifas'), page.url())

    // 4. Proxy /api — sin token debe rechazar (401)
    const anonApi = await page.evaluate(async () => {
      try {
        const res = await fetch('/api/pricing/estimate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ vehicle_type: 'car', distance_km: 5 }),
        })
        return res.status
      } catch (e) {
        return `error: ${e.message}`
      }
    })
    check('rewrite /api/** rechaza sin token (401)', anonApi === 401, `status=${anonApi}`)

    // 5. Health (público)
    const health = await page.evaluate(async () => {
      const res = await fetch('/api/health')
      return res.status
    })
    check('rewrite /api/health responde', health === 200, `status=${health}`)

    // 5. Un asset estático (logo)
    const assetStatus = await page.evaluate(async () => {
      const res = await fetch('/assets/logo.png')
      return res.status
    })
    check('assets estáticos servidos', assetStatus === 200, `status=${assetStatus}`)

    // 6. Cache-Control del index.html
    const cacheHeaders = await page.evaluate(async () => {
      const res = await fetch('/index.html')
      return res.headers.get('cache-control')
    })
    check(
      'Cache-Control no-cache en index.html',
      Boolean(cacheHeaders && cacheHeaders.includes('no-cache')),
      String(cacheHeaders),
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
  if (failed.length) {
    failed.forEach((f) => console.log(`  - ${f.name}`))
    console.log('\n--- log ---\n' + log.split(/\r?\n/).slice(-20).join('\n'))
  }

  preview.kill()
  spawn('taskkill', ['/pid', String(preview.pid), '/f', '/t'], { stdio: 'ignore' })
  process.exit(failed.length ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  preview.kill()
  process.exit(1)
})
