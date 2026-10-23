/**
 * Aplica los scripts de "modo local" al package.json raíz.
 *
 * Deja el repo en modo local:
 *   - `deploy` y `deploy:hosting` DESAPARECEN (no se puede publicar por error)
 *   - los deploy de producción pasan a `deploy:prod*` y exigen confirmación
 *     explícita (scripts/confirm-prod.js)
 *   - `deploy:rules` usa el firebase.json seguro (solo rules + indices)
 *
 * Se ejecuta con Node (nunca con Set-Content de PowerShell) para no tocar
 * la codificación UTF-8 del fichero.
 *
 * Uso:  node scripts/apply-local-scripts.js
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const PKG = path.join(ROOT, 'package.json')

const pkg = JSON.parse(fs.readFileSync(PKG, 'utf8'))
const s = pkg.scripts

// 1) Quitar los scripts que permitian publicar sin confirmacion
for (const key of ['deploy', 'deploy:hosting', 'deploy:functions', 'enable:apis', 'test:prod', 'deploy:check']) {
  delete s[key]
}

// 2) Anadir los nuevos
const nuevos = {
  'deploy:prod':
    'node scripts/confirm-prod.js && npm run build:web && npm run prepare:functions && npm run build --prefix functions && firebase deploy --config firebase.prod.json',
  'deploy:prod:hosting':
    'node scripts/confirm-prod.js && npm run build:web && firebase deploy --config firebase.prod.json --only hosting',
  'deploy:prod:functions':
    'node scripts/confirm-prod.js && npm run prepare:functions && npm run build --prefix functions && firebase deploy --config firebase.prod.json --only functions',
  'deploy:rules': 'firebase deploy --config firebase.json --only firestore:rules,firestore:indexes',
  'prod:enable:apis': 'node scripts/enable-apis.js',
  'quarantine:hosting': 'node scripts/unpublish-hosting.js',
}

// 3) Orden: primero los de desarrollo, luego los de produccion
const ordenLocal = [
  'dev',
  'dev:api',
  'build',
  'preview',
  'start:api',
  'test',
  'test:api',
  'test:ui',
  'test:hosting',
  'lint',
  'geofence',
  'build:web',
  'preview:hosting',
  'prepare:functions',
]
const ordenFinal = {}
for (const key of ordenLocal) if (key in s) ordenFinal[key] = s[key]
for (const key of Object.keys(nuevos)) ordenFinal[key] = nuevos[key]
for (const key of Object.keys(s)) if (!(key in ordenFinal)) ordenFinal[key] = s[key]

pkg.scripts = ordenFinal
fs.writeFileSync(PKG, JSON.stringify(pkg, null, 2) + '\n', 'utf8')

console.log('  scripts del package.json raíz:')
for (const [k, v] of Object.entries(ordenFinal)) {
  console.log(`    ${k.padEnd(22)} -> ${v}`)
}
console.log(`\n  'deploy' presente            : ${'deploy' in ordenFinal ? 'SI (mal)' : 'NO'}`)
console.log(`  'deploy:hosting' presente    : ${'deploy:hosting' in ordenFinal ? 'SI (mal)' : 'NO'}`)
console.log(`  'deploy:prod' presente       : ${'deploy:prod' in ordenFinal ? 'SI' : 'NO'}`)
