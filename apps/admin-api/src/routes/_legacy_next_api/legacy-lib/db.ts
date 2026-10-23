import { createClient } from './firebase/client'

/**
 * Singleton de compatibilidad para uso en componentes cliente.
 */
export const db = createClient()