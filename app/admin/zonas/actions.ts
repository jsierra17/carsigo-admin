'use server';

import { createAdminClient } from '@/lib/supabase/service';
import { revalidatePath } from 'next/cache';
import { checkIsAdmin } from '@/lib/auth';

export async function createGeofence(payload: { municipality_name: string, boundaries: any, is_active: boolean, base_multiplier: number }) {
  if (!(await checkIsAdmin())) throw new Error('Acceso Denegado');
  const supabase = createAdminClient();
  const { error } = await supabase.from('geofences').insert([payload]);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/zonas');
}

export async function deleteGeofence(id: string) {
  if (!(await checkIsAdmin())) throw new Error('Acceso Denegado');
  const supabase = createAdminClient();
  const { error } = await supabase.from('geofences').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/zonas');
}

export async function toggleGeofenceStatus(id: string, currentStatus: boolean) {
  if (!(await checkIsAdmin())) throw new Error('Acceso Denegado');
  const supabase = createAdminClient();
  const { error } = await supabase.from('geofences').update({ is_active: !currentStatus }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/zonas');
}

export async function searchMunicipality(queryText: string) {
  try {
    const encodedQuery = encodeURIComponent(`${queryText}, Colombia`);
    const url = `https://nominatim.openstreetmap.org/search?q=${encodedQuery}&format=json&polygon_geojson=1&limit=5`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'CarSiGo-Admin/1.0' }
    });
    if (!response.ok) return { error: 'Error en mapas.', success: false };
    const allResults = await response.json();
    const bestMatch = allResults.find((r: any) => r.geojson && (r.geojson.type === 'Polygon' || r.geojson.type === 'MultiPolygon'));
    if (!bestMatch) return { data: [], success: true, message: 'No encontré un área habilitable.' };
    return { data: [bestMatch], success: true };
  } catch (err) {
    return { error: 'Error de conexión con mapas.', success: false };
  }
}
