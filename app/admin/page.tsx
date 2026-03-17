'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export default function DashboardGeneral() {
  const [stats, setStats] = useState({
    totalDrivers: 0,
    pendingDrivers: 0,
    activeTrips: 0,
    totalEarnings: 0
  });

  useEffect(() => {
    getDashboardStats();
  }, []);

  async function getDashboardStats() {
    // Aquí conectaremos con tus tablas reales. Por ahora traemos conteos básicos:
    const { count: driversCount } = await supabase.from('driver_profiles').select('*', { count: 'exact', head: true });
    const { count: pendingCount } = await supabase.from('driver_profiles').select('*', { count: 'exact', head: true }).eq('status', 'pending');
    
    setStats({
      totalDrivers: driversCount || 0,
      pendingDrivers: pendingCount || 0,
      activeTrips: 0, // Esto vendrá de la tabla de viajes
      totalEarnings: 0 // Esto vendrá de la tabla de finanzas
    });
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Resumen General</h1>
        <p className="text-gray-500">Estado actual de la operación de CarSiGo.</p>
      </div>

      {/* Tarjetas de Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Conductores Totales" value={stats.totalDrivers} icon="👥" color="blue" />
        <StatCard title="Por Aprobar" value={stats.pendingDrivers} icon="⏳" color="yellow" subtitle="Requieren atención" />
        <StatCard title="Viajes en curso" value={stats.activeTrips} icon="🚗" color="green" />
        <StatCard title="Recaudado Hoy" value={`$${stats.totalEarnings}`} icon="💰" color="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Sección de Conductores Pendientes Rápida */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-gray-800 text-lg">Alertas de Registro</h3>
            <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-1 rounded">Prioridad</span>
          </div>
          <div className="space-y-4">
            {stats.pendingDrivers > 0 ? (
              <p className="text-gray-600">Tienes <span className="font-bold text-blue-600">{stats.pendingDrivers}</span> conductores esperando aprobación de documentos.</p>
            ) : (
              <p className="text-gray-400 italic">No hay registros pendientes por ahora.</p>
            )}
            <button className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors">
              Ver todos los pendientes
            </button>
          </div>
        </div>

        {/* Estado del Sistema */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <h3 className="font-bold text-gray-800 text-lg mb-6">Estado del Servicio</h3>
          <div className="flex items-center gap-4 p-4 bg-green-50 rounded-xl border border-green-100">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <div>
              <p className="text-green-800 font-bold text-sm">Servidores Operativos</p>
              <p className="text-green-600 text-xs">Conexión con Supabase establecida</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color, subtitle }: any) {
  const colors: any = {
    blue: "border-l-blue-500",
    yellow: "border-l-yellow-500",
    green: "border-l-green-500",
    purple: "border-l-purple-500"
  };

  return (
    <div className={`bg-white p-6 rounded-2xl shadow-sm border border-gray-200 border-l-4 ${colors[color]}`}>
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-3xl font-extrabold text-gray-900 mt-2">{value}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
        </div>
        <span className="text-2xl opacity-80">{icon}</span>
      </div>
    </div>
  );
}