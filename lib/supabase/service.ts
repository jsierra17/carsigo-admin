import { createClient } from '@supabase/supabase-js'

// Este cliente SE CREA SOLO PARA EL SERVIDOR usando la llave maestra
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('CRITICAL: Missing Supabase Admin Environment Variables');
    // Retornamos un cliente que fallará solo al llamar, no al crear
    return createClient(supabaseUrl || '', serviceRoleKey || 'MISSING_KEY')
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}
