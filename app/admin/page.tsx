'use client';

import { useEffect, useState, useRef } from 'react';
import { Users, Car, AlertCircle, Wallet, Radio, Loader2, Phone, Mail, Clock, ArrowUpRight } from 'lucide-react';
import { getDashboardMetrics, getLatestDrivers } from '../../lib/supabase';
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
      .subscribe((status) => {
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
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard General</h1>
          <p className="text-gray-500 mt-1">Resumen en tiempo real de la operación de CarSiGo.</p>
        </div>
        {/* Indicador de conexión Realtime */}
        <div className={`flex items-center gap-2 px-4 py-2 rounded-full border text-[10px] font-black uppercase tracking-widest transition-all ${
          realtimeActivo
            ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
            : 'bg-slate-50 text-slate-400 border-slate-100'
        }`}>
          <Radio size={12} className={realtimeActivo ? 'animate-pulse' : ''} />
          {realtimeActivo ? 'En Vivo' : 'Conectando...'}
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
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500">Pasajeros Registrados</p>
              {isLoading ? (
                <div className="h-8 w-16 bg-gray-200 animate-pulse rounded mt-2"></div>
              ) : (
                <h3 className="text-3xl font-bold text-gray-900 mt-1">{metrics.pasajeros}</h3>
              )}
            </div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <Users size={24} />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-green-600 font-medium">
            <ArrowUpRight size={16} className="mr-1" />
            <span>Tiempo real</span>
          </div>
        </div>

        {/* Conductores */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500">Conductores Activos</p>
              {isLoading ? (
                <div className="h-8 w-16 bg-gray-200 animate-pulse rounded mt-2"></div>
              ) : (
                <h3 className="text-3xl font-bold text-gray-900 mt-1">{metrics.conductores}</h3>
              )}
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <Car size={24} />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-emerald-600 font-medium">
            <ArrowUpRight size={16} className="mr-1" />
            <span>Operando ahora</span>
          </div>
        </div>

        {/* Pendientes */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500">Conductores Pendientes</p>
              {isLoading ? (
                <div className="h-8 w-16 bg-gray-200 animate-pulse rounded mt-2"></div>
              ) : (
                <h3 className="text-3xl font-bold text-gray-900 mt-1">{metrics.pendientes}</h3>
              )}
            </div>
            <div className="p-3 bg-orange-50 text-orange-600 rounded-xl">
              <AlertCircle size={24} />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-orange-600 font-medium">
            <span>Requieren validación manual</span>
          </div>
        </div>

        {/* Billetera (solo superadmin) */}
        {role === 'superadmin' && (
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all opacity-80 animate-in zoom-in duration-300">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-gray-500">Ingresos (Comisión 12%)</p>
                <h3 className="text-3xl font-bold text-gray-900 mt-1">$0</h3>
              </div>
              <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
                <Wallet size={24} />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm text-gray-500 font-bold uppercase tracking-widest text-[10px]">
              <span>Contabilidad Central</span>
            </div>
          </div>
        )}
      </div>

      {/* Tabla de Conductores Recientes */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden min-h-[400px]">
        <div className="p-8 border-b border-gray-50 flex items-center justify-between bg-slate-50/30">
          <div>
            <h3 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-3">
              <Clock className="text-blue-600" size={24} />
              Últimos Conductores Registrados
            </h3>
            <p className="text-xs text-gray-500 font-medium mt-1 uppercase tracking-widest">Actividad del Sistema en Tiempo Real</p>
          </div>
          <div className="px-4 py-1.5 bg-blue-50 text-blue-600 rounded-full text-[11px] font-black uppercase tracking-wider border border-blue-100 shadow-sm">
            5 Recientes
          </div>
        </div>

        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 animate-pulse">
              <Loader2 className="animate-spin text-blue-600" size={40} />
              <p className="text-gray-400 font-bold mt-4 tracking-tighter">Sincronizando con CarSiGo Cloud...</p>
            </div>
          ) : latestDrivers.length === 0 ? (
            <div className="text-center py-24 text-gray-400">
              <Car size={48} className="mx-auto mb-4 opacity-20" />
              <p className="font-bold text-lg">No hay conductores registrados todavía</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Conductor</th>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] hidden md:table-cell">Contacto</th>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Fecha Registro</th>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 font-sans">
                {latestDrivers.map((driver) => (
                  <tr key={driver.id} className="hover:bg-blue-50/20 transition-all group">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center font-black text-lg group-hover:scale-110 transition-transform shadow-sm">
                          {driver.name?.charAt(0) || 'D'}
                        </div>
                        <div>
                          <p className="font-black text-gray-900 tracking-tight text-sm">{driver.name}</p>
                          <p className="text-[11px] text-gray-400 font-medium">ID: {driver.id.substring(0, 8)}...</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6 hidden md:table-cell">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs text-gray-600 font-bold">
                          <Phone size={14} className="text-blue-500" />
                          {driver.phone || 'S/N'}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-gray-400 font-medium">
                          <Mail size={14} className="text-gray-300" />
                          {driver.email}
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <p className="text-sm font-bold text-gray-700">
                        {new Date(driver.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                      <p className="text-[10px] text-gray-400 font-medium tracking-tight">
                        {new Date(driver.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <button className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 hover:border-blue-200 transition-all shadow-sm">
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