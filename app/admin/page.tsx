'use client';

import { useEffect, useState, useRef } from 'react';
import { Users, Car, AlertCircle, Wallet, Radio, Loader2, Phone, Mail, Clock, ArrowUpRight } from 'lucide-react';
import { getDashboardMetrics, getLatestDrivers } from './actions';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export default function DashboardPage() {
  const supabase = createClient();
  const { role, isLoading: authLoading } = useAuth();

  const [metrics, setMetrics] = useState({ pasajeros: 0, conductores: 0, pendientes: 0 });
  const [latestDrivers, setLatestDrivers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [realtimeActivo, setRealtimeActivo] = useState(false);
  const [ultimaActualizacion, setUltimaActualizacion] = useState<Date | null>(null);
  const channelRef = useRef<any>(null);

  const cargarDatos = async () => {
    try {
      const [datosReales, conductores] = await Promise.all([
        getDashboardMetrics(),
        getLatestDrivers(5)
      ]);
      if (datosReales) setMetrics(datosReales);
      if (conductores) setLatestDrivers(conductores);
    } catch (error) {
      console.error('Error cargando el Dashboard:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();

    const canal = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
        setUltimaActualizacion(new Date());
        cargarDatos();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_profiles' }, () => {
        setUltimaActualizacion(new Date());
        cargarDatos();
      })
      .subscribe((status: string) => {
        setRealtimeActivo(status === 'SUBSCRIBED');
      });

    channelRef.current = canal;
    return () => { 
      if (channelRef.current) supabase.removeChannel(channelRef.current); 
    };
  }, []);

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">

      {/* Encabezado con indicador Realtime */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Dashboard General</h1>
          <p className="text-slate-400 mt-1">Resumen en tiempo real de la operación de CarSiGo.</p>
        </div>
        {/* Indicador de conexión Realtime */}
        <div className={`flex items-center gap-2 px-4 py-2 rounded-full border text-[10px] font-black uppercase tracking-widest transition-all ${
          realtimeActivo
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            : 'bg-white/5 text-slate-400 border-white/10'
        }`}>
          <Radio size={12} className={realtimeActivo ? 'animate-pulse' : ''} />
          {realtimeActivo ? 'En Vivo' : 'Conectando…'}
          {ultimaActualizacion && (
            <span className="text-[9px] opacity-60 font-medium normal-case">
              · actualizado {ultimaActualizacion.toLocaleTimeString('es-CO', { timeStyle: 'short' })}
            </span>
          )}
        </div>
      </div>

      {/* Tarjetas de Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

        {/* Pasajeros */}
        <div className="bg-[#141416] p-6 rounded-2xl border border-white/5 shadow-sm hover:border-[#00E5FF]/25 hover:shadow-[0_0_24px_rgba(0,229,255,0.06)] transition-all group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-400">Pasajeros Registrados</p>
              {isLoading ? (
                <div className="h-8 w-16 bg-white/10 animate-pulse rounded mt-2"></div>
              ) : (
                <h3 className="text-3xl font-bold text-white mt-1 tabular-nums">{metrics.pasajeros}</h3>
              )}
            </div>
            <div className="p-3 bg-[#00E5FF]/10 text-[#00E5FF] rounded-xl group-hover:scale-105 transition-transform">
              <Users size={24} />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-emerald-400 font-medium">
            <ArrowUpRight size={16} className="mr-1" />
            <span>Tiempo real</span>
          </div>
        </div>

        {/* Conductores */}
        <div className="bg-[#141416] p-6 rounded-2xl border border-white/5 shadow-sm hover:border-emerald-500/25 hover:shadow-[0_0_24px_rgba(34,197,94,0.06)] transition-all group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-400">Conductores Activos</p>
              {isLoading ? (
                <div className="h-8 w-16 bg-white/10 animate-pulse rounded mt-2"></div>
              ) : (
                <h3 className="text-3xl font-bold text-white mt-1 tabular-nums">{metrics.conductores}</h3>
              )}
            </div>
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl group-hover:scale-105 transition-transform">
              <Car size={24} />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-emerald-400 font-medium">
            <ArrowUpRight size={16} className="mr-1" />
            <span>Operando ahora</span>
          </div>
        </div>

        {/* Pendientes */}
        <div className="bg-[#141416] p-6 rounded-2xl border border-white/5 shadow-sm hover:border-orange-500/25 hover:shadow-[0_0_24px_rgba(249,115,22,0.06)] transition-all group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-400">Conductores Pendientes</p>
              {isLoading ? (
                <div className="h-8 w-16 bg-white/10 animate-pulse rounded mt-2"></div>
              ) : (
                <h3 className="text-3xl font-bold text-white mt-1 tabular-nums">{metrics.pendientes}</h3>
              )}
            </div>
            <div className="p-3 bg-orange-500/10 text-orange-400 rounded-xl group-hover:scale-105 transition-transform">
              <AlertCircle size={24} />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-orange-400 font-medium">
            <span>Requieren validación manual</span>
          </div>
        </div>

        {/* Billetera (solo superadmin) */}
        {role === 'superadmin' && (
          <div className="bg-[#141416] p-6 rounded-2xl border border-white/5 shadow-sm hover:border-purple-500/25 hover:shadow-[0_0_24px_rgba(168,85,247,0.06)] transition-all opacity-90 animate-in zoom-in duration-300 group">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-slate-400">Ingresos (Comisión 10%)</p>
                <h3 className="text-3xl font-bold text-white mt-1 tabular-nums">$0</h3>
              </div>
              <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl group-hover:scale-105 transition-transform">
                <Wallet size={24} />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm text-slate-500 font-bold uppercase tracking-widest text-[10px]">
              <span>Contabilidad Central</span>
            </div>
          </div>
        )}
      </div>

      {/* Tabla de Conductores Recientes */}
      <div className="bg-[#141416] rounded-3xl border border-white/5 shadow-sm overflow-hidden min-h-[400px]">
        <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/2 flex-wrap gap-4">
          <div>
            <h3 className="text-xl font-black text-white tracking-tight flex items-center gap-3">
              <Clock className="text-[#00E5FF]" size={24} />
              Últimos Conductores Registrados
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-1 uppercase tracking-widest">Actividad del Sistema en Tiempo Real</p>
          </div>
          <div className="px-4 py-1.5 bg-[#00E5FF]/10 text-[#00E5FF] rounded-full text-[11px] font-black uppercase tracking-wider border border-[#00E5FF]/20 shadow-sm">
            5 Recientes
          </div>
        </div>

        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 animate-pulse">
              <Loader2 className="animate-spin text-[#00E5FF]" size={40} />
              <p className="text-slate-400 font-bold mt-4 tracking-tight">Sincronizando con CarSiGo Cloud…</p>
            </div>
          ) : latestDrivers.length === 0 ? (
            <div className="text-center py-24 text-slate-500">
              <Car size={48} className="mx-auto mb-4 opacity-20" />
              <p className="font-bold text-lg">No hay conductores registrados todavía</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/2">
                  <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Conductor</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] hidden md:table-cell">Contacto</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Fecha Registro</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-sans">
                {latestDrivers.map((driver) => (
                  <tr key={driver.id} className="hover:bg-[#00E5FF]/5 transition-all group">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-[#00E5FF]/10 text-[#00E5FF] flex items-center justify-center font-black text-lg group-hover:scale-110 transition-transform shadow-sm">
                          {driver.name?.charAt(0) || 'D'}
                        </div>
                        <div>
                          <p className="font-black text-white tracking-tight text-sm">{driver.name}</p>
                          <p className="text-[11px] text-slate-500 font-medium">ID: {driver.id.substring(0, 8)}…</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6 hidden md:table-cell">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs text-slate-300 font-bold">
                          <Phone size={14} className="text-[#00E5FF]" />
                          {driver.phone || 'S/N'}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium">
                          <Mail size={14} className="text-slate-600" />
                          {driver.email}
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <p className="text-sm font-bold text-slate-200">
                        {new Date(driver.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                      <p className="text-[10px] text-slate-500 font-medium tracking-tight">
                        {new Date(driver.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <button className="px-4 py-2 bg-white/5 border border-white/10 text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#00E5FF]/10 hover:border-[#00E5FF]/30 hover:text-[#00E5FF] transition-all shadow-sm focus-visible:ring-2 focus-visible:ring-[#00E5FF]/60">
                        Ver Perfil
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}