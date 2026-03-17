'use client';

import { useState } from 'react';

export default function Finanzas() {
  // Datos de ejemplo para visualizar el diseño (Luego vendrán de Supabase)
  const transacciones = [
    { id: 1, conductor: 'Miguel Repartidor', tipo: 'Comisión Viaje', monto: -2500, fecha: 'Hoy, 2:30 PM' },
    { id: 2, conductor: 'Carlos MotoTaxi', tipo: 'Recarga Billetera', monto: 20000, fecha: 'Hoy, 11:15 AM' },
    { id: 3, conductor: 'Miguel Repartidor', tipo: 'Comisión Viaje', monto: -1800, fecha: 'Ayer' },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Control Financiero</h1>
          <p className="text-gray-500">Monitoreo de ingresos, recargas y comisiones de CarSiGo.</p>
        </div>
        <button className="bg-green-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-green-700 transition-shadow shadow-lg shadow-green-100 flex items-center gap-2">
          <span>📥</span> Descargar Reporte (Excel)
        </button>
      </div>

      {/* Resumen de Cuentas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl">
          <p className="text-slate-400 text-sm font-medium">Billetera Total Conductores</p>
          <p className="text-3xl font-bold mt-2">$450.000</p>
          <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
            <span className="text-green-400">↑ 12%</span> respecto al mes pasado
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <p className="text-gray-500 text-sm font-medium">Comisiones Generadas (Hoy)</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">$34.500</p>
          <p className="text-xs text-blue-600 font-bold mt-2 italic">15% por servicio</p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <p className="text-gray-500 text-sm font-medium">Retiros Pendientes</p>
          <p className="text-3xl font-bold text-red-500 mt-2">$0</p>
          <p className="text-xs text-gray-400 mt-2 italic">No hay solicitudes de pago</p>
        </div>
      </div>

      {/* Historial de Movimientos */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h3 className="font-bold text-gray-800">Movimientos Recientes</h3>
          <select className="text-sm border-none bg-gray-50 rounded-lg px-3 py-1 outline-none font-medium text-gray-600">
            <option>Todo el tiempo</option>
            <option>Esta semana</option>
            <option>Hoy</option>
          </select>
        </div>
        <table className="w-full text-left">
          <thead className="bg-gray-50 text-xs uppercase font-bold text-gray-400">
            <tr>
              <th className="p-4">Concepto</th>
              <th className="p-4">Conductor</th>
              <th className="p-4">Fecha</th>
              <th className="p-4 text-right">Monto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {transacciones.map((t) => (
              <tr key={t.id} className="hover:bg-gray-50 transition-colors text-sm">
                <td className="p-4 font-medium text-gray-700">{t.tipo}</td>
                <td className="p-4 text-gray-600">{t.conductor}</td>
                <td className="p-4 text-gray-400">{t.fecha}</td>
                <td className={`p-4 text-right font-bold ${t.monto < 0 ? 'text-red-500' : 'text-green-600'}`}>
                  {t.monto < 0 ? `- $${Math.abs(t.monto)}` : `+ $${t.monto}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}