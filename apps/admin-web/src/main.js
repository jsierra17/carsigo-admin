import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router/index.js'
import { initAppCheck } from './services/app-check.js'
import './style.css'

const app = createApp(App)

// Manejador global de errores para ver errores en la consola en lugar de pantalla blanca
app.config.errorHandler = (err, instance, info) => {
  console.error('[Vue errorHandler]', err, info)
}

// Aseguramos que Pinia y Router estén listos antes de montar
app.use(createPinia())
app.use(router)

// App Check debe inicializarse antes de la primera llamada a Firebase
// (Auth/Firestore) para que el token de attestation viaje adjunto.
initAppCheck()

app.mount('#app')
