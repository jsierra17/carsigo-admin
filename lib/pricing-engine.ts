import { createAdminClient } from './supabase/service'

export type VehicleType = 'moto' | 'car'
export type DayType = 'weekday' | 'weekend' | 'special'

export interface PricingInput {
  vehicle_type: VehicleType
  distance_km: number
  duration_min: number
  datetime?: Date
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
}

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

function getDayType(date: Date): DayType {
  const day = date.getDay()
  if (day === 0 || day === 6) return 'weekend'
  return 'weekday'
}

export async function calculateFare(input: PricingInput): Promise<PricingBreakdown> {
  const supabase = createAdminClient()
  const dt = input.datetime || new Date()
  const dayType = getDayType(dt)
  const currentTime = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`

  const { data: schedules } = await supabase
    .from('rate_schedules')
    .select('*')
    .eq('vehicle_type', input.vehicle_type)
    .eq('day_type', dayType)
    .eq('is_active', true)

  const schedule = (schedules || []).find(s => {
    if (s.shift_end <= s.shift_start) {
      return currentTime >= s.shift_start || currentTime < s.shift_end
    }
    return currentTime >= s.shift_start && currentTime < s.shift_end
  }) || (schedules || [])[0]

  const { data: cards } = await supabase
    .from('rate_cards')
    .select('*')
    .eq('vehicle_type', input.vehicle_type)
    .eq('is_active', true)
    .limit(1)

  const card = (cards || [])[0]

  const hoursSince = schedule
    ? getHoursSince(schedule.shift_start, schedule.shift_end, dt)
    : 0
  const hourlyPct = schedule ? schedule.hourly_increase_percent : 0
  const baseFee = schedule ? schedule.base_fee : (card?.base_fee || 0)
  const currentBaseFee = baseFee * Math.pow(1 + hourlyPct / 100, hoursSince)

  const includedKm = card?.included_km || 2
  const extraKmPct = card?.extra_km_percent || 50
  const extraKm = Math.max(0, input.distance_km - includedKm)
  const extraKmCharge = extraKm * (currentBaseFee * extraKmPct / 100)

  let subtotal = currentBaseFee + extraKmCharge

  const { data: rules } = await supabase
    .from('dynamic_pricing_rules')
    .select('*')
    .eq('is_active', true)
    .or(`vehicle_type.eq.${input.vehicle_type},vehicle_type.is.null`)
    .gte('priority', 0)
    .order('priority', { ascending: false })

  let dynamicMultiplier = 1.0
  let dynamicRuleName: string | null = null

  const matchingRule = (rules || []).find(r => {
    if (r.rule_type === 'specific_date' && r.is_recurring) {
      const ruleDate = new Date(r.specific_date)
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

  const finalFare = subtotal * dynamicMultiplier
  const minimumFare = card?.minimum_fare || 5000
  const commissionPct = card?.commission_percent || 10
  const finalAmount = Math.max(finalFare, minimumFare)
  const commissionAmount = finalAmount * (commissionPct / 100)
  const driverEarnings = finalAmount - commissionAmount

  return {
    vehicle_type: input.vehicle_type,
    day_type: schedule?.day_type || dayType,
    shift_label: schedule?.shift_label || 'morning',
    shift_start: schedule?.shift_start || '04:30',
    shift_end: schedule?.shift_end || '16:29',
    base_fee_at_shift_start: baseFee,
    hours_since_shift_start: Math.round(hoursSince * 100) / 100,
    hourly_increase_percent: hourlyPct,
    current_base_fee: Math.round(currentBaseFee),
    included_km: includedKm,
    distance_km: input.distance_km,
    extra_km: extraKm,
    extra_km_percent: extraKmPct,
    extra_km_charge: Math.round(extraKmCharge),
    subtotal: Math.round(subtotal),
    dynamic_multiplier: dynamicMultiplier,
    dynamic_rule_name: dynamicRuleName,
    final_fare: Math.round(finalAmount),
    minimum_fare: minimumFare,
    commission_percent: commissionPct,
    commission_amount: Math.round(commissionAmount),
    driver_earnings: Math.round(driverEarnings),
  }
}
