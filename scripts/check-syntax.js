/**
 * Verifica la sintaxis de todos los .js / .mjs del repo (excepto
 * node_modules, builds y artefactos generados).
 *
 * Uso:  node scripts/check-syntax.js
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const SKIP = /node_modules|[\\/]build[\\/]|[\\/]dist[\\/]|[\\/]\.dart_tool[\\/]|api-src|_legacy_next_api/
const ROOTS = [
  'scripts',
  'tests',
  'apps/admin-api/src',
  'apps/admin-api/scripts',
  'apps/admin-web/src',
  'functions/src',
]

const files = []
function walk(dir) {
  if (!fs.existsSync(dir)) return
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (SKIP.test(full)) continue
    if (entry.isDirectory()) walk(full)
    else if (/\.(js|mjs)$/.test(entry.name)) files.push(full)
  }
}
for (const root of ROOTS) walk(root)

let bad = 0
for (const file of files) {
  try {
    execFileSync('node', ['--check', file], { stdio: 'pipe' })
  } catch (error) {
    bad++
    const message = String(error.stderr || '')
      .split('\n')
      .filter((l) => /Error|Unexpected/.test(l))
      .slice(0, 1)
      .join('')
    console.log(`  ✗ ${file}\n      ${message.trim()}`)
  }
}

console.log(`  ${files.length} ficheros .js revisados · ${bad} con error de sintaxis`)
process.exit(bad ? 1 : 0)
