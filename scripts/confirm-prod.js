#!/usr/bin/env node
/**
 * Puerta de seguridad para los despliegues a PRODUCCIÓN.
 *
 * Los scripts `deploy:prod*` del package.json raíz pasan por aquí. Si no se
 * confirma explícitamente, el proceso aborta con código 1 y NO se despliega
 * nada.
 *
 * Se acepta la confirmación de cualquiera de estas formas:
 *   - variable de entorno :  CONFIRM_PROD=1 npm run deploy:prod
 *   - flag de la CLI      :  npm run deploy:prod -- --yes
 *
 * Uso:  node scripts/confirm-prod.js [--yes]
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const PROJECT = 'carsigo-9e508'
const CRED = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json')

const hasEnv = process.env.CONFIRM_PROD === '1'
const hasFlag = process.argv.includes('--yes') || process.argv.includes('-y')

function showTarget() {
  try {
    const creds = JSON.parse(fs.readFileSync(CRED, 'utf8'))
    const email = creds?.user?.email || '(cuenta del Firebase CLI)'
    console.log(`   proyecto : ${PROJECT}`)
    console.log(`   cuenta   : ${email}`)
  } catch {
    console.log(`   proyecto : ${PROJECT}`)
  }
}

if (hasEnv || hasFlag) {
  console.log('\n  ✅ Confirmado: se va a desplegar en PRODUCCIÓN\n')
  showTarget()
  console.log('')
  process.exit(0)
}

console.log(`
  ╔══════════════════════════════════════════════════════════════════╗
  ║  ⛔  DESPLIEGUE A PRODUCCIÓN CANCELADO                          ║
  ╚══════════════════════════════════════════════════════════════════╝

  Este script despliega en el proyecto de PRODUCCIÓN y puede generar costes.
  En modo local no hace falta.

  Para continuar explícitamente, usa una de estas formas:

     CONFIRM_PROD=1 npm run deploy:prod
     npm run deploy:prod -- --yes

  Target:
`)
showTarget()
console.log('')
process.exit(1)
