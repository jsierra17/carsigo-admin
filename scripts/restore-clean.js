/**
 * Restaura archivos desde git (índice o HEAD) eligiendo la versión sin
 * doble codificación (mojibake). Herramienta de reparación.
 *
 * Uso:  node scripts/restore-clean.js <fichero> [fichero...]
 */
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'

/** Detecta doble codificación UTF-8 (é, ó, §...). */
const MOJI = /[ÃÂ][-¿]/

function gitShow(ref, file) {
  try {
    return execFileSync('git', ['show', `${ref}:${file}`], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 20 * 1024 * 1024,
    })
  } catch {
    return null
  }
}

const files = process.argv.slice(2)
if (!files.length) {
  console.error('Uso: node scripts/restore-clean.js <fichero> [...]')
  process.exit(1)
}

for (const file of files) {
  const index = gitShow(':', file)
  const head = gitShow('HEAD', file)

  let source = null
  let from = ''
  if (index && !MOJI.test(index)) {
    source = index
    from = 'indice'
  } else if (head && !MOJI.test(head)) {
    source = head
    from = 'HEAD'
  } else if (index) {
    source = index
    from = 'indice(ROTO)'
  }

  if (!source) {
    console.log(`  SIN COPIA: ${file}`)
    continue
  }
  fs.writeFileSync(file, source, 'utf8')
  const clean = !MOJI.test(source)
  console.log(`  ${clean ? 'limpio' : 'ROTO  '} <- ${from.padEnd(12)} ${file}`)
}
