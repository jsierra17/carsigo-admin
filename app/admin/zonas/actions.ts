'use server';

import { createAdminClient } from '@/lib/firebase/service';
import { revalidatePath } from 'next/cache';
import { checkIsAdmin } from '@/lib/auth';

function normalizeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export async function createGeofence(payload: { municipality_name: string, boundaries: any, is_active: boolean, base_multiplier: number }) {
  if (!(await checkIsAdmin())) throw new Error('Acceso Denegado');
  const db = createAdminClient();

  const { data: existing, error: fetchError } = await db
    .from('geofences')
    .select('municipality_name');
  if (fetchError) throw new Error(fetchError.message);

  const normalized = normalizeName(payload.municipality_name);
  const duplicated = (existing || []).find(
    (z: any) => normalizeName(z?.municipality_name || '') === normalized
  );
  if (duplicated) {
    throw new Error(`La zona "${payload.municipality_name.trim()}" ya está habilitada. No se permiten zonas duplicadas.`);
  }

  const { data, error } = await db.from('geofences').insert([payload]);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/zonas');
  return data?.id ?? null;
}

export async function deleteGeofence(id: string) {
  if (!(await checkIsAdmin())) throw new Error('Acceso Denegado');
  const db = createAdminClient();
  const { error } = await db.from('geofences').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/zonas');
}

export async function toggleGeofenceStatus(id: string, currentStatus: boolean) {
  if (!(await checkIsAdmin())) throw new Error('Acceso Denegado');
  const db = createAdminClient();
  const { error } = await db.from('geofences').update({ is_active: !currentStatus }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/zonas');
}

function boundingBoxToPolygon(bbox: string[]): any {
  const [latMin, latMax, lonMin, lonMax] = bbox.map(parseFloat);
  return {
    type: 'Polygon',
    coordinates: [[
      [lonMin, latMin],
      [lonMax, latMin],
      [lonMax, latMax],
      [lonMin, latMax],
      [lonMin, latMin],
    ]]
  };
}

export async function searchMunicipality(queryText: string) {
  try {
    const encodedQuery = encodeURIComponent(`${queryText}, Colombia`);
    const url = `https://nominatim.openstreetmap.org/search?q=${encodedQuery}&format=json&polygon_geojson=1&limit=10`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'CarSiGo-Admin/1.0' }
    });
    if (!response.ok) return { error: 'Error en mapas.', success: false };
    const allResults = await response.json();

    const results: any[] = [];

    for (const r of allResults) {
      // Si tiene polígono nativo de OSM, úsalo
      if (r.geojson && (r.geojson.type === 'Polygon' || r.geojson.type === 'MultiPolygon')) {
        results.push({ ...r, geojson: r.geojson });
        continue;
      }

      // Para municipios sin polígono (relaciones boundary), crear rectángulo desde boundingbox
      if (r.boundingbox && r.boundingbox.length === 4) {
        results.push({ ...r, geojson: boundingBoxToPolygon(r.boundingbox) });
      }
    }

    if (results.length === 0) return { data: [], success: true, message: 'No encontré un área habilitable.' };
    return { data: results, success: true };
  } catch (err) {
    return { error: 'Error de conexión con mapas.', success: false };
  }
}
