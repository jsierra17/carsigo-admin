'use client';

import { useState, useEffect } from 'react';
import { MapPin, Navigation, CheckCircle, XCircle, Clock, Car, Filter, RefreshCw } from 'lucide-react';
import { createClient } from '@/lib/firebase/client';

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
    color: 'bg-[#00E5FF]/10 text-[#00E5FF] border-[#00E5FF]/20',
    icon: <Navigation size={11} />,
  },
  completed: {
    label: 'Completado',
    color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    icon: <CheckCircle size={11} />,
  },
  cancelled: {
    label: 'Cancelado',
    color: 'bg-red-500/10 text-red-400 border-red-500/20',
    icon: <XCircle size={11} />,
  },
  pending: {
    label: 'Pendiente',
    color: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
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
  const db = createClient();
  const [viajes, setViajes] = useState<Viaje[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filtro, setFiltro] = useState('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchViajes = async () => {
    setIsLoading(true);
    try {
      // Consultar la tabla 'trips' con joins a usuarios (pasajero y conductor)
      let query = db
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
            <div className="p-2.5 rounded-xl bg-[#00E5FF]/10 text-[#00E5FF]">
              <Car size={20} />
            </div>
            <h1 className="text-3xl font-black text-white tracking-tighter">Historial de Viajes</h1>
          </div>
          <p className="text-slate-400 font-medium">Registro completo de todos los viajes realizados en la plataforma.</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-5 py-3 bg-white/5 border border-white/10 text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#00E5FF]/10 hover:border-[#00E5FF]/30 hover:text-[#00E5FF] transition-all shadow-sm disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[#00E5FF]/60"
        >
          <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </div>

      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'En Curso', valor: conteos.active, color: 'text-[#00E5FF]', bg: 'bg-[#00E5FF]/10', border: 'border-[#00E5FF]/20', icono: <Navigation size={20} /> },
          { label: 'Completados', valor: conteos.completed, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icono: <CheckCircle size={20} /> },
          { label: 'Cancelados', valor: conteos.cancelled, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', icono: <XCircle size={20} /> },
        ].map(item => (
          <div key={item.label} className={`bg-[#141416] border ${item.border} p-6 rounded-3xl shadow-sm flex items-center gap-5 transition-all`}>
            <div className={`p-3 ${item.bg} ${item.color} rounded-xl border ${item.border}`}>
              {item.icono}
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{item.label}</p>
              <p className={`text-3xl font-bold ${item.color} tracking-tighter tabular-nums`}>{isLoading ? '—' : item.valor}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filtros de estado */}
      <div className="flex bg-white/5 border border-white/10 rounded-2xl p-1 shadow-sm self-start w-fit gap-1">
        {filtroTabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setFiltro(tab.key)}
            className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all focus-visible:ring-2 focus-visible:ring-[#00E5FF]/60 ${
              filtro === tab.key
                ? 'bg-[#00E5FF] text-[#131313] shadow-md scale-105'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tabla de viajes */}
      <div className="bg-[#141416] border border-white/5 rounded-3xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-20 flex flex-col items-center justify-center gap-4">
            <div className="w-12 h-12 border-4 border-white/10 border-t-[#00E5FF] rounded-full animate-spin"></div>
            <p className="text-slate-400 font-bold text-sm">Cargando viajes...</p>
          </div>
        ) : viajes.length === 0 ? (
          <div className="p-20 text-center">
            <div className="w-20 h-20 bg-white/10 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <MapPin className="text-slate-500 opacity-20" size={32} />
            </div>
            <h4 className="text-lg font-black text-slate-400 uppercase tracking-tighter">Sin Viajes Registrados</h4>
            <p className="text-slate-400 text-sm mt-2 max-w-xs mx-auto font-medium">
              {filtro === 'all'
                ? 'Aún no hay viajes en la plataforma. Aparecerán aquí una vez que los usuarios comiencen a usarla.'
                : `No hay viajes con estado "${filtroTabs.find(t => t.key === filtro)?.label}".`}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-white/2 border-b border-white/5">
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Estado</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Pasajero</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] hidden lg:table-cell">Conductor</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] hidden xl:table-cell">Ruta</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Tarifa</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Comisión</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {viajes.map(v => {
                  const cfg = estadoConfig[v.status] || estadoConfig['pending'];
                  return (
                    <tr key={v.id} className="hover:bg-[#00E5FF]/5 transition-all">
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${cfg.color}`}>
                          {cfg.icon} {cfg.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-bold text-white text-xs">{(v.passenger as any)?.name || '—'}</p>
                        <p className="text-[10px] text-slate-500 font-medium">{(v.passenger as any)?.phone || ''}</p>
                      </td>
                      <td className="px-6 py-4 hidden lg:table-cell">
                        <p className="font-bold text-white text-xs">{(v.driver as any)?.name || '—'}</p>
                        <p className="text-[10px] text-slate-500 font-medium">{(v.driver as any)?.phone || ''}</p>
                      </td>
                      <td className="px-6 py-4 hidden xl:table-cell max-w-[200px]">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#00E5FF] shrink-0"></div>
                            <span className="truncate">{v.pickup_address || '—'}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></div>
                            <span className="truncate">{v.dropoff_address || '—'}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-black text-sm text-white">
                          ${(v.fare_amount || 0).toLocaleString('es-CO')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-black text-sm text-emerald-400">
                          ${(v.commission_amount || 0).toLocaleString('es-CO')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-xs font-bold text-slate-300">
                          {new Date(v.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
                        </p>
                        <p className="text-[10px] text-slate-500">
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
