#!/usr/bin/env node
/**
 * Inventario de infraestructura CarSiGo — SOLO LECTURA.
 *
 * Usa el token de la cuenta del Firebase CLI para hacer peticiones GET
 * (nunca POST/PATCH/DELETE) contra las APIs de Google Cloud.
 *
 * NO modifica nada. NO imprime secretos: solo nombres de recursos,
 * estados, regiones y contadores.
 *
 * Uso:  node scripts/infra-readonly-audit.js
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const PROJECT = 'carsigo-9e508'
const PROJECT_NUMBER = '621288515186'
const CRED = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json')

const creds = JSON.parse(fs.readFileSync(CRED, 'utf8'))
const token = creds.tokens.access_token
const exp = Number(creds.tokens.expires_at)
if (!token || (exp && exp < Date.now())) {
  console.log('El token del Firebase CLI esta expirado. Ejecuta:  firebase login')
  process.exit(1)
}

async function get(url, label) {
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) {
      console.log(`  ${label}: HTTP ${res.status} (${(await res.json().catch(() => ({}))).error?.message?.slice(0, 80) || 'sin detalle'})`)
      return null
    }
    return await res.json()
  } catch (e) {
    console.log(`  ${label}: ERROR ${e.message}`)
    return null
  }
}

const line = (t) => console.log(`\n${'='.repeat(72)}\n${t}\n${'='.repeat(72)}`)

// ── 1. Billing ────────────────────────────────────────────────────────────
line('1. FACTURACION / PLAN DEL PROYECTO')
const billing = await get(
  `https://cloudbilling.googleapis.com/v1/projects/${PROJECT_NUMBER}/billingInfo`,
  'billingInfo',
)
if (billing) {
  console.log(`  billingEnabled : ${billing.billingEnabled}`)
  console.log(`  billingAccount : ${billing.billingAccountName || '(ninguna)'}`)
} else {
  console.log('  (no se pudo leer; revisar en la consola con permisos de Owner)')
}

// ── 2. APIs habilitadas (cada API habilitada puede facturar) ──────────────
line('2. APIs HABILITADAS (facturables si el proyecto es Blaze)')
const apis = await get(
  `https://serviceusage.googleapis.com/v1/projects/${PROJECT_NUMBER}/services?filter=state:ENABLED&pageSize=200`,
  'services',
)
if (apis?.services) {
  const names = apis.services.map((s) => s.config.name).sort()
  console.log(`  total: ${names.length}`)
  const billables = names.filter((n) =>
    /run\.|cloudbuild|artifactregistry|cloudfunctions|bigquery|dataproc|composer|vertexai|secretmanager|cloudkms|cloudscheduler|cloudexecutions|grafana|cloudarmor|networkedge|cloudsql|spanner|memorystore|filestore/.test(n),
  )
  console.log('  APIs potencialmente facturables:')
  billables.forEach((n) => console.log(`    - ${n}`))
  console.log('  resto:')
  names.filter((n) => !billables.includes(n)).forEach((n) => console.log(`    - ${n}`))
}

// ── 3. Cloud Run ───────────────────────────────────────────────────────────
line('3. CLOUD RUN (servicios)')
const run = await get(
  `https://run.googleapis.com/apis/serving.knative.dev/v1/namespaces/${PROJECT_NUMBER}/services`,
  'run services',
)
if (run?.services) {
  for (const s of run.services) {
    const t = s.spec?.template || {}
    console.log(`  - ${s.metadata.name}`)
    console.log(`      url         : ${s.status?.url}`)
    console.log(`      region      : ${s.metadata.labels?.['cloud.googleapis.com/location'] || '?'}`)
    console.log(`      revision    : ${s.status?.latestReadyRevisionName || '?'}`)
    console.log(`      ingress     : ${t.metadata?.annotations?.['run.googleapis.com/ingress'] || 'ALL'}`)
    console.log(`      serviceAcct : ${t.spec?.serviceAccountName || '(por defecto)'}`)
    console.log(`      minInstances: ${t.spec?.minScale ?? 0}`)
    console.log(`      maxInstances: ${t.spec?.maxScale ?? '?'}`)
    console.log(`      cpu/mem     : ${t.spec?.containerConcurrency ?? '?'} / ${t.spec?.containers?.[0]?.resources?.limits?.memory || '?'}`)
    console.log(`      traffic     : ${(t.spec?.traffic || []).map((x) => `${x.percent || 0}%(${x.revisionName})`).join(' ')}`)
    console.log(`      containers  : ${(t.spec?.containers || []).map((c) => c.image).join(', ')}`)
  }
  if (!run.services.length) console.log('  (ninguno)')
}

// ── 4. Artifact Registry ──────────────────────────────────────────────────
line('4. ARTIFACT REGISTRY (imagenes de contenedor = almacenamiento)')
for (const loc of ['us-central1', 'southamerica-east1', 'europe-west1']) {
  const repos = await get(
    `https://artifactregistry.googleapis.com/v1/projects/${PROJECT}/locations/${loc}/repositories`,
    `repos ${loc}`,
  )
  if (repos?.repositories?.length) {
    for (const r of repos.repositories) {
      console.log(`  - ${loc}/${r.name}  (${r.format})  cleanup=${r.cleanupPolicies ? 'configurada' : 'SIN POLITICA'}`)
      const imgs = await get(
        `https://artifactregistry.googleapis.com/v1/projects/${PROJECT}/locations/${loc}/repositories/${r.name}/dockerImages?pageSize=50`,
        'imgs',
      )
      let total = 0
      imgs?.dockerImages?.forEach((i) => {
        const mb = Math.round((Number(i.imageSizeBytes) || 0) / 1048576)
        total += mb
        console.log(`      ${i.uri?.split('/').pop()?.slice(0, 20)}  ${mb} MB  ${i.uploadTime}`)
      })
      console.log(`      total: ${total} MB`)
    }
  }
}

// ── 5. Cloud Build ────────────────────────────────────────────────────────
line('5. CLOUD BUILD (historial y artefactos)')
const builds = await get(
  `https://cloudbuild.googleapis.com/v1/projects/${PROJECT}/builds?pageSize=20`,
  'builds',
)
if (builds?.builds) {
  console.log(`  builds totales (paginados): ${builds.builds.length}`)
  for (const b of builds.builds.slice(0, 10)) {
    console.log(`  - ${b.id}  ${b.status}  ${b.createTime}  img=${b.images?.[0] || '-'}`)
  }
  const bytes = builds.builds.reduce((s, b) => s + (Number(b.logUrl) ? 0 : 0), 0)
  void bytes
}

// ── 6. Cloud Scheduler / Eventarc / PubSub (posibles triggers de billing) ─
line('6. SCHEDULERS / EVENTARC / PUBSUB (disparadores automaticos)')
for (const [api, path, label] of [
  ['https://cloudscheduler.googleapis.com/v1/projects', `/${PROJECT}/locations/-/jobs`, 'Cloud Scheduler'],
  ['https://eventarc.googleapis.com/v1/projects', `/${PROJECT}/locations/us-central1/triggers`, 'Eventarc'],
  ['https://pubsub.googleapis.com/v1/projects', `/${PROJECT}/topics`, 'PubSub topics'],
  ['https://pubsub.googleapis.com/v1/projects', `/${PROJECT}/subscriptions`, 'PubSub subscriptions'],
]) {
  const r = await get(api + path, label)
  if (r) {
    const key = Object.keys(r).find((k) => Array.isArray(r[k]))
    const items = key ? r[key] : []
    console.log(`  ${label}: ${items.length ? items.length : 0}`)
    if (items.length) items.slice(0, 8).forEach((i) => console.log(`    - ${i.name}`))
  }
}

// ── 7. Secret Manager ─────────────────────────────────────────────────────
line('7. SECRET MANAGER (secretos con coste por version)')
const secrets = await get(
  `https://secretmanager.googleapis.com/v1/projects/${PROJECT}/secrets?pageSize=50`,
  'secrets',
)
if (secrets?.secrets) {
  console.log(`  secretos: ${secrets.secrets.length}`)
  secrets.secrets.forEach((s) => console.log(`    - ${s.name} (creado ${s.createTime})`))
  if (!secrets.secrets.length) console.log('    (ninguno)')
}

// ── 8. Logging / Error Reporting ──────────────────────────────────────────
line('8. LOGGING / ERROR REPORTING (retencion = coste)')
for (const [url, label] of [
  [`https://logging.googleapis.com/v2/projects/${PROJECT}/sinks`, 'Logging sinks'],
  [`https://clouderrorreporting.googleapis.com/v1/projects/${PROJECT}/errorEvents?pageSize=1`, 'Error Reporting'],
]) {
  const r = await get(url, label)
  if (r) {
    if (r.sinks) console.log(`  ${label}: ${r.sinks.length}`)
    else console.log(`  ${label}: accesible`)
  }
}

console.log('\nFin del inventario (solo lectura).\n')
