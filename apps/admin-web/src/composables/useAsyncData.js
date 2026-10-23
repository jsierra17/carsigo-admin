import { ref, shallowRef } from 'vue'

/**
 * Envoltorio para cargas asíncronas con estado de carga/error y recarga.
 *
 * @param {() => Promise<any>} loader  Función que devuelve la promesa
 * @param {any} [initial]              Valor inicial
 */
export function useAsyncData(loader, initial = null) {
  const data = shallowRef(initial)
  const loading = ref(false)
  const error = ref(null)

  async function refresh() {
    loading.value = true
    error.value = null
    try {
      data.value = await loader()
      return data.value
    } catch (e) {
      console.error('[useAsyncData]', e)
      error.value = e?.message || 'Error al cargar los datos'
      return null
    } finally {
      loading.value = false
    }
  }

  return { data, loading, error, refresh }
}
