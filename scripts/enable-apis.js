/**
 * Habilita las APIs de Google Cloud necesarias en el proyecto, usando las
 * credenciales del Firebase CLI (la cuenta del propietario del proyecto).
 *
 * Esas APIs hacen falta para:
 *   - Cloud Run (backend de la Admin API),
 *   - Cloud Build (construir la imagen Docker),
 *   - Artifact Registry (almacenar la imagen).
 *
 * El Firebase CLI no expone este comando, por eso se llama a la API de
 * Service Usage directamente con un token Bearer.
 *
 * Uso:  node scripts/enable-apis.js
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const PROJECT_ID = process.env.GCLOUD_PROJECT || 'carsigo-9e508'
const PROJECT_NUMBER = '621288515186'

const APIS = [
  'run.googleapis.com',
  'cloudbuild.googleapis.com',
  'artifactregistry.googleapis.com',
  'cloudresourcemanager.googleapis.com',
  'serviceusage.googleapis.com',
  'iam.googleapis.com',
]

const CRED_FILE = path.join(
  os.homedir(),
  '.config',
  'configstore',
  'firebase-tools.json',
)

async function getAccessToken() {
  const creds = JSON.parse(fs.readFileSync(CRED_FILE, 'utf8'))
  const t = creds.tokens
  if (!t?.access_token) throw new Error('No hay access_token en firebase-tools.json')

  // El access_token caduca en ~1 h. Si sigue vigente, se reutiliza.
  // (expires_at viene en milisegundos.)
  const expiresAt = Number(t.expires_at)
  if (expiresAt && expiresAt > Date.now()) {
    return t.access_token
  }

  if (!t.refresh_token) {
    throw new Error('El token expiró. Vuelve a iniciar sesión con: firebase login')
  }
  if (!t.client_id) {
    throw new Error('firebase-tools.json no tiene client_id. Vuelve a iniciar sesión con: firebase login')
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: t.client_id,
      client_secret: t.client_secret,
      refresh_token: t.refresh_token,
      grant_type: 'refresh_token',
    }),
  })
  const body = await res.json()
  if (!res.ok) {
    throw new Error(`No se pudo renovar el token: ${body.error_description || body.error}`)
  }
  return body.access_token
}

async function enableApi(token, api) {
  const url = `https://serviceusage.googleapis.com/v1/projects/${PROJECT_NUMBER}/services/${api}:enable`
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  })
  const body = await res.json()
  if (res.ok) {
    console.log(`  ✓ ${api} habilitada (en curso)`)
    return true
  }
  console.log(`  ✗ ${api}: ${body.error?.message || res.status}`)
  return false
}

async function main() {
  console.log(`\n=== Habilitando APIs en ${PROJECT_ID} ===\n`)

  if (!fs.existsSync(CRED_FILE)) {
    console.error(`No se encontró ${CRED_FILE}. Inicia sesión con: firebase login`)
    process.exit(1)
  }

  const token = await getAccessToken()
  console.log('  token renovado ✓\n')

  for (const api of APIS) {
    await enableApi(token, api)
  }

  console.log('\n  Las APIs pueden tardar 1-2 minutos en propagarse.\n')
}

main().catch((e) => {
  console.error('\n  ERROR:', e.message, '\n')
  process.exit(1)
})
