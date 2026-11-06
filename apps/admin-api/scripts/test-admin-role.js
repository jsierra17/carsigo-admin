/**
 * Prueba del endpoint de roles: verifica requireAuth (401) y requireRole
 * (403) y el flujo completo con un token superadmin real.
 * Uso:  node scripts/test-admin-role.js
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
const PORT = process.env.SMOKE_PORT || '4125'
const BASE = `http://localhost:${PORT}`

// Lee las claves del .env / .env.production de la raíz del monorepo
const env = {}
for (const envFile of ['.env', '.env.production']) {
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

const API_KEY = env.VITE_FIREBASE_API_KEY
const SA_PATH = env.FIREBASE_SERVICE_ACCOUNT

const results = []
function check(name, ok, detail = '') {
  results.push({ name, ok })
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? '  ->  ' + detail : ''}`)
}

if (getApps().length === 0) {
  initializeApp({ credential: cert(JSON.parse(fs.readFileSync(SA_PATH, 'utf8'))) })
}
const auth = getAuth()

/** Custom token -> ID token (vía Identity Toolkit REST). */
async function idTokenFor(uid) {
  const custom = await auth.createCustomToken(uid)
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Referer: 'http://localhost:5173/' },
      body: JSON.stringify({ token: custom, returnSecureToken: true }),
    },
  )
  const body = await res.json()
  if (!res.ok) throw new Error(body?.error?.message || 'No se pudo obtener ID token')
  return body.idToken
}

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

const server = spawn(process.execPath, ['src/index.js'], {
  cwd: API_DIR,
  env: { ...process.env, PORT, FIREBASE_SERVICE_ACCOUNT: SA_PATH },
  stdio: ['ignore', 'pipe', 'pipe'],
})
let log = ''
server.stdout.on('data', (d) => (log += d))
server.stderr.on('data', (d) => (log += d))

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
  console.log('\n=== Admin API — endpoint de roles ===\n')
  if (!(await waitForServer())) {
    console.error('servidor no levantó\n' + log)
    process.exit(1)
  }

  const users = await auth.listUsers(100)
  const superadmin = users.users.find((u) => u.customClaims?.role === 'superadmin')
  const normal = users.users.find((u) => u.customClaims?.role !== 'superadmin')
  if (!superadmin) {
    console.error('No hay ningún usuario con role=superadmin')
    process.exit(1)
  }

  const saToken = await idTokenFor(superadmin.uid)
  const normalToken = normal ? await idTokenFor(normal.uid) : null

  // 1. Sin token -> 401
  const noAuth = await req(`/api/admin/users/${normal?.uid || 'x'}/role`, {
    method: 'POST',
    body: JSON.stringify({ role: 'admin' }),
  })
  check('sin Authorization -> 401', noAuth.status === 401, `status=${noAuth.status}`)

  // 2. Token inválido -> 401
  const badToken = await req(`/api/admin/users/${normal?.uid || 'x'}/role`, {
    method: 'POST',
    headers: { Authorization: 'Bearer token-invalido' },
    body: JSON.stringify({ role: 'admin' }),
  })
  check('token inválido -> 401', badToken.status === 401, `status=${badToken.status}`)

  // 3. Rol insuficiente -> 403
  if (normalToken) {
    const forbidden = await req(`/api/admin/users/${normal.uid}/role`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${normalToken}` },
      body: JSON.stringify({ role: 'admin' }),
    })
    check('token sin rol superadmin -> 403', forbidden.status === 403, `status=${forbidden.status}`)
  }

  // 4. Rol inválido -> 400
  const badRole = await req(`/api/admin/users/${normal?.uid || 'x'}/role`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${saToken}` },
    body: JSON.stringify({ role: 'root' }),
  })
  check('rol inválido -> 400', badRole.status === 400, `status=${badRole.status}`)

  // 5. Flujo completo con superadmin
  const targetUid = normal?.uid || superadmin.uid
  const ok = await req(`/api/admin/users/${targetUid}/role`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${saToken}` },
    body: JSON.stringify({ role: 'conductor' }),
  })
  check(
    'superadmin asigna rol -> 200',
    ok.status === 200 && ok.body.role === 'conductor',
    `status=${ok.status} body=${JSON.stringify(ok.body)}`,
  )

  // 6. Verifica que el custom claim quedó aplicado
  const updated = await auth.getUser(targetUid)
  check(
    'custom claim persistido en Auth',
    updated.customClaims?.role === 'conductor',
    `role=${updated.customClaims?.role}`,
  )

  // 7. Verifica el espejo en Firestore
  const db = getApps().length ? (await import('firebase-admin/firestore')).getFirestore() : null
  const snap = await db.collection('users').doc(targetUid).get()
  check(
    'espejo en Firestore users/{uid}.role',
    snap.exists && snap.data().role === 'conductor',
    `role=${snap.data()?.role}`,
  )

  // 8. Restaurar el rol original
  const originalRole = normal?.customClaims?.role ?? 'passenger'
  await req(`/api/admin/users/${targetUid}/role`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${saToken}` },
    body: JSON.stringify({ role: originalRole }),
  })
  const restored = await auth.getUser(targetUid)
  check('rol restaurado', restored.customClaims?.role === originalRole, `role=${restored.customClaims?.role}`)

  const failed = results.filter((r) => !r.ok)
  console.log(`\n=== Resultado: ${results.length - failed.length}/${results.length} OK ===\n`)
  server.kill()
  process.exit(failed.length ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  server.kill()
  process.exit(1)
})
