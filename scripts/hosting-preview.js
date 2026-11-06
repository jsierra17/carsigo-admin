/**
 * Simulador local de Firebase Hosting.
 *
 * Reproduce exactamente lo que hará el hosting en producción:
 *   - sirve `apps/admin-web/dist` como estático,
 *   - rewrite `**` → `/index.html` (SPA: rutas profundas como /zonas),
 *   - rewrite `/api/**` → la Admin API (como el rewrite a Cloud Run).
 *
 * Sirve para verificar la config de hosting SIN desplegar.
 *
 * Uso:  node scripts/hosting-preview.js [--port 5299] [--api 4299]
 */
import http from 'node:http'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DIST = path.join(ROOT, 'apps/admin-web/dist')

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.split('=')[1] : fallback
}

const PORT = Number(arg('port', 5299))
const API_PORT = Number(arg('api', 4299))
const API_TARGET = `http://localhost:${API_PORT}`

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
}

// ── Arranca la Admin API ──────────────────────────────────────────────────
const env = {}
for (const file of ['.env', '.env.production']) {
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

if (!fs.existsSync(DIST)) {
  console.error(
    'No existe apps/admin-web/dist. Ejecuta primero:  npm run build:web',
  )
  process.exit(1)
}

const api = spawn(process.execPath, ['src/index.js'], {
  cwd: path.join(ROOT, 'apps/admin-api'),
  env: { ...process.env, ...env, PORT: String(API_PORT) },
  stdio: ['ignore', 'pipe', 'pipe'],
})
api.stdout.on('data', (d) => process.stdout.write(`[api] ${d}`))
api.stderr.on('data', (d) => process.stderr.write(`[api] ${d}`))

// ── Servidor que imita Hosting ────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)

  // rewrite 1: /api/** → Admin API
  if (url.pathname.startsWith('/api/')) {
    const targetPath = url.pathname + url.search
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    const body = chunks.length ? Buffer.concat(chunks) : undefined

    try {
      const upstream = await fetch(API_TARGET + targetPath, {
        method: req.method,
        headers: { ...req.headers, host: `localhost:${API_PORT}` },
        body: ['GET', 'HEAD'].includes(req.method) ? undefined : body,
      })
      const text = await upstream.text()
      res.writeHead(upstream.status, {
        'Content-Type': upstream.headers.get('content-type') || 'application/json',
      })
      res.end(text)
    } catch (e) {
      res.writeHead(502, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'API no disponible', detail: e.message }))
    }
    return
  }

  // rewrite 2: archivo estático
  let filePath = path.join(DIST, decodeURIComponent(url.pathname))
  if (!filePath.startsWith(DIST)) {
    res.writeHead(403).end('Forbidden')
    return
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST, 'index.html')
  }

  const ext = path.extname(filePath)
  const isIndex = filePath.endsWith('index.html')
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': isIndex
      ? 'no-cache, no-store, must-revalidate'
      : 'public, max-age=31536000, immutable',
  })
  fs.createReadStream(filePath).pipe(res)
})

server.listen(PORT, () => {
  console.log(`\n  Simulador de Hosting`)
  console.log(`  ➜  panel:  http://localhost:${PORT}`)
  console.log(`  ➜  api:    ${API_TARGET}`)
  console.log(`  ➜  dist:   ${DIST}\n`)
})
