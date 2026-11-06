/**
 * Inicialización de Firebase App Check para el panel web (Vue 3 + Vite).
 *
 * App Check emite un token de attestation que Firebase adjunta a cada
 * petición. Sin él, cualquiera que copie la API Key del bundle puede
 * consumir la cuota del proyecto (y en Maps/Directions, generar coste).
 *
 * Proveedor: reCAPTCHA v3 (no interactivo, sin fricción para el usuario).
 *
 * Variables de entorno:
 *   VITE_RECAPTCHA_SITE_KEY  -> site key de reCAPTCHA v3 (Console Firebase >
 *                              App Check > Web). Sin ella, App Check queda
 *                              desactivado y la app sigue funcionando.
 *
 * Requisitos:
 *   - "firebase" >= 10.8 (el paquete `firebase` incluye `firebase/app-check`).
 *   - El dominio del panel debe estar registrado en App Check > Web.
 */
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check'
import { firebaseApp } from './firebase.js'

/** Clave de reCAPTCHA v3; vacía = App Check no se activa (entorno local). */
const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || ''

/** Dominios permitidos por App Check (deben estar registrados en la consola). */
const ALLOWED_HOSTNAMES = [
  'carsigo-9e508.web.app',
  'carsigo-9e508.firebaseapp.com',
  'localhost',
]

/**
 * @returns {boolean} true si App Check quedó inicializado.
 */
export function initAppCheck() {
  if (!RECAPTCHA_SITE_KEY) {
    // Sin site key no hay App Check. Es lo esperado en local/dev: no se
    // rompe nada, pero tampoco se protege. En producción debe fallar alto.
    console.warn('[app-check] VITE_RECAPTCHA_SITE_KEY no definida: App Check desactivado.')
    return false
  }

  // reCaptchaV3Provider es asíncrono: no podemos bloquear el arranque de la
  // app esperándolo. Firebase permite inicializar el provider en modo
  // "pending" y se resuelve solo.
  const provider = new ReCaptchaV3Provider(RECAPTCHA_SITE_KEY, {
    // Solo en los hosts que App Check conoce; en otros (127.0.0.1, preview)
    // reCAPTCHA v3 no emitirá token.
    allowedHostnames: ALLOWED_HOSTNAMES,
  })

  try {
    initializeAppCheck(firebaseApp, {
      provider,
      isTokenAutoRefreshEnabled: true,
    })
    console.info('[app-check] App Check inicializado con reCAPTCHA v3.')
    return true
  } catch (error) {
    console.error('[app-check] no se pudo inicializar App Check:', error)
    return false
  }
}
