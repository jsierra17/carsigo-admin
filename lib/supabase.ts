import { createClient } from './supabase/client'

/**
 * Singleton de compatibilidad para uso en componentes cliente.
 */
export const supabase = createClient()