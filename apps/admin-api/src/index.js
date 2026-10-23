import { createApp } from './app.js'
import { PORT, NODE_ENV, FIREBASE_PROJECT_ID, IS_PROD } from './config.js'
import { getFirebaseAdmin } from './lib/firebase-admin.js'

// Inicializa Firebase Admin (valida credenciales al arrancar).
getFirebaseAdmin()

const app = createApp()

const server = app.listen(PORT, () => {
  console.log(`\n  CarSiGo Admin API`)
  console.log(`  ➜  http://localhost:${PORT}`)
  console.log(`  ➜  health:  http://localhost:${PORT}/health`)
  console.log(`  ➜  api:     http://localhost:${PORT}/api`)
  console.log(`  ➜  env:     ${NODE_ENV}`)
  console.log(`  ➜  firebase: ${FIREBASE_PROJECT_ID}`)

  // Aviso: en local seguimos apuntando a los datos reales porque aún no hay
  // soporte de emulador. Los pasos 6 y 7 (emulador + seed) están pendientes.
  if (!IS_PROD && FIREBASE_PROJECT_ID === 'carsigo-9e508') {
    console.log('')
    console.log('  ⚠️  ATENCIÓN: esta API local está conectada a PRODUCCIÓN')
    console.log('      proyecto : carsigo-9e508')
    console.log('      Lo que escribas aquí va a los datos reales.')
    console.log('      Pendiente: soporte de emulador (docs/DEPLOY.md).')
  }
  console.log('')
})

function shutdown(signal) {
  console.log(`\n${signal} recibido, cerrando servidor...`)
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(1), 5000).unref()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
