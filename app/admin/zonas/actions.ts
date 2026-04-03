'use server';

import { createAdminClient } from '@/lib/supabase/service';
import { revalidatePath } from 'next/cache';

export async function createGeofence(payload: { municipality_name: string, boundaries: any, is_active: boolean, base_multiplier: number }) {
  const supabase = createAdminClient();
  
  const { error } = await supabase
    .from('geofences')
    .insert([payload]);

  if (error) throw new Error(error.message);
  revalidatePath('/admin/zonas');
}

export async function deleteGeofence(id: string) {
  const supabase = createAdminClient();
  
  const { error } = await supabase
    .from('geofences')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
  revalidatePath('/admin/zonas');
}

export async function toggleGeofenceStatus(id: string, currentStatus: boolean) {
  const supabase = createAdminClient();
  
  const { error } = await supabase
    .from('geofences')
    .update({ is_active: !currentStatus })
    .eq('id', id);

  if (error) throw new Error(error.message);
  revalidatePath('/admin/zonas');
}

/**
 * Busca un municipio usando la API de Nominatim desde el servidor (Nominatim-Proxy).
 * Esto evita errores de 'Failed to fetch' (CORS) y permite enviar un User-Agent.
 */
export async function searchMunicipality(queryText: string) {
  try {
    const encodedQuery = encodeURIComponent(`${queryText}, Colombia`);
    // Aumentamos el límite a 5 para tener más chances de encontrar el polígono administrativo
    const url = `https://nominatim.openstreetmap.org/search?q=${encodedQuery}&format=json&polygon_geojson=1&limit=5`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'CarSiGo-Admin/1.0 (todoobraparabien1998@gmail.com)'
      }
    });

    if (!response.ok) {
      return { error: 'Error en el servidor de mapas. Intenta más tarde.', success: false };
    }

    const allResults = await response.json();
    
    // Filtrar para encontrar el primer resultado que TENGA un polígono (área de cobertura)
    const bestMatch = allResults.find((r: any) => 
      r.geojson && (r.geojson.type === 'Polygon' || r.geojson.type === 'MultiPolygon')
    );

    if (!bestMatch) {
      return { 
        data: [], 
        success: true, 
        message: 'No encontré un área habilitable para esta búsqueda. Intenta ser más específico (ej: Sincelejo, Sucre).' 
      };
    }

    // Retornamos el mejor resultado en un array para mantener compatibilidad
    return { data: [bestMatch], success: true };
  } catch (err) {
    console.error('Nominatim Search Error:', err);
    return { error: 'No se pudo conectar con el servicio de mapas.', success: false };
  }
}
