import { createAdminClient } from './firebase/service'

export type VehicleType = 'moto' | 'car'
export type DayType = 'weekday' | 'weekend' | 'special'

export interface PricingInput {
  vehicle_type: VehicleType
  distance_km: number
  duration_min: number
  datetime?: Date
  zone_id?: string
  from_lat?: number
  from_lng?: number
  to_lat?: number
  to_lng?: number
}

export interface PricingBreakdown {
  vehicle_type: VehicleType
  day_type: DayType
  shift_label: string
  shift_start: string
  shift_end: string
  base_fee_at_shift_start: number
  hours_since_shift_start: number
  hourly_increase_percent: number
  current_base_fee: number
  included_km: number
  distance_km: number
  extra_km: number
  extra_km_percent: number
  extra_km_charge: number
  subtotal: number
  dynamic_multiplier: number
  dynamic_rule_name: string | null
  final_fare: number
  minimum_fare: number
  commission_percent: number
  commission_amount: number
  driver_earnings: number
  time_surcharge: number
  special_zone_applied: boolean
}

/// Fin de semana = Viernes, Sábado, Domingo. Entre semana = Lunes a Jueves.
function getDayType(date: Date): DayType {
  const day = date.getDay()
  if (day === 5 || day === 6 || day === 0) return 'weekend'
  return 'weekday'
}

function inWindow(time: string, start: string, end: string): boolean {
  if (end <= start) {
    return time >= start || time < end
  }
  return time >= start && time < end
}

/// Horas transcurridas desde el inicio del turno (soporta turnos que cruzan
/// la medianoche: ej. 18:30 -> 04:59).
function getHoursSince(from: string, to: string, current: Date): number {
  const [fromH, fromM] = from.split(':').map(Number)
  const [toH, toM] = to.split(':').map(Number)
  const fromMin = fromH * 60 + fromM
  const toMin = toH * 60 + toM
  const currentMin = current.getHours() * 60 + current.getMinutes()

  if (toMin <= fromMin) {
    if (currentMin >= fromMin) {
      return (currentMin - fromMin) / 60
    }
    return ((24 * 60 - fromMin) + currentMin) / 60
  }
  if (currentMin >= fromMin && currentMin < toMin) {
    return (currentMin - fromMin) / 60
  }
  return 0
}

function round100(v: number): number {
  return Math.round(v / 100) * 100
}

function pointInRing(lat: number, lng: number, ring: Array<{ lat: number; lng: number }>): boolean {
  if (!ring || ring.length < 3) return false
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const yi = ring[i].lat
    const xi = ring[i].lng
    const yj = ring[j].lat
    const xj = ring[j].lng
    const intersects = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    if (intersects) inside = !inside
  }
  return inside
}

export async function calculateFare(input: PricingInput): Promise<PricingBreakdown> {
  const db = createAdminClient()
  const dt = input.datetime || new Date()
  const dayType = getDayType(dt)
  const currentTime = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`

  // Resolución de zona: el zone_id de precios es el slug del municipio
  // (ej. 'el-carmen-de-bolivar'), independiente del id interno del geofence.
  let zoneGeo: Record<string, any> | undefined
  if (input.zone_id) {
    try {
      const { data: geos } = await db
        .from('geofences')
        .select('*')
        .eq('id', input.zone_id)
        .limit(1)
      zoneGeo = (geos || [])[0]
    } catch (e) {
      console.error('geofence fetch error', e)
    }
  }
  const pricingZoneId =
    typeof zoneGeo?.slug === 'string' && zoneGeo.slug.length > 0
      ? zoneGeo.slug
      : input.zone_id

  const { data: schedules } = pricingZoneId
    ? await db
        .from('rate_schedules')
        .select('*')
        .eq('zone_id', pricingZoneId)
        .eq('vehicle_type', input.vehicle_type)
        .eq('day_type', dayType)
        .eq('is_active', true)
    : await db
        .from('rate_schedules')
        .select('*')
        .eq('vehicle_type', input.vehicle_type)
        .eq('day_type', dayType)
        .eq('is_active', true)

  let zoneSchedules = (schedules || []) as Array<{
      start_time?: string
      end_time?: string
      shift_start: string
      shift_end: string
      day_type: DayType
      shift_label: string
      window_label?: string
      surcharge_amount?: number
      base_fee: number
      hourly_increase_percent: number
    }>

  if (zoneSchedules.length === 0 && pricingZoneId) {
    const { data: legacy } = await db
      .from('rate_schedules')
      .select('*')
      .eq('vehicle_type', input.vehicle_type)
      .eq('day_type', dayType)
      .eq('is_active', true)
    zoneSchedules = (legacy || []) as typeof zoneSchedules
  }

  const schedule = zoneSchedules.find(s => {
    const start = s.start_time || s.shift_start
    const end = s.end_time || s.shift_end
    return inWindow(currentTime, start, end)
  }) || zoneSchedules[0]

  const { data: cards } = pricingZoneId
    ? await db
        .from('rate_cards')
        .select('*')
        .eq('zone_id', pricingZoneId)
        .eq('vehicle_type', input.vehicle_type)
        .eq('is_active', true)
        .limit(1)
    : await db
        .from('rate_cards')
        .select('*')
        .eq('vehicle_type', input.vehicle_type)
        .eq('is_active', true)
        .limit(1)

  let zoneCards = (cards || []) as Array<{
      minimum_fare: number
      commission_percent: number
      included_km: number
      extra_km_percent: number
      base_fee: number
      tier1_max_km?: number
      tier1_rate_per_km?: number
      tier2_max_km?: number
      tier2_rate_per_km?: number
    }>

  if (zoneCards.length === 0 && pricingZoneId) {
    const { data: legacy } = await db
      .from('rate_cards')
      .select('*')
      .eq('vehicle_type', input.vehicle_type)
      .eq('is_active', true)
      .limit(1)
    zoneCards = (legacy || []) as typeof zoneCards
  }

  const card = zoneCards[0]
  const minimumFare = card?.minimum_fare || 5000
  const tier1Max = card?.tier1_max_km || 4
  const tier1Rate = card?.tier1_rate_per_km || 0
  const tier2Rate = card?.tier2_rate_per_km || 0

  const shiftStart = schedule?.start_time || schedule?.shift_start
  const shiftEnd = schedule?.end_time || schedule?.shift_end
  const base = schedule?.base_fee || minimumFare
  const hourlyPct = schedule?.hourly_increase_percent || 0
  const hoursElapsed = shiftStart && shiftEnd ? getHoursSince(shiftStart, shiftEnd, dt) : 0

  // Base_Ajustada = Base * (1 + (pct/100) * hours_elapsed).
  // Excepción: viajes cortos (< 1.5 km) en turno DIURNO quedan fijos y planos
  // en la tarifa mínima base, SIN incremento por horas transcurridas.
  // El turno nocturno/madrugada y las fechas especiales sí aplican recargo.
  const isDayTurn = schedule?.window_label === 'day' ||
    (schedule?.window_label == null && schedule?.shift_label === 'day')
  const shortDayTrip = input.distance_km < 1.5 && isDayTurn

  const baseAdjusted = shortDayTrip
    ? minimumFare
    : base * (1 + (hourlyPct / 100) * hoursElapsed)
  const extraKm = Math.max(0, input.distance_km - 1.5)
  const extraCost = input.distance_km <= 1.5
    ? 0
    : Math.max(0, Math.min(input.distance_km, tier1Max) - 1.5) * tier1Rate +
      Math.max(0, input.distance_km - tier1Max) * tier2Rate
  const subtotal = baseAdjusted + extraCost

  const { data: rules } = pricingZoneId
    ? await db
        .from('dynamic_pricing_rules')
        .select('*')
        .in('zone_id', [pricingZoneId, null])
        .eq('is_active', true)
        .or(`vehicle_type.eq.${input.vehicle_type},vehicle_type.is.null`)
        .gte('priority', 0)
        .order('priority', { ascending: false })
    : await db
        .from('dynamic_pricing_rules')
        .select('*')
        .eq('is_active', true)
        .or(`vehicle_type.eq.${input.vehicle_type},vehicle_type.is.null`)
        .gte('priority', 0)
        .order('priority', { ascending: false })

  let zoneRules = (rules || []) as Array<{
      rule_type: string
      is_recurring?: boolean
      specific_date?: string
      date_from?: string
      date_to?: string
      days_of_week?: number[]
      start_time?: string
      end_time?: string
      multiplier: number
      name: string
      vehicle_type?: string | null
    }>

  if (zoneRules.length === 0 && pricingZoneId) {
    const { data: legacy } = await db
      .from('dynamic_pricing_rules')
      .select('*')
      .eq('is_active', true)
      .or(`vehicle_type.eq.${input.vehicle_type},vehicle_type.is.null`)
      .gte('priority', 0)
      .order('priority', { ascending: false })
    zoneRules = (legacy || []) as typeof zoneRules
  }

  let dynamicMultiplier = 1.0
  let dynamicRuleName: string | null = null

  const matchingRule = zoneRules.find(r => {
    if (r.rule_type === 'specific_date' && r.is_recurring) {
      const ruleDate = new Date(r.specific_date!)
      if (ruleDate.getMonth() !== undefined && ruleDate.getDate() !== undefined) {
        return dt.getMonth() === ruleDate.getMonth() && dt.getDate() === ruleDate.getDate()
      }
    }
    if (r.rule_type === 'date_range') {
      const from = r.date_from ? new Date(r.date_from) : null
      const to = r.date_to ? new Date(r.date_to) : null
      if (from && to) {
        return dt >= from && dt <= to
      }
    }
    if (r.rule_type === 'day_of_week' && r.days_of_week) {
      const dayNum = dt.getDay() === 0 ? 7 : dt.getDay()
      return r.days_of_week.includes(dayNum)
    }
    if (r.rule_type === 'time_range' && r.days_of_week && r.start_time && r.end_time) {
      const dayNum = dt.getDay() === 0 ? 7 : dt.getDay()
      if (!r.days_of_week.includes(dayNum)) return false
      return currentTime >= r.start_time.slice(0, 5) && currentTime < r.end_time.slice(0, 5)
    }
    return false
  })

  if (matchingRule) {
    dynamicMultiplier = matchingRule.multiplier
    dynamicRuleName = matchingRule.name
  }

  // Techos por distancia (anillos) de la geofence: el subtotal se topa en el
  // máximo del anillo que alcanza la distancia, ANTES de aplicar las reglas
  // dinámicas de fecha (en festivos se paga por encima del techo).
  let fare = subtotal
  const rings = zoneGeo?.rings as Array<Record<string, any>> | undefined
  if (rings && rings.length) {
    for (const r of rings) {
      const maxKm = Number(r.max_km) || 0
      if (input.distance_km <= maxKm) {
        const cap = input.vehicle_type === 'moto' ? Number(r.moto) : Number(r.car)
        if (cap > 0) fare = Math.min(fare, cap)
        break
      }
    }
  }
  fare = fare * dynamicMultiplier
  const specialZoneApplied = false

  // Tarifa mínima según vehículo y turno, y redondeo a la centena.
  // En el caso de viaje corto diurno el piso es la propia mínima (tarifa plana).
  const floor = shortDayTrip ? minimumFare : Math.max(minimumFare, base)
  const finalAmount = round100(Math.max(fare, floor))
  const commissionPct = card?.commission_percent || 12
  const commissionAmount = finalAmount * (commissionPct / 100)
  const driverEarnings = finalAmount - commissionAmount

  return {
    vehicle_type: input.vehicle_type,
    day_type: schedule?.day_type || dayType,
    shift_label: schedule?.window_label || schedule?.shift_label || 'day',
    shift_start: shiftStart || '05:00',
    shift_end: shiftEnd || '18:29',
    base_fee_at_shift_start: base,
    hours_since_shift_start: Math.round(hoursElapsed * 100) / 100,
    hourly_increase_percent: hourlyPct,
    current_base_fee: Math.round(baseAdjusted),
    included_km: 1.5,
    distance_km: input.distance_km,
    extra_km: Math.round(extraKm * 100) / 100,
    extra_km_percent: tier1Rate,
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
    special_zone_applied: specialZoneApplied,
  }
}