#!/usr/bin/env node
/**
 * Aplica la nueva estrategia de precios completa en Firestore (producción).
 *
 * Cambios:
 * 1. rate_cards (2 docs): bases 3000/4000, tiers 600-800 / 1000-1200, min=base, comisión 12%
 * 2. geofences (slug el-carmen-de-bolivar): rings nuevos 5/10/15 km
 * 3. rate_schedules (8 docs): TODOS base_fee 3000 moto / 4000 carro, mantiene hourly_increase_percent
 * 4. dynamic_pricing_rules:
 *    - Actualiza 9 reglas festivos existentes: multiplier 1.2
 *    - Crea 1 regla "Fin de semana" (Vie/Sáb/Dom) days_of_week [5,6,0] x1.2
 *
 * USO: node --env-file=.env scripts/apply-pricing-strategy.mjs --apply
 *      (dry-run por defecto)
 */

import fs from 'node:fs'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore, FieldValue, WriteBatch } from 'firebase-admin/firestore'
import { randomUUID } from 'node:crypto'

const ZONE = 'el-carmen-de-bolivar'
const GEOFENCE_DOC_ID = '17oKw6fEKDE7vkHZkHwe'
const APPLY = process.argv.includes('--apply')

const cred = cert(JSON.parse(fs.readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT, 'utf8')))
if (getApps().length === 0) initializeApp({ credential: cred })
const db = getFirestore()

console.log(`=== ESTRATEGIA DE PRECIOS ${APPLY ? 'APLICAR' : 'DRY-RUN'} ===`)
console.log(`Zona: ${ZONE} | Geofence doc: ${GEOFENCE_DOC_ID}\n`)

// ────────────────── 1. RATE CARDS ──────────────────
const CARD_MOTO_ID = 'T4Pg0gge4TG53XCFbzzJ'
const CARD_CAR_ID  = 'GSNuyZAcemD9rz7BtoNj'

const cardUpdates = [
  {
    id: CARD_MOTO_ID,
    data: {
      name: 'Tarifa Moto - El Carmen de Bolívar',
      vehicle_type: 'moto',
      base_fee: 3000,
      minimum_fare: 3000,
      included_km: 1.5,
      tier1_max_km: 4,
      tier1_rate_per_km: 600,
      tier2_max_km: 8,
      tier2_rate_per_km: 800,
      commission_percent: 12,
      zone_id: ZONE,
      is_active: true,
      // legacy fields (mantener para compatibilidad, motor no los usa)
      price_per_km: 0,
      price_per_minute: 0,
      free_waiting_minutes: 5,
      waiting_price_per_minute: 200,
      extra_km_percent: 0,
    },
  },
  {
    id: CARD_CAR_ID,
    data: {
      name: 'Tarifa Carro - El Carmen de Bolívar',
      vehicle_type: 'car',
      base_fee: 4000,
      minimum_fare: 4000,
      included_km: 1.5,
      tier1_max_km: 4,
      tier1_rate_per_km: 1000,
      tier2_max_km: 8,
      tier2_rate_per_km: 1200,
      commission_percent: 12,
      zone_id: ZONE,
      is_active: true,
      price_per_km: 0,
      price_per_minute: 0,
      free_waiting_minutes: 5,
      waiting_price_per_minute: 200,
      extra_km_percent: 0,
    },
  },
]

console.log('--- rate_cards ---')
for (const c of cardUpdates) {
  const ref = db.collection('rate_cards').doc(c.id)
  const snap = await ref.get()
  if (!snap.exists) {
    console.log(`  SKIP ${c.id} — no existe`)
    continue
  }
  const current = snap.data()
  const changed = JSON.stringify(current) !== JSON.stringify(c.data)
  console.log(`  ${changed ? 'UPDATE' : 'SAME'} ${c.id} (${c.data.vehicle_type}) base=$${c.data.base_fee} min=$${c.data.minimum_fare} t1=$${c.data.tier1_rate_per_km}/${c.data.tier1_max_km}km t2=$${c.data.tier2_rate_per_km}/${c.data.tier2_max_km}km`)
  if (APPLY && changed) await ref.set(c.data, { merge: true })
}

// ────────────────── 2. GEOFENCE RINGS ──────────────────
const newRings = [
  { max_km: 5,  car: 8000,  moto: 6000 },
  { max_km: 10, car: 14000, moto: 10000 },
  { max_km: 15, car: 20000, moto: 15000 },
]

console.log('\n--- geofences.rings ---')
const geoRef = db.collection('geofences').doc(GEOFENCE_DOC_ID)
const geoSnap = await geoRef.get()
if (!geoSnap.exists) {
  console.log(`  SKIP geofence ${GEOFENCE_DOC_ID} — no existe`)
} else {
  const currentRings = geoSnap.data().rings || []
  const changed = JSON.stringify(currentRings) !== JSON.stringify(newRings)
  console.log(`  ${changed ? 'UPDATE' : 'SAME'} rings: ${newRings.map(r => `≤${r.max_km}km c$${r.car} m$${r.moto}`).join(' | ')}`)
  if (APPLY && changed) await geoRef.update({ rings: newRings })
}

// ────────────────── 3. RATE SCHEDULES ──────────────────
// 8 docs: actualizar base_fee a 3000 (moto) / 4000 (carro)
// Mantener: hourly_increase_percent, day_type, window_label, horarios, surcharge_amount, is_active
console.log('\n--- rate_schedules ---')
const schedSnap = await db.collection('rate_schedules').where('zone_id', '==', ZONE).get()
let schedUpdated = 0
for (const doc of schedSnap.docs) {
  const d = doc.data()
  const isMoto = d.vehicle_type === 'moto'
  const newBase = isMoto ? 3000 : 4000
  const update = { base_fee: newBase }
  const changed = d.base_fee !== newBase
  console.log(`  ${changed ? 'UPDATE' : 'SAME'} ${doc.id} (${d.vehicle_type} ${d.day_type} ${d.window_label}) base ${d.base_fee}→${newBase}`)
  if (APPLY && changed) {
    await doc.ref.update(update)
    schedUpdated++
  }
}
console.log(`  Total actualizados: ${schedUpdated}/${schedSnap.size}`)

// ────────────────── 4. DYNAMIC PRICING RULES ──────────────────
// 4a) Actualizar 9 reglas festivos existentes: multiplier 1.2
console.log('\n--- dynamic_pricing_rules (festivos) ---')
const rulesSnap = await db.collection('dynamic_pricing_rules').where('zone_id', '==', ZONE).get()
let festUpdated = 0
for (const doc of rulesSnap.docs) {
  const d = doc.data()
  // Solo toca las reglas festivos (specific_date), no la futura de fin de semana
  if (d.rule_type === 'specific_date' && d.multiplier !== 1.2) {
    console.log(`  UPDATE ${doc.id} ${d.name} multiplier ${d.multiplier}→1.2`)
    if (APPLY) await doc.ref.update({ multiplier: 1.2 })
    festUpdated++
  } else if (d.rule_type === 'specific_date') {
    console.log(`  SAME   ${doc.id} ${d.name} ya en 1.2`)
  }
}
console.log(`  Festivos actualizados: ${festUpdated}`)

// 4b) Crear regla Fin de semana (Vie/Sáb/Dom) days_of_week [5,6,0] x1.2
// Solo si no existe ya
const weekendExists = rulesSnap.docs.some(d => d.data().rule_type === 'days_of_week' && Array.isArray(d.data().days_of_week) && d.data().days_of_week.includes(5))
console.log('\n--- dynamic_pricing_rules (fin de semana) ---')
if (weekendExists) {
  console.log('  SAME   Regla "Fin de semana" ya existe')
} else {
  const weekendRule = {
    id: randomUUID(),
    name: 'Fin de semana (Vie/Sáb/Dom)',
    description: 'Recargo 20% viernes, sábado y domingo',
    rule_type: 'days_of_week',
    specific_date: null,
    is_recurring: true,
    date_from: null,
    date_to: null,
    days_of_week: [5, 6, 0], // 0=Dom, 5=Vie, 6=Sáb
    start_time: null,
    end_time: null,
    flat_surcharge: 0,
    geofence_id: null,
    vehicle_type: null,
    zone_id: ZONE,
    is_active: true,
    priority: 100, // menor prioridad que festivos (200) para que festivo gane si cae en fin de semana
    multiplier: 1.2,
    created_at: FieldValue.serverTimestamp(),
  }
  console.log(`  CREATE ${weekendRule.id} "Fin de semana" days_of_week [5,6,0] x1.2 priority 100`)
  if (APPLY) await db.collection('dynamic_pricing_rules').doc(weekendRule.id).set(weekendRule)
}

if (!APPLY) {
  console.log('\n--- DRY-RUN completado. Ejecuta con --apply para escribir en Firestore ---')
  process.exit(0)
}

console.log('\n=== ESCRITURA COMPLETADA ===')

// Verificación post-escritura
console.log('\n--- VERIFICACIÓN POST-ESCRITURA ---')
const vCards = await db.collection('rate_cards').where('zone_id', '==', ZONE).get()
for (const d of vCards.docs) console.log(`  rate_card ${d.id}: base=${d.data().base_fee} min=${d.data().minimum_fare} t1=${d.data().tier1_rate_per_km}/${d.data().tier1_max_km} t2=${d.data().tier2_rate_per_km}/${d.data().tier2_max_km}`)

const vGeo = await db.collection('geofences').doc(GEOFENCE_DOC_ID).get()
if (vGeo.exists) console.log(`  geofence rings: ${JSON.stringify(vGeo.data().rings)}`)

const vSched = await db.collection('rate_schedules').where('zone_id', '==', ZONE).get()
for (const d of vSched.docs) console.log(`  schedule ${d.id}: ${d.data().vehicle_type} ${d.data().day_type} ${d.data().window_label} base=${d.data().base_fee} pct=${d.data().hourly_increase_percent}%`)

const vRules = await db.collection('dynamic_pricing_rules').where('zone_id', '==', ZONE).get()
for (const d of vRules.docs) {
  const r = d.data()
  const when = r.rule_type === 'specific_date' ? r.specific_date : `dow[${(r.days_of_week||[]).join(',')}]`
  console.log(`  rule ${d.id}: ${r.name} ${when} x${r.multiplier} prio=${r.priority}`)
}