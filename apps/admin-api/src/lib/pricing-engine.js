import { getDb } from './firebase-admin.js'

/**
 * Motor de tarifas (autoritativo, se ejecuta en el servidor).
 *
 * Puerto fiel de `carsigo-mobile/lib/services/pricing_engine.dart` (motor
 * endurecido) sobre consultas NATIVAS del Firebase Admin SDK.
 *
 * Componentes en Firestore:
 *   - `rate_schedules`      → turnos: base_fee, hourly_increase_percent, day_type...
 *   - `rate_cards`          → minimum_fare, commission_percent, included_km, tiers...
 *   - `dynamic_pricing_rules` → multiplicadores por fecha/día/hora
 *   - `geofences.rings`     → techos por distancia de la zona
 */

export const INCLUDED_KM_DEFAULT = 1.5

// ── Helpers ────────────────────────────────────────────────────────────────

/** Fin de semana = Viernes, Sábado, Domingo. Entre semana = Lunes a Jueves. */
export function getDayType(date) {
  const day = date.getDay()
  if (day === 5 || day === 6 || day === 0) return 'weekend'
  return 'weekday'
}

function inWindow(time, start, end) {
  if (!start || !end) return false
  if (end <= start) {
    return time >= start || time < end
  }
  return time >= start && time < end
}

/** Horas transcurridas desde el inicio del turno (soporta turno que cruza medianoche). */
export function getHoursSince(from, to, current) {
  const [fromH, fromM] = from.split(':').map(Number)
  const [toH, toM] = to.split(':').map(Number)
  const fromMin = fromH * 60 + fromM
  const toMin = toH * 60 + toM
  const currentMin = current.getHours() * 60 + current.getMinutes()

  if (toMin <= fromMin) {
    if (currentMin >= fromMin) return (currentMin - fromMin) / 60
    return (24 * 60 - fromMin + currentMin) / 60
  }
  if (currentMin >= fromMin && currentMin < toMin) return (currentMin - fromMin) / 60
  return 0
}

export function round100(value) {
  return Math.round(value / 100) * 100
}

function roundTo(value, places = 2) {
  const mod = 10 ** places
  return Math.round(value * mod) / mod
}

function num(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

// ── Consultas nativas ──────────────────────────────────────────────────────

/**
 * Resuelve la geofence por id de documento o por el campo `id`.
 * Devuelve el objeto de la zona o null.
 */
async function resolveZoneGeo(db, zoneId) {
  if (!zoneId) return null
  try {
    const byDoc = await db.collection('geofences').doc(zoneId).get()
    if (byDoc.exists) return byDoc.data()
    const byField = await db.collection('geofences').where('id', '==', zoneId).limit(1).get()
    return byField.empty ? null : byField.docs[0].data()
  } catch (e) {
    console.error('[pricing] geofence fetch error:', e.message)
    return null
  }
}

/** Turnos: primero los de la zona; si no hay, los globales (legado). */
async function fetchSchedules(db, zoneId, vehicleType, dayType) {
  const base = { vehicle_type: vehicleType, day_type: dayType, is_active: true }

  if (zoneId) {
    const snap = await db
      .collection('rate_schedules')
      .where('vehicle_type', '==', base.vehicle_type)
      .where('day_type', '==', base.day_type)
      .where('is_active', '==', true)
      .where('zone_id', '==', zoneId)
      .get()
    if (!snap.empty) return snap.docs.map((d) => d.data())
  }

  const snap = await db
    .collection('rate_schedules')
    .where('vehicle_type', '==', base.vehicle_type)
    .where('day_type', '==', base.day_type)
    .where('is_active', '==', true)
    .get()
  return snap.docs.map((d) => d.data())
}

/** Tarjetas de tarifa: primero las de la zona; si no hay, la global. */
async function fetchCards(db, zoneId, vehicleType) {
  if (zoneId) {
    const snap = await db
      .collection('rate_cards')
      .where('vehicle_type', '==', vehicleType)
      .where('is_active', '==', true)
      .where('zone_id', '==', zoneId)
      .get()
    if (!snap.empty) return snap.docs.map((d) => d.data())
  }

  const snap = await db
    .collection('rate_cards')
    .where('vehicle_type', '==', vehicleType)
    .where('is_active', '==', true)
    .limit(1)
    .get()
  return snap.docs.map((d) => d.data())
}

/**
 * Reglas dinámicas: primero las de la zona; si no hay, las globales (zone_id null).
 * Se ordenan por prioridad en memoria (evita índices compuestos y reglas sin priority).
 */
async function fetchRules(db, zoneId) {
  let docs = []

  if (zoneId) {
    const snap = await db
      .collection('dynamic_pricing_rules')
      .where('zone_id', '==', zoneId)
      .where('is_active', '==', true)
      .get()
    docs = snap.docs.map((d) => d.data())
  }

  if (docs.length === 0) {
    const snap = await db
      .collection('dynamic_pricing_rules')
      .where('zone_id', '==', null)
      .where('is_active', '==', true)
      .get()
    docs = snap.docs.map((d) => d.data())
  }

  return docs.sort((a, b) => num(b.priority) - num(a.priority))
}

// ── Reglas de precio dinámico ──────────────────────────────────────────────

/**
 * Evalúa una regla contra la fecha/hora dada.
 * Devuelve true/false. Reglas mal formadas se ignoran (no rompen la estimación).
 */
export function ruleMatches(rule, dt, currentTime) {
  try {
    const ruleType = rule.rule_type

    if (ruleType === 'specific_date') {
      // FIX: `is_recurring` ausente/null se trata como true (regla anual).
      const recurring = rule.is_recurring === undefined || rule.is_recurring === null
        ? true
        : !!rule.is_recurring
      if (!recurring) return false
      if (!rule.specific_date) return false
      const ruleDate = new Date(rule.specific_date)
      if (Number.isNaN(ruleDate.getTime())) return false
      return dt.getMonth() === ruleDate.getMonth() && dt.getDate() === ruleDate.getDate()
    }

    if (ruleType === 'date_range') {
      if (!rule.date_from || !rule.date_to) return false
      const from = new Date(rule.date_from)
      const to = new Date(rule.date_to)
      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return false
      // El rango es inclusivo: cubre desde el inicio del `date_from`
      // hasta el final del `date_to`.
      const start = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 0, 0, 0, 0)
      const end = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999)
      return dt >= start && dt <= end
    }

    if (ruleType === 'day_of_week') {
      const days = Array.isArray(rule.days_of_week) ? rule.days_of_week.map(Number) : []
      if (days.length === 0) return false
      // Numeración ISO: 1 = lunes ... 7 = domingo
      const dayNum = dt.getDay() === 0 ? 7 : dt.getDay()
      return days.includes(dayNum)
    }

    if (ruleType === 'time_range') {
      const days = Array.isArray(rule.days_of_week) ? rule.days_of_week.map(Number) : []
      if (days.length === 0) return false
      const dayNum = dt.getDay() === 0 ? 7 : dt.getDay()
      if (!days.includes(dayNum)) return false
      if (!rule.start_time || !rule.end_time) return false
      const startTime = String(rule.start_time).slice(0, 5)
      const endTime = String(rule.end_time).slice(0, 5)
      return currentTime >= startTime && currentTime < endTime
    }

    return false
  } catch {
    // Regla mal formada: se ignora sin romper la estimación.
    return false
  }
}

// ── Cálculo ─────────────────────────────────────────────────────────────────

/**
 * Costo por distancia extra más allá de los km incluidos.
 * tramo (incluido → tier1_max_km) a tier1_rate_per_km, el resto a tier2.
 */
function extraKmCost(km, card, includedKm) {
  if (km <= includedKm) return 0
  const tier1Max = num(card?.tier1_max_km, 4)
  const tier1Rate = num(card?.tier1_rate_per_km, 0)
  const tier2Rate = num(card?.tier2_rate_per_km, 0)
  const t1 = Math.max(0, Math.min(km, tier1Max) - includedKm)
  const t2 = Math.max(0, km - tier1Max)
  return t1 * tier1Rate + t2 * tier2Rate
}

/**
 * Calcula el desglose de la tarifa.
 *
 * @param {object} input
 * @param {'moto'|'car'} input.vehicle_type
 * @param {number} input.distance_km
 * @param {number} [input.duration_min]
 * @param {Date|string} [input.datetime]
 * @param {string} [input.zone_id]
 */
export async function calculateFare(input) {
  const db = getDb()
  const dt = input.datetime ? new Date(input.datetime) : new Date()
  const dayType = getDayType(dt)
  const currentTime = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`
  const vehicleType = input.vehicle_type
  const distanceKm = num(input.distance_km, 0)

  // Resolución de zona: el zone_id de precios es el slug del municipio
  // (ej. 'el-carmen-de-bolivar'), independiente del id interno del geofence.
  const zoneGeo = await resolveZoneGeo(db, input.zone_id)
  const pricingZoneId =
    typeof zoneGeo?.slug === 'string' && zoneGeo.slug.length > 0 ? zoneGeo.slug : input.zone_id

  // ── Turno ────────────────────────────────────────────────────────────────
  const schedules = await fetchSchedules(db, pricingZoneId, vehicleType, dayType)
  let schedule = schedules.find((s) => {
    const start = s.start_time || s.shift_start
    const end = s.end_time || s.shift_end
    return inWindow(currentTime, start, end)
  })
  if (!schedule && schedules.length > 0) schedule = schedules[0]

  // ── Tarjeta ──────────────────────────────────────────────────────────────
  const cards = await fetchCards(db, pricingZoneId, vehicleType)
  const card = cards.length > 0 ? cards[0] : null

  const minimumFare = num(card?.minimum_fare, 5000)
  // FIX: `included_km` ahora se lee de la tarjeta (antes estaba fijo en 1.5).
  const includedKm = num(card?.included_km, INCLUDED_KM_DEFAULT)

  const shiftStart = schedule?.start_time || schedule?.shift_start || null
  const shiftEnd = schedule?.end_time || schedule?.shift_end || null
  const base = num(schedule?.base_fee, minimumFare)
  const hourlyPct = num(schedule?.hourly_increase_percent, 0)
  const hoursElapsed = shiftStart && shiftEnd ? getHoursSince(shiftStart, shiftEnd, dt) : 0

  // Base_Ajustada = base * (1 + (pct/100) * horas_transcurridas).
  // Excepción: viajes cortos (< included_km) en turno DIURNO quedan fijos y
  // planos en la tarifa mínima, SIN incremento por horas transcurridas.
  const isDayTurn =
    schedule?.window_label === 'day' ||
    (schedule?.window_label == null && schedule?.shift_label === 'day')
  const shortDayTrip = distanceKm < includedKm && isDayTurn

  const baseAdjusted = shortDayTrip
    ? minimumFare
    : base * (1 + (hourlyPct / 100) * hoursElapsed)

  const extraCost = extraKmCost(distanceKm, card, includedKm)
  const subtotal = baseAdjusted + extraCost

  // ── Reglas dinámicas ─────────────────────────────────────────────────────
  const allRules = await fetchRules(db, pricingZoneId)
  const rules = allRules.filter(
    (r) => r.vehicle_type == null || r.vehicle_type === vehicleType,
  )

  let dynamicMultiplier = 1.0
  let dynamicRuleName = null
  for (const rule of rules) {
    if (ruleMatches(rule, dt, currentTime)) {
      dynamicMultiplier = num(rule.multiplier, 1.0)
      dynamicRuleName = rule.name ?? null
      break
    }
  }

  // ── Techos por distancia (anillos de la geofence) ───────────────────────
  // El subtotal se topa en el máximo del anillo que alcanza la distancia,
  // ANTES de aplicar las reglas dinámicas (en festivos se paga por encima).
  let fare = subtotal
  const rings = Array.isArray(zoneGeo?.rings) ? zoneGeo.rings : []
  for (const ring of rings) {
    if (!ring || typeof ring !== 'object') continue
    const maxKm = num(ring.max_km, 0)
    if (distanceKm <= maxKm) {
      const cap = vehicleType === 'moto' ? num(ring.moto, 0) : num(ring.car, 0)
      if (cap > 0) fare = Math.min(fare, cap)
      break
    }
  }
  fare = fare * dynamicMultiplier

  // ── Totales ──────────────────────────────────────────────────────────────
  const floor = shortDayTrip ? minimumFare : Math.max(minimumFare, base)
  const finalAmount = round100(Math.max(fare, floor))
  const commissionPct = num(card?.commission_percent, 12)
  const commissionAmount = finalAmount * (commissionPct / 100)
  const driverEarnings = finalAmount - commissionAmount

  return {
    vehicle_type: vehicleType,
    day_type: schedule?.day_type || dayType,
    shift_label: schedule?.window_label || schedule?.shift_label || 'day',
    shift_start: shiftStart || '05:00',
    shift_end: shiftEnd || '18:00',
    base_fee_at_shift_start: base,
    hours_since_shift_start: roundTo(hoursElapsed, 2),
    hourly_increase_percent: hourlyPct,
    current_base_fee: Math.round(baseAdjusted),
    included_km: includedKm,
    distance_km: distanceKm,
    extra_km: roundTo(Math.max(0, distanceKm - includedKm), 2),
    extra_km_percent: num(card?.tier1_rate_per_km, num(card?.extra_km_percent, 600)),
    extra_km_charge: Math.round(extraCost),
    subtotal: Math.round(subtotal),
    dynamic_multiplier: dynamicMultiplier,
    dynamic_rule_name: dynamicRuleName,
    final_fare: finalAmount,
    minimum_fare: floor,
    commission_percent: commissionPct,
    commission_amount: Math.round(commissionAmount),
    driver_earnings: Math.round(driverEarnings),
    time_surcharge: 0,
    special_zone_applied: false,
  }
}
