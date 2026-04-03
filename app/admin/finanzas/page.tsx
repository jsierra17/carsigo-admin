'use client';

import { useState, useEffect, useTransition } from 'react';
import { Wallet, TrendingUp, PieChart, Clock, FileText, Download, PlusCircle, Loader2 } from 'lucide-react';
import { getSettlements, performSettlement, getTripStats } from './actions';
import { generateSettlementPDF } from '@/lib/pdfGenerator';
import { useToast } from '@/contexts/ToastContext';

// ─── TIPOS ───────────────────────────────────────────────────────────────────

type TripStats = {
  conductoresActivos: number;
  volumenTotal: number;
  comisionCarSiGo: number;
  tieneDataReal: boolean;
};

// ─── PÁGINA PRINCIPAL ────────────────────────────────────────────────────────

export default function FinanzasPage() {
  const toast = useToast();
  const [tripStats, setTripStats] = useState<TripStats>({
    conductoresActivos: 0,
    volumenTotal: 0,
    comisionCarSiGo: 0,
    tieneDataReal: false,
  });
  const [settlements, setSettlements] = useState<any[]>([]);
  const [filteredSettlements, setFilteredSettlements] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // ─── FILTROS ───────────────────────────────────────────────────────────────
  const [busquedaRef, setBusquedaRef] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    const [stats, history] = await Promise.all([
      getTripStats(),
      getSettlements()
    ]);
    if (stats) setTripStats(stats);
    if (history) {
      setSettlements(history);
      setFilteredSettlements(history);
    }
    setIsLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  // ─── EFECTO FILTROS ────────────────────────────────────────────────────────
  useEffect(() => {
    let resultado = [...settlements];

    if (busquedaRef) {
      resultado = resultado.filter(s =>
        s.reference?.toLowerCase().includes(busquedaRef.toLowerCase())
      );
    }
    if (fechaDesde) {
      resultado = resultado.filter(s =>
        new Date(s.created_at) >= new Date(fechaDesde)
      );
    }
    if (fechaHasta) {
      resultado = resultado.filter(s =>
        new Date(s.created_at) <= new Date(fechaHasta + 'T23:59:59')
      );
    }

    setFilteredSettlements(resultado);
  }, [busquedaRef, fechaDesde, fechaHasta, settlements]);

  // ─── DESCARGA CSV ──────────────────────────────────────────────────────────
  const handleDownloadCSV = () => {
    if (settlements.length === 0) {
      toast.warning('No hay movimientos registrados para descargar.');
      return;
    }
    const csvContent = 'data:text/csv;charset=utf-8,'
      + 'Referencia,Monto Comisión,Volumen Base,Conductores,Fecha,Estado\n'
      + settlements.map(s =>
        `${s.reference},${s.total_amount},${s.volume_base || 'N/A'},${s.drivers_involved},${new Date(s.created_at).toLocaleString('es-CO')},${s.status}`
      ).join('\n');

    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `reporte_liquidaciones_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Reporte CSV descargado correctamente.');
  };

  // ─── DESCARGA PDF ──────────────────────────────────────────────────────────
  const handleDownloadPDF = () => {
    if (settlements.length === 0) {
      toast.warning('No hay movimientos registrados para generar el PDF.');
      return;
    }
    try {
      generateSettlementPDF(settlements);
      toast.success('Reporte PDF descargado correctamente.');
    } catch (e) {
      toast.error('Error al generar el PDF. Por favor intenta de nuevo.');
    }
  };

  // ─── NUEVA LIQUIDACIÓN ─────────────────────────────────────────────────────
  const handleNewSettlement = () => {
    if (tripStats.conductoresActivos === 0 && tripStats.volumenTotal === 0) {
      toast.warning('No hay datos suficientes para procesar una liquidación.');
      return;
    }

    const monto = tripStats.comisionCarSiGo;
    const confirmMsg = tripStats.tieneDataReal
      ? `¿Confirmas la liquidación?\n\n💰 Comisión real: $${monto.toLocaleString('es-CO')}\n👥 Conductores activos: ${tripStats.conductoresActivos}`
      : `¿Confirmas la liquidación estimada?\n\n💰 Estimado (12%): $${monto.toLocaleString('es-CO')}\n👥 Conductores: ${tripStats.conductoresActivos}\n\n⚠️ Aún no hay viajes completados en el sistema.`;

    if (!confirm(confirmMsg)) return;

    startTransition(async () => {
      const result = await performSettlement({
        amount: monto,
        driverCount: tripStats.conductoresActivos,
        volumenBase: tripStats.volumenTotal,
      });

      if (result.success) {
        toast.success(`¡Liquidación ${result.referencia} procesada correctamente!`);
        loadData();
      } else {
        toast.error('Error: ' + result.error);
      }
    });
  };

  const ultimaLiquidacion = settlements[0]?.created_at
    ? new Date(settlements[0].created_at)
    : null;
  const saldoPendiente = !ultimaLiquidacion ||
    (new Date().getTime() - ultimaLiquidacion.getTime() > 1000 * 60 * 60 * 24)
    ? tripStats.comisionCarSiGo
    : 0;

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">

      {/* Encabezado Finanzas */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg border border-purple-100 shadow-sm">
              <Wallet size={20} />
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter">Panel de Finanzas</h1>
          </div>
          <p className="text-slate-500 font-medium">
            Control contable, comisiones de plataforma y liquidación de conductores.
            {!tripStats.tieneDataReal && (
              <span className="ml-2 text-amber-500 text-[10px] font-black uppercase tracking-widest">
                ⚠ Sin viajes completados aún
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handleDownloadCSV}
            className="flex items-center gap-2 px-5 py-3 bg-white hover:bg-slate-50 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border border-gray-200 shadow-sm"
          >
            <Download size={14} />
            CSV
          </button>
          <button
            onClick={handleDownloadPDF}
            className="flex items-center gap-2 px-5 py-3 bg-white hover:bg-slate-50 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border border-gray-200 shadow-sm"
          >
            <FileText size={14} />
            PDF
          </button>
          <button
            onClick={handleNewSettlement}
            disabled={isPending}
            className="flex items-center gap-2 px-6 py-3 bg-[#00E5FF] hover:bg-[#00D0E8] text-[#131313] rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md active:scale-95 disabled:opacity-50"
          >
            {isPending ? <Loader2 size={14} className="animate-spin" /> : <PlusCircle size={14} />}
            Nueva Liquidación
          </button>
        </div>
      </div>

      {/* Métricas Financieras */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-gray-100 p-8 rounded-[2.5rem] shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-6">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100">
              <TrendingUp size={24} />
            </div>
            {tripStats.tieneDataReal && (
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-black rounded uppercase tracking-tighter">
                Dato Real
              </span>
            )}
          </div>
          <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-1">Volumen Total</p>
          <h3 className="text-4xl font-black text-slate-900 tracking-tighter">
            ${tripStats.volumenTotal.toLocaleString('es-CO')}
          </h3>
          <p className="text-[10px] text-slate-400 font-medium mt-4">
            {tripStats.tieneDataReal ? 'Suma real de viajes completados' : 'Aún no hay viajes registrados'}
          </p>
        </div>

        <div className="bg-white border border-blue-100 p-8 rounded-[2.5rem] shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-6">
            <div className="p-3 bg-[#00E5FF]/10 text-[#00606b] rounded-2xl border border-[#00E5FF]/20">
              <PieChart size={24} />
            </div>
            <span className="px-2 py-0.5 bg-[#00E5FF] text-[#131313] text-[9px] font-black rounded uppercase tracking-tighter self-center">12% Plana</span>
          </div>
          <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-1">Comisión CarSiGo</p>
          <h3 className="text-4xl font-black text-[#00606b] tracking-tighter">
            ${tripStats.comisionCarSiGo.toLocaleString('es-CO')}
          </h3>
          <p className="text-[10px] text-slate-400 font-medium mt-4">
            {tripStats.tieneDataReal ? '12% del volumen real de viajes' : '12% estimado sin datos reales'}
          </p>
        </div>

        <div className="bg-white border border-gray-100 p-8 rounded-[2.5rem] shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-6">
            <div className="p-3 bg-orange-50 text-orange-600 rounded-2xl border border-orange-100">
              <Clock size={24} />
            </div>
          </div>
          <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-1">Pendiente de Liquidar</p>
          <h3 className="text-4xl font-black text-slate-900 tracking-tighter">
            ${saldoPendiente.toLocaleString('es-CO')}
          </h3>
          <p className="text-[10px] text-slate-400 font-medium mt-4">
            {tripStats.conductoresActivos} conductor{tripStats.conductoresActivos !== 1 ? 'es' : ''} activo{tripStats.conductoresActivos !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white border border-gray-100 p-6 rounded-[2rem] shadow-sm">
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Buscar por Referencia</label>
            <input
              type="text"
              value={busquedaRef}
              onChange={e => setBusquedaRef(e.target.value)}
              placeholder="Ej: LIQ-20250323-1234"
              className="w-full px-4 py-3 bg-slate-50/50 border border-gray-100 rounded-xl font-medium text-sm text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-300 transition-all"
            />
          </div>
          <div>
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Desde</label>
            <input
              type="date"
              value={fechaDesde}
              onChange={e => setFechaDesde(e.target.value)}
              className="px-4 py-3 bg-slate-50/50 border border-gray-100 rounded-xl font-medium text-sm text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-300 transition-all"
            />
          </div>
          <div>
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Hasta</label>
            <input
              type="date"
              value={fechaHasta}
              onChange={e => setFechaHasta(e.target.value)}
              className="px-4 py-3 bg-slate-50/50 border border-gray-100 rounded-xl font-medium text-sm text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-300 transition-all"
            />
          </div>
          {(busquedaRef || fechaDesde || fechaHasta) && (
            <button
              onClick={() => { setBusquedaRef(''); setFechaDesde(''); setFechaHasta(''); }}
              className="px-5 py-3 text-slate-500 hover:text-slate-800 text-[10px] font-black uppercase tracking-widest border border-gray-200 rounded-xl hover:bg-slate-50 transition-all"
            >
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white border border-gray-100 rounded-[2.5rem] shadow-sm overflow-hidden">
        <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-slate-50/30">
          <div>
            <h3 className="text-xl font-black text-slate-900 tracking-tighter flex items-center gap-2">
              <FileText className="text-[#00606b]" size={20} />
              Historial de Liquidaciones
            </h3>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Registros del sistema</p>
          </div>
        </div>

        {isLoading ? (
          <div className="p-20 flex justify-center">
            <Loader2 className="animate-spin text-blue-500" size={40} />
          </div>
        ) : filteredSettlements.length === 0 ? (
          <div className="p-20 text-center">
            <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <Clock className="text-slate-200" size={32} />
            </div>
            <h4 className="text-lg font-black text-slate-400 uppercase tracking-tighter">
              Sin movimientos
            </h4>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-sans text-sm">
              <thead className="bg-gray-50/50">
                <tr>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Referencia</th>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Comisión</th>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredSettlements.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-8 py-6 font-bold text-slate-700 font-mono">{s.reference}</td>
                    <td className="px-8 py-6 font-black text-emerald-600">${s.total_amount?.toLocaleString('es-CO')}</td>
                    <td className="px-8 py-6 font-medium text-slate-500">
                      {new Date(s.created_at).toLocaleString('es-CO')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}