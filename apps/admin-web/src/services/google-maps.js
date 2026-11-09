/**
 * Carga perezosa de la Google Maps JavaScript API.
 *
 * La API se inicializa una sola vez por sesión del navegador. Si la clave no
 * está configurada, se lanza un error descriptivo en lugar de fallar en silencio.
 */
import { Loader } from '@googlemaps/js-api-loader'

let loaderPromise = null

export function getMapsApiKey() {
  return import.meta.env.VITE_GOOGLE_MAPS_KEY || ''
}

/**
 * @returns {Promise<typeof google.maps>}
 */
export function loadGoogleMaps() {
  if (typeof window !== 'undefined' && window.google?.maps) {
    return Promise.resolve(window.google.maps)
  }
  if (!loaderPromise) {
    const apiKey = getMapsApiKey()
    if (!apiKey) {
      return Promise.reject(
        new Error(
          'Falta la clave de Google Maps. Define VITE_GOOGLE_MAPS_KEY en el .env de la raíz.',
        ),
      )
    }
    loaderPromise = new Loader({
      apiKey,
      version: 'weekly',
      libraries: ['geometry'],
    }).load().then((result) => {
      // js-api-loader resuelve con el namespace, pero en algunos escenarios
      // (doble carga, HMR, sdk bootstrapping) el objeto aún no tiene las
      // clases. Validar el constructor evita "maps.Map is not a constructor".
      const mapsApi = window.google?.maps || result
      if (!mapsApi || typeof mapsApi.Map !== 'function') {
        throw new Error(
          'Google Maps JS API se cargó sin el constructor google.maps.Map. Revisa la clave, las restricciones por dominio y que no haya otra carga de la API en la página.',
        )
      }
      loaderPromise = Promise.resolve(mapsApi)
      return mapsApi
    })
  }
  return loaderPromise
}

