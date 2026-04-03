'use client';

import { useState, useEffect } from 'react';
import { MapPin, Navigation, CheckCircle, XCircle, Clock, Car, Filter, RefreshCw } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type Viaje = {
  id: string;
  status: string;
  fare_amount: number;
  commission_amount: number;
  pickup_address: string;
  dropoff_address: string;
  created_at: string;
  completed_at: string | null;
  passenger: { name: string; phone: string } | null;
  driver: { name: string; phone: string } | null;
};

// ─── Utilidades de estado ─────────────────────────────────────────────────────
const estadoConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  active: {
    label: 'En Curso',
    color: 'bg-blue-50 text-blue-600 border-blue-100',
    icon: <Navigation size={11} />,
  },
  completed: {
    label: 'Completado',
    color: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    icon: <CheckCircle size={11} />,
  },
  cancelled: {
    label: 'Cancelado',
    color: 'bg-red-50 text-red-500 border-red-100',
    icon: <XCircle size={11} />,
  },
  pending: {
    label: 'Pendiente',
    color: 'bg-amber-50 text-amber-600 border-amber-100',
    icon: <Clock size={11} />,
  },
};

const filtroTabs = [
  { key: 'all', label: 'Todos' },
  { key: 'active', label: 'En Curso' },
  { key: 'completed', label: 'Completados' },
  { key: 'cancelled', label: 'Cancelados' },
];

export default function ViajesPage() {
  const supabase = createClient();
  const [viajes, setViajes] = useState<Viaje[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filtro, setFiltro] = useState('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchViajes = async () => {
    setIsLoading(true);
    try {
      // Consultar la tabla 'trips' con joins a usuarios (pasajero y conductor)
      let query = supabase
        .from('trips')
        .select(`
          id, status, fare_amount, commission_amount,
          pickup_address, dropoff_address,
          created_at, completed_at,
          passenger:users!trips_passenger_id_fkey ( name, phone ),
          driver:users!trips_driver_id_fkey ( name, phone )
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      // Aplicar filtro de estado si no es "todos"
      if (filtro !== 'all') {
        query = query.eq('status', filtro);
      }

      const { data, error } = await query;

      if (error) {
        // La tabla trips aún puede no existir; mostrar estado vacío limpiamente
        console.warn('Tabla de viajes no disponible aún:', error.message);
        setViajes([]);
      } else {
        setViajes((data as any[]) || []);
      }
    } catch (err) {
      console.error('Error cargando viajes:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => { fetchViajes(); }, [filtro]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchViajes();
  };

  // Resumen de conteos por estado
  const conteos = {
    active: viajes.filter(v => v.status === 'active').length,
    completed: viajes.filter(v => v.status === 'completed').length,
    cancelled: viajes.filter(v => v.status === 'cancelled').length,
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">

      {/* Encabezado */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg border border-blue-100 shadow-sm">
              <Car size={20} />
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter">Historial de Viajes</h1>
          </div>
          <p className="text-slate-500 font-medium">Registro completo de todos los viajes realizados en la plataforma.</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-5 py-3 bg-white border border-gray-200 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50"
        >
          <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </div>

      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'En Curso', valor: conteos.active, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100', icono: <Navigation size={20} /> },
          { label: 'Completados', valor: conteos.completed, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100', icono: <CheckCircle size={20} /> },
          { label: 'Cancelados', valor: conteos.cancelled, color: 'text-red-500', bg: 'bg-red-50', border: 'border-red-100', icono: <XCircle size={20} /> },
        ].map(item => (
          <div key={item.label} className={`bg-white border ${item.border} p-6 rounded-[2rem] shadow-sm flex items-center gap-5`}>
            <div className={`p-3 ${item.bg} ${item.color} rounded-2xl border ${item.border}`}>
              {item.icono}
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.label}</p>
              <p className={`text-3xl font-black ${item.color} tracking-tighter`}>{isLoading ? '—' : item.valor}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filtros de estado */}
      <div className="flex bg-white border border-gray-200 rounded-2xl p-1 shadow-sm self-start w-fit gap-1">
        {filtroTabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setFiltro(tab.key)}
            className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              filtro === tab.key
                ? 'bg-[#00E5FF] text-[#131313] shadow-md scale-105'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tabla de viajes */}
      <div className="bg-white border border-gray-100 rounded-[2.5rem] shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-20 flex flex-col items-center justify-center gap-4">
            <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
            <p className="text-slate-400 font-bold text-sm">Cargando viajes...</p>
          </div>
        ) : viajes.length === 0 ? (
          <div className="p-20 text-center">
            <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <MapPin className="text-slate-200" size={32} />
            </div>
            <h4 className="text-lg font-black text-slate-400 uppercase tracking-tighter">Sin Viajes Registrados</h4>
            <p className="text-slate-300 text-sm mt-2 max-w-xs mx-auto font-medium">
              {filtro === 'all'
                ? 'Aún no hay viajes en la plataforma. Aparecerán aquí una vez que los usuarios comiencen a usarla.'
                : `No hay viajes con estado "${filtroTabs.find(t => t.key === filtro)?.label}".`}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 border-b border-gray-100">
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Estado</th>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Pasajero</th>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest hidden lg:table-cell">Conductor</th>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest hidden xl:table-cell">Ruta</th>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Tarifa</th>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Comisión</th>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {viajes.map(v => {
                  const cfg = estadoConfig[v.status] || estadoConfig['pending'];
                  return (
                    <tr key={v.id} className="hover:bg-slate-50/40 transition-colors">
                      <td className="px-6 py-5">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${cfg.color}`}>
                          {cfg.icon} {cfg.label}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <p className="font-bold text-slate-800 text-xs">{(v.passenger as any)?.name || '—'}</p>
                        <p className="text-[10px] text-slate-400 font-medium">{(v.passenger as any)?.phone || ''}</p>
                      </td>
                      <td className="px-6 py-5 hidden lg:table-cell">
                        <p className="font-bold text-slate-800 text-xs">{(v.driver as any)?.name || '—'}</p>
                        <p className="text-[10px] text-slate-400 font-medium">{(v.driver as any)?.phone || ''}</p>
                      </td>
                      <td className="px-6 py-5 hidden xl:table-cell max-w-[200px]">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-600 font-medium">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></div>
                            <span className="truncate">{v.pickup_address || '—'}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-600 font-medium">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></div>
                            <span className="truncate">{v.dropoff_address || '—'}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <span className="font-black text-sm text-slate-800">
                          ${(v.fare_amount || 0).toLocaleString('es-CO')}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <span className="font-black text-sm text-emerald-600">
                          ${(v.commission_amount || 0).toLocaleString('es-CO')}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <p className="text-xs font-bold text-slate-600">
                          {new Date(v.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {new Date(v.created_at).toLocaleTimeString('es-CO', { timeStyle: 'short' })}
                        </p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
