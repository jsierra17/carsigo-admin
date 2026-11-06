/**
 * Normaliza la lista de ficheros de entorno que leen los scripts que
 * necesitan credenciales.
 *
 * Tras la consolidación hay solo tres ficheros de entorno:
 *   .env           (desarrollo)
 *   .env.production (producción)
 *   .env.example   (plantilla, sin valores)
 *
 * Este script deja la lista de lectura en todos los scripts coherente:
 *   - scripts de desarrollo -> ['.env', '.env.production']
 *   - scripts de producción  -> ['.env.production', '.env']
 *
 * Uso:  node scripts/apply-seed-env.js
 */
import fs from 'node:fs'

const dev = [
  'apps/admin-api/scripts/smoke-test.js',
  'apps/admin-api/scripts/test-admin-role.js',
  'scripts/ui-smoke-test.js',
  'scripts/geofence-builder.js',
  'scripts/hosting-preview.js',
]

const prod = [
  'scripts/production-smoke-test.js',
]

/** Patrones historicos (cualquier combinacion de .env/.env.local/.env.seed). */
const patrones = [
  /for \(const envFile of \[[^\]]*\]\)/g,
  /for \(const file of \[[^\]]*\]\)/g,
]

const devReemplazo = [
  "for (const envFile of ['.env', '.env.production'])",
  "for (const file of ['.env', '.env.production'])",
]

const prodReemplazo = [
  "for (const envFile of ['.env.production', '.env'])",
  "for (const file of ['.env.production', '.env'])",
]

function normalizar(file, reemplazo) {
  let content
  try {
    content = fs.readFileSync(file, 'utf8')
  } catch {
    console.log(`  (no existe) ${file}`)
    return
  }
  const before = content
  patrones.forEach((patron, i) => {
    content = content.replace(patron, reemplazo[i])
  })
  if (content !== before) {
    fs.writeFileSync(file, content, 'utf8')
    console.log(`  ✓ actualizado: ${file}`)
  } else {
    console.log(`  = sin cambios: ${file}`)
  }
}

console.log('  scripts de desarrollo:')
dev.forEach((f) => normalizar(f, devReemplazo))
console.log('  scripts de producción:')
prod.forEach((f) => normalizar(f, prodReemplazo))
