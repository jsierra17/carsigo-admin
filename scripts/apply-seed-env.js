/**
 * Añade `.env.seed` a la lista de ficheros de entorno que leen los scripts
 * que necesitan la service account (ahora vive en .env.seed, no en .env.local).
 *
 * Uso:  node scripts/apply-seed-env.js
 */
import fs from 'node:fs'

const files = [
  'apps/admin-api/scripts/smoke-test.js',
  'apps/admin-api/scripts/test-admin-role.js',
  'scripts/ui-smoke-test.js',
  'scripts/production-smoke-test.js',
  'scripts/hosting-smoke-test.js',
]

const patrones = [
  /for \(const envFile of \['\.env', '\.env\.local'\]\)/g,
  /for \(const file of \['\.env', '\.env\.local'\]\)/g,
]

const reemplazo = [
  "for (const envFile of ['.env', '.env.local', '.env.seed'])",
  "for (const file of ['.env', '.env.local', '.env.seed'])",
]

for (const file of files) {
  let content
  try {
    content = fs.readFileSync(file, 'utf8')
  } catch {
    console.log(`  (no existe) ${file}`)
    continue
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
