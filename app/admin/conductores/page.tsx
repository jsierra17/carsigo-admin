'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

type DriverProfile = {
  user_id: string;
  vehicle_type: 'car' | 'motorcycle';
  plate: string;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  users: { name: string; phone: string; };
};

export default function GestionConductores() {
  const [drivers, setDrivers] = useState<DriverProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    fetchDrivers();
  }, []);

  const fetchDrivers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('driver_profiles')
      .select('user_id, vehicle_type, plate, status, users(name, phone)');
    if (!error) setDrivers(data as any);
    setLoading(false);
  };

  const updateStatus = async (userId: string, newStatus: string) => {
    const { error } = await supabase
      .from('driver_profiles')
      .update({ status: newStatus })
      .eq('user_id', userId);
    
    if (!error) {
      alert(`Estado actualizado a ${newStatus}`);
      fetchDrivers();
    }
  };

  const deleteDriver = async (userId: string) => {
    if (!confirm('¿Estás SEGURO de eliminar este conductor? Esta acción no se puede deshacer.')) return;
    
    const { error } = await supabase.from('driver_profiles').delete().eq('user_id', userId);
    if (!error) fetchDrivers();
  };

  const filteredDrivers = drivers.filter(d => 
    d.users?.name?.toLowerCase().includes(filter.toLowerCase()) || 
    d.plate.toLowerCase().includes(filter.toLowerCase())
  );

  if (loading) return <div className="p-10 text-center">Cargando base de datos...</div>;

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestión de Conductores</h1>
          <p className="text-gray-500">Administra, aprueba o bloquea conductores de la plataforma.</p>
        </div>
        <input 
          type="text"
          placeholder="Buscar por nombre o placa..."
          className="px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 w-full md:w-80"
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-50 text-gray-600 text-sm uppercase font-bold border-b">
            <tr>
              <th className="p-4">Conductor</th>
              <th className="p-4">Vehículo</th>
              <th className="p-4">Estado</th>
              <th className="p-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredDrivers.map((driver) => (
              <tr key={driver.user_id} className="hover:bg-gray-50 transition-colors">
                <td className="p-4">
                  <div className="font-bold text-gray-900">{driver.users?.name}</div>
                  <div className="text-sm text-gray-500">{driver.users?.phone}</div>
                </td>
                <td className="p-4">
                  <span className="text-xs font-bold px-2 py-1 bg-gray-100 rounded mr-2 uppercase">
                    {driver.vehicle_type === 'car' ? '🚗 Carro' : '🏍️ Moto'}
                  </span>
                  <code className="text-blue-600 font-bold">{driver.plate}</code>
                </td>
                <td className="p-4">
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                    driver.status === 'approved' ? 'bg-green-100 text-green-700' :
                    driver.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {driver.status.toUpperCase()}
                  </span>
                </td>
                <td className="p-4 text-right space-x-2">
                  {driver.status === 'pending' && (
                    <button onClick={() => updateStatus(driver.user_id, 'approved')} className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 font-bold">Aprobar</button>
                  )}
                  {driver.status !== 'suspended' && (
                    <button onClick={() => updateStatus(driver.user_id, 'suspended')} className="text-xs bg-orange-500 text-white px-3 py-1.5 rounded-lg hover:bg-orange-600 font-bold">Bloquear</button>
                  )}
                  <button onClick={() => deleteDriver(driver.user_id)} className="text-xs bg-red-100 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-200 font-bold">Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredDrivers.length === 0 && (
          <div className="p-20 text-center text-gray-400">No se encontraron conductores.</div>
        )}
      </div>
    </div>
  );
}