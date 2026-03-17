'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export default function ConductoresActivos() {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActiveDrivers();
  }, []);

  async function fetchActiveDrivers() {
    setLoading(true);
    // Filtramos solo por los que tienen estado 'approved'
    const { data, error } = await supabase
      .from('driver_profiles')
      .select('user_id, vehicle_type, plate, status, users(name, phone)')
      .eq('status', 'approved');

    if (!error) setDrivers(data as any);
    setLoading(false);
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Conductores Activos</h1>
          <p className="text-gray-500">Personal que se encuentra actualmente habilitado en la plataforma.</p>
        </div>
        <div className="bg-green-100 text-green-700 px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-ping"></span>
          {drivers.length} Conductores en línea
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {drivers.map((driver: any) => (
          <div key={driver.user_id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-xl">
                {driver.vehicle_type === 'car' ? '🚗' : '🏍️'}
              </div>
              <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded uppercase">
                Verificado
              </span>
            </div>
            
            <h3 className="font-bold text-gray-900 text-lg">{driver.users?.name}</h3>
            <p className="text-sm text-gray-500 mb-4">{driver.users?.phone}</p>
            
            <div className="flex items-center justify-between pt-4 border-t border-gray-50">
              <div className="text-xs text-gray-400">Placa: <span className="font-mono font-bold text-gray-700">{driver.plate}</span></div>
              <button className="text-xs font-bold text-blue-600 hover:underline">Ver Historial</button>
            </div>
          </div>
        ))}
      </div>

      {drivers.length === 0 && !loading && (
        <div className="bg-white rounded-2xl p-20 text-center border-2 border-dashed border-gray-100">
          <p className="text-gray-400">No hay conductores activos en este momento.</p>
        </div>
      )}
    </div>
  );
}