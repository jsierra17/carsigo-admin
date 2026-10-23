import { createApp } from './app.js'
import { PORT, NODE_ENV } from './config.js'
import { getFirebaseAdmin } from './lib/firebase-admin.js'

// Inicializa Firebase Admin (valida credenciales al arrancar).
getFirebaseAdmin()

const app = createApp()

const server = app.listen(PORT, () => {
  console.log(`\n  CarSiGo Admin API`)
  console.log(`  ➜  http://localhost:${PORT}`)
  console.log(`  ➜  health:  http://localhost:${PORT}/health`)
  console.log(`  ➜  api:     http://localhost:${PORT}/api`)
  console.log(`  ➜  env:     ${NODE_ENV}\n`)
})

function shutdown(signal) {
  console.log(`\n${signal} recibido, cerrando servidor...`)
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(1), 5000).unref()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
