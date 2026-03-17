'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

// 1. CONEXIÓN A SUPABASE DIRECTA
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 2. DEFINICIÓN DE LOS DATOS
type DriverProfile = {
  user_id: string;
  vehicle_type: 'car' | 'motorcycle';
  plate: string;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  created_at: string;
  users: {
    name: string;
    phone: string;
  };
};

// 3. LA PANTALLA PRINCIPAL
export default function ConductoresPendientes() {
  const [drivers, setDrivers] = useState<DriverProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPendingDrivers();
  }, []);

  const fetchPendingDrivers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('driver_profiles')
        .select(`
          user_id,
          vehicle_type,
          plate,
          status,
          created_at,
          users ( name, phone )
        `)
        .eq('status', 'pending');

      if (error) throw error;
      setDrivers(data as any);
    } catch (err: any) {
      setError('No se pudieron cargar los conductores pendientes.');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (userId: string, driverName: string) => {
    if (!window.confirm(`¿Estás seguro de aprobar al conductor ${driverName}?`)) return;

    try {
      const { error } = await supabase
        .from('driver_profiles')
        .update({ status: 'approved' })
        .eq('user_id', userId);

      if (error) throw error;
      alert(`Conductor ${driverName} aprobado exitosamente.`);
      fetchPendingDrivers();
    } catch (err: any) {
      alert(`Error al aprobar: ${err.message}`);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Cargando lista de conductores...</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Aprobación de Conductores</h1>
      
      {drivers.length === 0 ? (
        <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl p-12 text-center text-gray-500">
          No hay conductores pendientes.
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 text-sm font-semibold">
              <tr>
                <th className="p-4">Nombre y Contacto</th>
                <th className="p-4">Vehículo</th>
                <th className="p-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {drivers.map((driver) => (
                <tr key={driver.user_id} className="hover:bg-gray-50">
                  <td className="p-4">
                    <div className="font-medium text-gray-900">{driver.users?.name || 'Sin nombre'}</div>
                    <div className="text-sm text-gray-500">{driver.users?.phone || 'Sin teléfono'}</div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                        {driver.vehicle_type === 'motorcycle' ? 'Moto' : 'Auto'}
                      </span>
                      <span className="text-sm font-mono text-gray-600 border px-2 rounded">
                        {driver.plate}
                      </span>
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <button 
                      onClick={() => handleApprove(driver.user_id, driver.users?.name || 'Conductor')}
                      className="bg-green-100 text-green-700 px-4 py-2 rounded-lg font-bold hover:bg-green-200"
                    >
                      Aprobar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}