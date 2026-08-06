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
      : `¿Confirmas la liquidación estimada?\n\n💰 Estimado (10%): $${monto.toLocaleString('es-CO')}\n👥 Conductores: ${tripStats.conductoresActivos}\n\n⚠️ Aún no hay viajes completados en el sistema.`;

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
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400">
              <Wallet size={20} />
            </div>
            <h1 className="text-3xl font-black text-white tracking-tighter">Panel de Finanzas</h1>
          </div>
          <p className="text-slate-400 font-medium">
            Control contable, comisiones de plataforma y liquidación de conductores.
            {!tripStats.tieneDataReal && (
              <span className="ml-2 text-orange-400 text-[10px] font-black uppercase tracking-widest">
                ⚠ Sin viajes completados aún
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handleDownloadCSV}
            className="flex items-center gap-2 px-5 py-3 bg-white/5 border border-white/10 text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all hover:bg-[#00E5FF]/10 hover:border-[#00E5FF]/30 hover:text-[#00E5FF] focus-visible:ring-2 focus-visible:ring-[#00E5FF]/60"
          >
            <Download size={14} />
            CSV
          </button>
          <button
            onClick={handleDownloadPDF}
            className="flex items-center gap-2 px-5 py-3 bg-white/5 border border-white/10 text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all hover:bg-[#00E5FF]/10 hover:border-[#00E5FF]/30 hover:text-[#00E5FF] focus-visible:ring-2 focus-visible:ring-[#00E5FF]/60"
          >
            <FileText size={14} />
            PDF
          </button>
          <button
            onClick={handleNewSettlement}
            disabled={isPending}
            className="flex items-center gap-2 px-6 py-3 bg-[#00E5FF] hover:bg-[#00D0E8] text-[#131313] rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[#00E5FF]/60"
          >
            {isPending ? <Loader2 size={14} className="animate-spin" /> : <PlusCircle size={14} />}
            Nueva Liquidación
          </button>
        </div>
      </div>

      {/* Métricas Financieras */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#141416] border border-white/5 p-8 rounded-3xl shadow-sm transition-all">
          <div className="flex justify-between items-start mb-6">
            <div className="p-2.5 rounded-xl bg-[#00E5FF]/10 text-[#00E5FF]">
              <TrendingUp size={24} />
            </div>
            {tripStats.tieneDataReal && (
              <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                Dato Real
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 font-black uppercase tracking-widest mb-1">Volumen Total</p>
          <h3 className="text-3xl font-bold text-white tracking-tighter tabular-nums">
            ${tripStats.volumenTotal.toLocaleString('es-CO')}
          </h3>
          <p className="text-[10px] text-slate-500 font-medium mt-4">
            {tripStats.tieneDataReal ? 'Suma real de viajes completados' : 'Aún no hay viajes registrados'}
          </p>
        </div>

        <div className="bg-[#141416] border border-white/5 p-8 rounded-3xl shadow-sm transition-all">
          <div className="flex justify-between items-start mb-6">
            <div className="p-2.5 rounded-xl bg-[#00E5FF]/10 text-[#00E5FF]">
              <PieChart size={24} />
            </div>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border bg-[#00E5FF]/10 text-[#00E5FF] border-[#00E5FF]/20 self-center">10% Plana</span>
          </div>
          <p className="text-xs text-slate-500 font-black uppercase tracking-widest mb-1">Comisión CarSiGo</p>
          <h3 className="text-3xl font-bold text-[#00E5FF] tracking-tighter tabular-nums">
            ${tripStats.comisionCarSiGo.toLocaleString('es-CO')}
          </h3>
          <p className="text-[10px] text-slate-500 font-medium mt-4">
            {tripStats.tieneDataReal ? '10% del volumen real de viajes' : '10% estimado sin datos reales'}
          </p>
        </div>

        <div className="bg-[#141416] border border-white/5 p-8 rounded-3xl shadow-sm transition-all">
          <div className="flex justify-between items-start mb-6">
            <div className="p-2.5 rounded-xl bg-orange-500/10 text-orange-400">
              <Clock size={24} />
            </div>
          </div>
          <p className="text-xs text-slate-500 font-black uppercase tracking-widest mb-1">Pendiente de Liquidar</p>
          <h3 className="text-3xl font-bold text-white tracking-tighter tabular-nums">
            ${saldoPendiente.toLocaleString('es-CO')}
          </h3>
          <p className="text-[10px] text-slate-500 font-medium mt-4">
            {tripStats.conductoresActivos} conductor{tripStats.conductoresActivos !== 1 ? 'es' : ''} activo{tripStats.conductoresActivos !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-[#141416] border border-white/5 p-6 rounded-3xl shadow-sm">
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Buscar por Referencia</label>
            <input
              type="text"
              value={busquedaRef}
              onChange={e => setBusquedaRef(e.target.value)}
              placeholder="Ej: LIQ-20250323-1234"
              className="w-full px-4 py-3 bg-[#0f0f11] border border-white/10 rounded-xl font-medium text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-[#00E5FF]/40 focus:border-[#00E5FF]/40 transition-all"
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Desde</label>
            <input
              type="date"
              value={fechaDesde}
              onChange={e => setFechaDesde(e.target.value)}
              className="px-4 py-3 bg-[#0f0f11] border border-white/10 rounded-xl font-medium text-sm text-white outline-none focus:ring-2 focus:ring-[#00E5FF]/40 focus:border-[#00E5FF]/40 transition-all"
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Hasta</label>
            <input
              type="date"
              value={fechaHasta}
              onChange={e => setFechaHasta(e.target.value)}
              className="px-4 py-3 bg-[#0f0f11] border border-white/10 rounded-xl font-medium text-sm text-white outline-none focus:ring-2 focus:ring-[#00E5FF]/40 focus:border-[#00E5FF]/40 transition-all"
            />
          </div>
          {(busquedaRef || fechaDesde || fechaHasta) && (
            <button
              onClick={() => { setBusquedaRef(''); setFechaDesde(''); setFechaHasta(''); }}
              className="px-5 py-3 text-slate-400 hover:text-[#00E5FF] text-[10px] font-black uppercase tracking-widest border border-white/10 rounded-xl bg-white/5 hover:bg-[#00E5FF]/10 hover:border-[#00E5FF]/30 transition-all focus-visible:ring-2 focus-visible:ring-[#00E5FF]/60"
            >
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-[#141416] border border-white/5 rounded-3xl shadow-sm overflow-hidden">
        <div className="p-6 md:p-8 border-b border-white/5 flex items-center justify-between bg-white/2">
          <div>
            <h3 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
              <FileText className="text-[#00E5FF]" size={20} />
              Historial de Liquidaciones
            </h3>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-widest mt-1">Registros del sistema</p>
          </div>
        </div>

        {isLoading ? (
          <div className="p-20 flex justify-center">
            <Loader2 className="animate-spin text-[#00E5FF]" size={40} />
          </div>
        ) : filteredSettlements.length === 0 ? (
          <div className="p-20 text-center">
            <div className="w-20 h-20 bg-white/10 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <Clock className="text-slate-500 opacity-20" size={32} />
            </div>
            <h4 className="text-lg font-black text-slate-400 uppercase tracking-tighter">
              Sin movimientos
            </h4>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-sans text-sm">
              <thead className="bg-white/2">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Referencia</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Comisión</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredSettlements.map((s) => (
                  <tr key={s.id} className="hover:bg-[#00E5FF]/5 transition-all">
                    <td className="px-6 py-4 font-bold text-slate-200 font-mono">{s.reference}</td>
                    <td className="px-6 py-4 font-black text-emerald-400">${s.total_amount?.toLocaleString('es-CO')}</td>
                    <td className="px-6 py-4 font-medium text-slate-400">
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