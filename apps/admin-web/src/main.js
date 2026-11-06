import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router/index.js'
import { initAppCheck } from './services/app-check.js'
import './style.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)

// App Check debe inicializarse antes de la primera llamada a Firebase
// (Auth/Firestore) para que el token de attestation viaje adjunto.
initAppCheck()

app.mount('#app')
