export type DriverStatus = 'Pendiente' | 'Aprobado' | 'Rechazado';

export interface Driver {
  id: string;
  name: string;
  vehicle: string;
  plate: string;
  date: string;
  status: DriverStatus;
  documents: {
    cedula: string;
    tarjetaPropiedad: string;
  };
}

export type ZoneStatus = 'Activo' | 'Inactivo';

export interface Zone {
  id: string;
  name: string;
  status: ZoneStatus;
  description: string;
}

export type VehicleType = 'car' | 'moto';

export interface RateCard {
  id: string;
  name: string;
  vehicle_type: VehicleType;
  base_fee: number;
  price_per_km: number;
  price_per_minute: number;
  minimum_fare: number;
  free_waiting_minutes: number;
  waiting_price_per_minute: number;
  commission_percent: number;
  is_active: boolean;
  created_at: string;
}

export type DynamicPricingRuleType = 'time_range' | 'day_of_week' | 'specific_date' | 'date_range' | 'demand_zone' | 'event';

export interface DynamicPricingRule {
  id: string;
  name: string;
  description: string | null;
  rule_type: DynamicPricingRuleType;
  start_time: string | null;
  end_time: string | null;
  days_of_week: number[] | null;
  specific_date: string | null;
  is_recurring: boolean;
  date_from: string | null;
  date_to: string | null;
  multiplier: number;
  flat_surcharge: number;
  geofence_id: string | null;
  is_active: boolean;
  priority: number;
  created_at: string;
}
