'use client';

import { useState, useEffect, useTransition } from 'react';
import { Search, Filter, ShieldAlert, CheckCircle, Clock, MoreVertical, Car, Phone, Mail, UserCheck, UserX, AlertTriangle, Eye } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { approveDriver, suspendDriver, toggleDriverStatus } from './actions';

type Conductor = {
  id: string;
  name: string;
  phone: string;
  email: string;
  created_at: string;
  driver_profiles: {
    vehicle_type: string;
    plate: string;
    status: string;
    total_rides: number;
  }[];
};

export default function ConductoresPage() {
  const [conductores, setConductores] = useState<Conductor[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [menuAbierto, setMenuAbierto] = useState<string | null>(null);

  const fetchConductores = async (termino = '', estado = 'all') => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('users')
        .select(`
          id, name, phone, email, created_at,
          driver_profiles ( vehicle_type, plate, status, total_rides )
        `)
        .eq('role', 'driver');

      if (termino) {
        query = query.or(`name.ilike.%${termino}%,phone.ilike.%${termino}%,email.ilike.%${termino}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      let filtrados = data as Conductor[] || [];
      
      // Filtro manual sobre el estado del perfil
      if (estado !== 'all') {
        filtrados = filtrados.filter(c => c.driver_profiles?.[0]?.status === estado);
      }

      setConductores(filtrados);
    } catch (error) {
      console.error('Error cargando conductores:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => fetchConductores(busqueda, filtroEstado), 500);
    return () => clearTimeout(timer);
  }, [busqueda, filtroEstado]);

  const handleAction = async (driverId: string, action: 'approve' | 'suspend') => {
    setMenuAbierto(null);
    startTransition(async () => {
      const result = action === 'approve' ? await approveDriver(driverId) : await suspendDriver(driverId);
      if (result.success) {
        fetchConductores(busqueda, filtroEstado);
      }
    });
  };

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'active':
        return <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-black uppercase tracking-widest"><CheckCircle size={12} /> Activo</div>;
      case 'pending':
        return <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 text-[10px] font-black uppercase tracking-widest"><Clock size={12} /> Pendiente</div>;
      case 'suspended':
        return <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] font-black uppercase tracking-widest"><ShieldAlert size={12} /> Suspendido</div>;
      default:
        return <div className="px-3 py-1 rounded-full bg-slate-800 text-slate-400 text-[10px] font-black">N/A</div>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      
      {/* Encabezado Premium Light */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg border border-blue-100 shadow-sm">
              <ShieldAlert size={20} />
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter">Auditoría de Flota</h1>
          </div>
          <p className="text-slate-500 font-medium">Control total sobre conductores, aprobaciones y cumplimiento de normas.</p>
        </div>
        
        <div className="flex bg-white border border-gray-200 rounded-2xl p-1 shadow-sm">
          {['all', 'pending', 'active', 'suspended'].map((tab) => (
            <button
              key={tab}
              onClick={() => setFiltroEstado(tab)}
              className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                filtroEstado === tab ? 'bg-[#00E5FF] text-[#131313] shadow-md scale-105' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {tab === 'all' ? 'Todos' : tab === 'pending' ? 'Pendientes' : tab === 'active' ? 'Activos' : 'Suspendidos'}
            </button>
          ))}
        </div>
      </div>

      {/* Buscador Avanzado Light */}
      <div className="bg-white border border-gray-100 p-4 rounded-3xl shadow-sm relative group">
        <div className="absolute inset-y-0 left-8 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[#00C0D4] transition-colors">
          <Search size={20} />
        </div>
        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full pl-16 pr-8 py-5 bg-slate-50/50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-[#00E5FF]/10 focus:border-[#00E5FF]/30 outline-none font-bold text-slate-800 transition-all placeholder:text-slate-400"
          placeholder="Busca por Nombre, Teléfono, Vehículo o ID de Conductor..."
        />
      </div>

      {/* Grid de Conductores Light */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-64 bg-slate-100 rounded-3xl animate-pulse"></div>
          ))
        ) : conductores.length === 0 ? (
          <div className="col-span-full py-32 text-center bg-white rounded-[3rem] border border-dashed border-gray-200">
            <Car size={64} className="mx-auto mb-6 text-slate-100" />
            <h3 className="text-xl font-black text-slate-400">No se encontraron resultados</h3>
            <p className="text-slate-300 mt-2 font-medium">Ajusta los filtros o intenta con otro término de búsqueda.</p>
          </div>
        ) : (
          conductores.map((driver) => {
            const perfil = driver.driver_profiles?.[0];
            const status = perfil?.status || 'pending';

            return (
              <div key={driver.id} className="group bg-white border border-gray-100 rounded-[2.5rem] hover:shadow-xl hover:border-blue-100 transition-all duration-500 relative overflow-hidden flex flex-col h-full">
                
                <div className="p-8 flex-1">
                  <div className="flex justify-between items-start mb-6">
                    <div className="w-16 h-16 rounded-[1.5rem] bg-slate-50 flex items-center justify-center text-[#00606b] font-black text-2xl border border-gray-100 group-hover:scale-110 transition-transform">
                      {driver.name?.charAt(0) || 'C'}
                    </div>
                    {getStatusDisplay(status)}
                  </div>

                  <div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight leading-tight group-hover:text-blue-600 transition-colors uppercase">{driver.name}</h3>
                    <p className="text-[10px] text-slate-400 font-black tracking-[0.2em] mt-1">ID: {driver.id.substring(0, 12)}...</p>
                  </div>

                  <div className="mt-8 space-y-3">
                    <div className="flex items-center gap-3 text-sm text-slate-600 font-bold bg-slate-50/50 p-3 rounded-2xl border border-gray-50">
                      <div className="p-1.5 bg-blue-100 text-blue-600 rounded-lg"><Phone size={14} /></div>
                      {driver.phone}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-slate-600 font-bold bg-slate-50/50 p-3 rounded-2xl border border-gray-50">
                      <div className="p-1.5 bg-cyan-100 text-cyan-600 rounded-lg"><Car size={14} /></div>
                      {perfil?.plate || 'SIN PLACA'} • {perfil?.vehicle_type || 'ESTÁNDAR'}
                    </div>
                  </div>
                </div>

                {/* Footer de Tarjeta Light */}
                <div className="p-6 bg-slate-50/50 border-t border-gray-100 flex items-center justify-between mt-auto">
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className={`w-1 h-1 rounded-full ${i < 4 ? 'bg-[#00E5FF]' : 'bg-slate-200'}`}></div>
                    ))}
                    <span className="text-[9px] font-black text-slate-400 ml-2 uppercase">Score: 4.8</span>
                  </div>

                  <div className="relative">
                    <button 
                      onClick={() => setMenuAbierto(menuAbierto === driver.id ? null : driver.id)}
                      className="p-3 hover:bg-white text-slate-400 hover:text-slate-900 rounded-xl transition-all border border-transparent hover:border-gray-200"
                    >
                      <MoreVertical size={20} />
                    </button>

                    {menuAbierto === driver.id && (
                      <>
                        <div className="fixed inset-0 z-30" onClick={() => setMenuAbierto(null)}></div>
                        <div className="absolute right-0 bottom-full mb-3 w-56 bg-white border border-gray-200 rounded-2xl shadow-2xl z-40 py-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
                          <button className="w-full text-left px-4 py-3 text-xs text-slate-600 hover:bg-slate-50 flex items-center gap-3 font-bold uppercase tracking-widest transition-colors">
                            <Eye size={16} className="text-blue-500" /> Ver Documentación
                          </button>
                          
                          {status !== 'active' && (
                            <button 
                              onClick={() => handleAction(driver.id, 'approve')}
                              disabled={isPending}
                              className="w-full text-left px-4 py-3 text-xs text-emerald-600 hover:bg-emerald-50 flex items-center gap-3 font-bold uppercase tracking-widest transition-colors"
                            >
                              <UserCheck size={16} /> Aprobar Cuenta
                            </button>
                          )}

                          {status !== 'suspended' && (
                            <button 
                              onClick={() => handleAction(driver.id, 'suspend')}
                              disabled={isPending}
                              className="w-full text-left px-4 py-3 text-xs text-red-500 hover:bg-red-50 flex items-center gap-3 font-bold uppercase tracking-widest transition-colors"
                            >
                              <UserX size={16} /> Suspender Conductor
                            </button>
                          )}
                          
                          <div className="border-t border-gray-100 mt-2 pt-2">
                             <button className="w-full text-left px-4 py-3 text-[10px] text-slate-400 hover:bg-slate-50 flex items-center gap-3 font-black uppercase tracking-[0.2em]">
                              <AlertTriangle size={14} /> Reportar Incidente
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}