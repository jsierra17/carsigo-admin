import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
});

// Función para obtener métricas principales del Dashboard real (Optimizada con Promise.all)
export async function getDashboardMetrics() {
  try {
    const [pasajerosRes, conductoresRes, pendientesRes] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'passenger'),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'driver'),
      supabase.from('driver_profiles').select('*', { count: 'exact', head: true }).eq('status', 'pending')
    ]);

    return {
      pasajeros: pasajerosRes.count || 0,
      conductores: conductoresRes.count || 0,
      pendientes: pendientesRes.count || 0
    };
  } catch (error) {
    console.error("Error en getDashboardMetrics:", error);
    return { pasajeros: 0, conductores: 0, pendientes: 0 };
  }
}

// Obtener los conductores más recientes registrados en el sistema
export async function getLatestDrivers(limit = 5) {
  const { data, error } = await supabase
    .from('users')
    .select(`id, name, phone, email, created_at`)
    .eq('role', 'driver')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error al obtener conductores recientes:", error);
    return [];
  }
  return data;
}

// Buscar conductores por nombre de forma dinámica
export async function searchDriver(query: string) {
  const { data, error } = await supabase
    .from('users')
    .select(`id, name, phone, status, driver_profiles ( vehicle_type, plate, total_rides, suspension_end_date )`)
    .eq('role', 'driver')
    .ilike('name', `%${query}%`);

  return error ? null : data;
}