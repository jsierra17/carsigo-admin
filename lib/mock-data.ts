import { Driver, Zone } from './types';

export const mockDrivers: Driver[] = [
  {
    id: 'd1',
    name: 'Juan Perez',
    vehicle: 'Toyota Corolla 2020',
    plate: 'ABC-123',
    date: '2026-03-10',
    status: 'Pendiente',
    documents: {
      cedula: 'cedula_juan.jpg',
      tarjetaPropiedad: 'tarjeta_juan.jpg',
    },
  },
  {
    id: 'd2',
    name: 'Maria Gomez',
    vehicle: 'Kia Picanto 2022',
    plate: 'XYZ-987',
    date: '2026-03-12',
    status: 'Pendiente',
    documents: {
      cedula: 'cedula_maria.jpg',
      tarjetaPropiedad: 'tarjeta_maria.jpg',
    },
  },
  {
    id: 'd3',
    name: 'Carlos Rodriguez',
    vehicle: 'Chevrolet Spark 2019',
    plate: 'JKL-456',
    date: '2026-03-13',
    status: 'Pendiente',
    documents: {
      cedula: 'cedula_carlos.jpg',
      tarjetaPropiedad: 'tarjeta_carlos.jpg',
    },
  },
];

export const mockZones: Zone[] = [
  {
    id: 'z1',
    name: 'Centro Histórico',
    status: 'Activo',
    description: 'Zona principal de la ciudad, alta demanda comercial.',
  },
  {
    id: 'z2',
    name: 'Zona Norte',
    status: 'Activo',
    description: 'Área residencial de ingresos altos, demanda media.',
  },
  {
    id: 'z3',
    name: 'Zona Sur',
    status: 'Inactivo',
    description: 'Próxima área de expansión. Actualmente sin servicio.',
  },
  {
    id: 'z4',
    name: 'Aeropuerto',
    status: 'Activo',
    description: 'Zona de alta prioridad para viajes largos.',
  },
];
