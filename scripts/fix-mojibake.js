/**
 * Repara de forma genérica la doble codificación UTF-8 (mojibake).
 *
 * Busca tramos de caracteres en el rango latin-1 (U+0080-U+00FF) y prueba a
 * decodificarlos como UTF-8. Si el resultado es válido (sin caracteres de
 * reemplazo U+FFFD), se sustituye. Así se arreglan todas las secuencias
 * rotas sin tocar el texto que ya era correcto.
 *
 * Uso:  node scripts/fix-mojibake.js <fichero> [...]
 */
import fs from 'node:fs'
import path from 'node:path'

const RUN = /[-ÿ]+/g

function decodeRun(run) {
  try {
    const decoded = Buffer.from(run, 'latin1').toString('utf8')
    if (decoded.includes('�')) return null
    // Solo aceptamos el resultado si no reintroduce mojibake evidente
    if (/[ÃÂ]{1}[-¿]/.test(decoded)) return null
    return decoded
  } catch {
    return null
  }
}

function fixText(text) {
  let changed = 0
  const fixed = text.replace(RUN, (run) => {
    const decoded = decodeRun(run)
    if (decoded === null) return run
    changed++
    return decoded
  })
  return { fixed, changed }
}

const targets = process.argv.slice(2)
if (targets.length) {
  for (const file of targets) {
    let content
    try {
      content = fs.readFileSync(file, 'utf8')
    } catch {
      console.log(`  (no existe) ${file}`)
      continue
    }
    const { fixed, changed } = fixText(content)
    if (changed) {
      fs.writeFileSync(file, fixed, 'utf8')
      console.log(`  ✓ ${file}  (${changed} tramo(s) reparado(s))`)
    } else {
      console.log(`  = ${file}  (sin cambios)`)
    }
  }
} else {
  // Sin argumentos: recorre el repo
  const SKIP = /node_modules|[\\/]build[\\/]|[\\/]dist[\\/]|[\\/]\.dart_tool[\\/]|api-src/
  const ROOTS = ['apps', 'scripts', 'tests', 'functions', 'firebase', 'docs']
  const files = []
  function walk(dir) {
    if (!fs.existsSync(dir)) return
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (SKIP.test(full)) continue
      if (entry.isDirectory()) walk(full)
      else if (/\.(js|mjs|json|vue|ts|css|md)$/.test(entry.name) || /^\.env/.test(entry.name)) {
        files.push(full)
      }
    }
  }
  ROOTS.forEach(walk)
  for (const f of ['package.json', 'README.md', 'AGENTS.md', 'CLAUDE.md']) {
    if (fs.existsSync(f)) files.push(f)
  }

  let total = 0
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8')
    const { fixed, changed } = fixText(content)
    if (changed) {
      fs.writeFileSync(file, fixed, 'utf8')
      total += changed
      console.log(`  ✓ ${file}  (${changed})`)
    }
  }
  console.log(`\n  tramos reparados: ${total}`)
}
