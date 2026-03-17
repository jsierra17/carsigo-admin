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
