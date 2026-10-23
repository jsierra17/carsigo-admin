#!/usr/bin/env node
/**
 * Despublica el sitio de Firebase Hosting.
 *
 * El site `carsigo-9e508` es el DEFAULT_SITE del proyecto y Firebase
 * PROHÍBE eliminarlo ("Cannot delete default Hosting Site"). Lo que sí se
 * puede es:
 *   1. borrar los RELEASES  -> el site deja de servir contenido (404)
 *   2. borrar las VERSIONS  -> se libera el almacenamiento de los ficheros
 *
 * El site permanece (no se puede eliminar) pero queda vacío y sin coste.
 * Se puede republicar con:  npm run build:web && firebase deploy --only hosting
 *
 * Uso:  node scripts/unpublish-hosting.js [--dry-run]
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const PROJECT = 'carsigo-9e508'
const SITE = 'carsigo-9e508'
const BASE = `https://firebasehosting.googleapis.com/v1beta1/projects/${PROJECT}/sites/${SITE}`
const CRED = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json')
const DRY = process.argv.includes('--dry-run')

const creds = JSON.parse(fs.readFileSync(CRED, 'utf8'))
const token = creds.tokens.access_token
const exp = Number(creds.tokens.expires_at)
if (!token || (exp && exp < Date.now())) {
  console.error('El token del Firebase CLI esta expirado. Ejecuta:  firebase login')
  process.exit(1)
}

const H = { Authorization: `Bearer ${token}` }

async function list(kind) {
  const res = await fetch(`${BASE}/${kind}?pageSize=100`, { headers: H })
  const body = await res.json()
  return body[kind] || []
}

async function del(kind, id) {
  const res = await fetch(`${BASE}/${kind}/${id}`, { method: 'DELETE', headers: H })
  if (res.ok || res.status === 204) return { ok: true }
  const body = await res.json().catch(() => ({}))
  return { ok: false, status: res.status, error: body.error?.message }
}

async function main() {
  console.log(`\n=== Despublicar Hosting ${SITE} ${DRY ? '(DRY-RUN)' : ''} ===\n`)

  // ── 1. Releases ────────────────────────────────────────────────────────
  const releases = await list('releases')
  console.log(`[1] Releases (contenido publicado): ${releases.length}`)
  for (const r of releases) {
    const id = r.name.split('/').pop()
    if (DRY) {
      console.log(`    - ${id}   [dry-run: se borraria]`)
      continue
    }
    const res = await del('releases', id)
    console.log(`    ${res.ok ? '✓' : '✗'} ${id}  ${res.ok ? 'borrado' : res.status + ' ' + res.error}`)
  }

  // ── 2. Versions ────────────────────────────────────────────────────────
  const versions = await list('versions')
  console.log(`\n[2] Versions (ficheros almacenados): ${versions.length}`)
  for (const v of versions) {
    const id = v.name.split('/').pop()
    if (DRY) {
      console.log(`    - ${id}  ${v.status}  [dry-run: se borraria]`)
      continue
    }
    const res = await del('versions', id)
    console.log(
      `    ${res.ok ? '✓' : '✗'} ${id}  ${v.status}  ${res.ok ? 'borrado' : res.status + ' ' + res.error}`,
    )
  }

  // ── 3. Verificacion ────────────────────────────────────────────────────
  if (!DRY) {
    const r1 = await list('releases')
    const v1 = await list('versions')
    console.log(`\n[3] Estado final: ${r1.length} releases, ${v1.length} versions`)
  }
  console.log('')
}

main().catch((e) => {
  console.error('ERROR:', e.message)
  process.exit(1)
})
