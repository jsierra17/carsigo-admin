'use server'

import { createAdminClient } from '@/lib/firebase/service'
import { getFirebaseAdmin } from '@/lib/firebase/admin'
import { revalidatePath } from 'next/cache'
import { checkIsSuperAdmin } from '@/lib/auth'

export async function getZonesForSelector() {
  if (!(await checkIsSuperAdmin())) return []
  const db = createAdminClient()
  const { data } = await db
    .from('geofences')
    .select('id, municipality_name, is_active')
    .order('municipality_name')
  return data || []
}

// Todo en UNA llamada (cards + schedules + zonas + zona por defecto):
// la zona por defecto es la que tiene más tarifas (evita migrar/copiar a la
// zona equivocada cuando hay varias zonas en el selector).
export async function getTarifasData() {
  if (!(await checkIsSuperAdmin())) {
    return { cards: [], schedules: [], zones: [], defaultZoneId: null }
  }
  const db = createAdminClient()
  const [cardsRes, schedRes, zonesRes] = await Promise.all([
    db.from('rate_cards').select('*').order('created_at', { ascending: false }),
    db
      .from('rate_schedules')
      .select('*')
      .order('vehicle_type')
      .order('day_type')
      .order('shift_start'),
    db
      .from('geofences')
      .select('id, municipality_name, is_active')
      .order('municipality_name'),
  ])

  const cards = cardsRes.data || []
  const schedules = schedRes.data || []
  const zones = zonesRes.data || []

  const countByZone = new Map<string, number>()
  for (const c of cards) {
    if (typeof c.zone_id === 'string') {
      countByZone.set(c.zone_id, (countByZone.get(c.zone_id) || 0) + 1)
    }
  }
  for (const s of schedules) {
    if (typeof s.zone_id === 'string') {
      countByZone.set(s.zone_id, (countByZone.get(s.zone_id) || 0) + 1)
    }
  }

  let defaultZoneId: string | null = null
  let best = 0
  for (const [zoneId, count] of countByZone.entries()) {
    if (count > best) {
      best = count
      defaultZoneId = zoneId
    }
  }
  if (!defaultZoneId) {
    const active = zones.find((z: { is_active?: boolean }) => z.is_active)
    defaultZoneId = active?.id ?? zones[0]?.id ?? null
  }

  return { cards, schedules, zones, defaultZoneId }
}

// Copia rate_cards + rate_schedules de una zona a otra (IDs nuevos, batch).
export async function copyZonePricing(
  sourceZoneId: string,
  targetZoneId: string,
): Promise<{ cards: number; schedules: number } | { error: string }> {
  if (!(await checkIsSuperAdmin())) return { error: 'Acceso Denegado' }
  const { db } = getFirebaseAdmin()

  const batch = db.batch()
  let cards = 0
  let schedules = 0

  for (const table of ['rate_cards', 'rate_schedules'] as const) {
    const snap = await db.collection(table).where('zone_id', '==', sourceZoneId).get()
    for (const doc of snap.docs) {
      const data = doc.data()
      const copy: Record<string, unknown> = { ...data, zone_id: targetZoneId }
      delete copy.id
      delete copy.created_at
      batch.set(db.collection(table).doc(), copy)
      if (table === 'rate_cards') cards++
      else schedules++
    }
  }

  await batch.commit()
  revalidatePath('/admin/tarifas')
  return { cards, schedules }
}

// Asocia la configuración actual (sin zona) a la zona indicada (batch).
export async function migrateLegacyPricingToZone(
  targetZoneId: string,
): Promise<{ counts: Record<string, number> } | { error: string }> {
  if (!(await checkIsSuperAdmin())) return { error: 'Acceso Denegado' }
  const { db } = getFirebaseAdmin()

  const tables = ['rate_cards', 'rate_schedules', 'dynamic_pricing_rules'] as const
  const counts: Record<string, number> = {}
  const batch = db.batch()

  for (const table of tables) {
    const snap = await db.collection(table).get()
    const legacy = snap.docs.filter((d) => d.data().zone_id == null)
    counts[table] = legacy.length
    for (const doc of legacy) {
      batch.update(doc.ref, { zone_id: targetZoneId })
    }
  }

  await batch.commit()
  revalidatePath('/admin/tarifas')
  revalidatePath('/admin/precio-dinamico')
  return { counts }
}

// Zona que posee más tarifas por zona (fuente de los defaults al crear zonas).
export async function getPricingSourceZoneId() {
  if (!(await checkIsSuperAdmin())) return null
  const db = createAdminClient()

  const { data: cards } = await db.from('rate_cards').select('zone_id')
  const { data: schedules } = await db.from('rate_schedules').select('zone_id')

  const countByZone = new Map<string, number>()
  for (const doc of [...(cards || []), ...(schedules || [])]) {
    if (typeof doc.zone_id === 'string' && doc.zone_id) {
      countByZone.set(doc.zone_id, (countByZone.get(doc.zone_id) || 0) + 1)
    }
  }
  if (countByZone.size === 0) return null

  let best: string | null = null
  let bestCount = 0
  for (const [zoneId, count] of countByZone.entries()) {
    if (count > bestCount) {
      bestCount = count
      best = zoneId
    }
  }
  return best
}