/**
 * Tipos del dominio CarSiGo (declarados como JSDoc para el proyecto Vue en JS).
 *
 * @typedef {'Pendiente'|'Aprobado'|'Rechazado'} DriverStatus
 * @typedef {'Activo'|'Inactivo'} ZoneStatus
 * @typedef {'car'|'moto'} VehicleType
 * @typedef {'weekday'|'weekend'|'special'} DayType
 * @typedef {'morning'|'evening'} ShiftLabel
 * @typedef {'time_range'|'day_of_week'|'specific_date'|'date_range'|'demand_zone'|'event'} DynamicPricingRuleType
 *
 * @typedef {Object} Driver
 * @property {string} id
 * @property {string} name
 * @property {string} vehicle
 * @property {string} plate
 * @property {string} date
 * @property {DriverStatus} status
 * @property {{cedula:string, tarjetaPropiedad:string}} documents
 *
 * @typedef {Object} Zone
 * @property {string} id
 * @property {string} name
 * @property {ZoneStatus} status
 * @property {string} description
 *
 * @typedef {Object} RateCard
 * @property {string} id
 * @property {VehicleType} vehicle_type
 * @property {number} base_fee
 * @property {number} minimum_fare
 * @property {number} included_km
 * @property {number} tier1_max_km
 * @property {number} tier1_rate_per_km
 * @property {number} tier2_max_km
 * @property {number} tier2_rate_per_km
 * @property {number} commission_percent
 * @property {string} zone_id
 * @property {boolean} is_active
 *
 * @typedef {Object} RateSchedule
 * @property {string} id
 * @property {VehicleType} vehicle_type
 * @property {DayType} day_type
 * @property {ShiftLabel} shift_label
 * @property {string} start_time
 * @property {string} end_time
 * @property {number} base_fee
 * @property {number} hourly_increase_percent
 * @property {string} zone_id
 * @property {boolean} is_active
 *
 * @typedef {Object} DynamicPricingRule
 * @property {string} id
 * @property {string} name
 * @property {DynamicPricingRuleType} rule_type
 * @property {number} multiplier
 * @property {number} priority
 * @property {boolean} is_active
 * @property {string|null} vehicle_type
 * @property {string|null} zone_id
 * @property {string|null} specific_date
 * @property {boolean} is_recurring
 * @property {string|null} date_from
 * @property {string|null} date_to
 * @property {number[]} days_of_week
 * @property {string|null} start_time
 * @property {string|null} end_time
 */

export {}
