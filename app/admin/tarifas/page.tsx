'use client'

import { useState, useEffect } from 'react'
import { Tag, Clock, Plus, Pencil, Trash2, Loader2, Car, Bike, Sun, Moon, Calendar, ArrowUp } from 'lucide-react'
import { getRateCards, createRateCard, updateRateCard, deleteRateCard } from './actions'
import { getRateSchedules, createRateSchedule, updateRateSchedule, deleteRateSchedule } from './schedules-actions'
import { useToast } from '@/contexts/ToastContext'

type RateCard = {
  id: string; name: string; vehicle_type: string; base_fee: number
  price_per_km: number; price_per_minute: number; minimum_fare: number
  free_waiting_minutes: number; waiting_price_per_minute: number
  commission_percent: number; included_km: number; extra_km_percent: number
  is_active: boolean; created_at: string
}

type RateSchedule = {
  id: string; name: string; vehicle_type: string; day_type: string
  shift_label: string; shift_start: string; shift_end: string
  base_fee: number; hourly_increase_percent: number
  is_active: boolean; created_at: string
}

const dayTypeLabels: Record<string, string> = {
  weekday: 'Lun-Vie', weekend: 'Sáb-Dom', special: 'Festivo',
}
const shiftLabels: Record<string, { label: string; icon: any }> = {
  morning: { label: 'Mañana (04:30-16:29)', icon: Sun },
  evening: { label: 'Tarde/Noche (16:30-04:29)', icon: Moon },
}
const vehicleIcons: Record<string, any> = { car: Car, moto: Bike }

const defaultCardForm = {
  name: '', vehicle_type: 'moto' as string, base_fee: 3500,
  price_per_km: 0, price_per_minute: 0, minimum_fare: 5000,
  free_waiting_minutes: 5, waiting_price_per_minute: 200,
  commission_percent: 10, included_km: 2, extra_km_percent: 50,
}

const defaultScheduleForm = {
  name: '', vehicle_type: 'moto' as string, day_type: 'weekday' as string,
  shift_label: 'morning' as string, shift_start: '04:30', shift_end: '16:29',
  base_fee: 3500, hourly_increase_percent: 3,
}

export default function TarifasPage() {
  const toast = useToast()
  const [cards, setCards] = useState<RateCard[]>([])
  const [schedules, setSchedules] = useState<RateSchedule[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCardForm, setShowCardForm] = useState(false)
  const [showScheduleForm, setShowScheduleForm] = useState(false)
  const [editingCardId, setEditingCardId] = useState<string | null>(null)
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null)
  const [cardForm, setCardForm] = useState(defaultCardForm)
  const [scheduleForm, setScheduleForm] = useState(defaultScheduleForm)
  const [isSaving, setIsSaving] = useState(false)

  const load = () => {
    Promise.all([getRateCards(), getRateSchedules()]).then(([c, s]) => {
      setCards(c); setSchedules(s); setIsLoading(false)
    })
  }

  useEffect(() => { load() }, [])

  const handleSaveCard = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSaving(true)
    const payload = { ...cardForm }
    if (editingCardId) {
      const res = await updateRateCard(editingCardId, payload)
      if (res.success) toast.success('Tarifa actualizada')
      else toast.error(res.error || 'Error')
    } else {
      const res = await createRateCard(payload)
      if (res.success) toast.success('Tarifa creada')
      else toast.error(res.error || 'Error')
    }
    setIsSaving(false); setShowCardForm(false); setEditingCardId(null)
    setCardForm(defaultCardForm); load()
  }

  const handleEditCard = (rc: RateCard) => {
    setCardForm({
      name: rc.name, vehicle_type: rc.vehicle_type, base_fee: rc.base_fee,
      price_per_km: rc.price_per_km, price_per_minute: rc.price_per_minute,
      minimum_fare: rc.minimum_fare, free_waiting_minutes: rc.free_waiting_minutes,
      waiting_price_per_minute: rc.waiting_price_per_minute,
      commission_percent: rc.commission_percent,
      included_km: rc.included_km || 2, extra_km_percent: rc.extra_km_percent || 50,
    })
    setEditingCardId(rc.id); setShowCardForm(true)
  }

  const handleDeleteCard = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar tarifa "${name}"?`)) return
    const res = await deleteRateCard(id)
    if (res.success) { toast.success('Tarifa eliminada'); load() }
    else toast.error(res.error || 'Error')
  }

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSaving(true)
    const payload = { ...scheduleForm }
    if (editingScheduleId) {
      const res = await updateRateSchedule(editingScheduleId, payload)
      if (res.success) toast.success('Horario actualizado')
      else toast.error(res.error || 'Error')
    } else {
      const res = await createRateSchedule(payload)
      if (res.success) toast.success('Horario creado')
      else toast.error(res.error || 'Error')
    }
    setIsSaving(false); setShowScheduleForm(false); setEditingScheduleId(null)
    setScheduleForm(defaultScheduleForm); load()
  }

  const handleEditSchedule = (s: RateSchedule) => {
    setScheduleForm({
      name: s.name, vehicle_type: s.vehicle_type, day_type: s.day_type,
      shift_label: s.shift_label, shift_start: s.shift_start.slice(0, 5),
      shift_end: s.shift_end.slice(0, 5), base_fee: s.base_fee,
      hourly_increase_percent: s.hourly_increase_percent,
    })
    setEditingScheduleId(s.id); setShowScheduleForm(true)
  }

  const handleDeleteSchedule = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar horario "${name}"?`)) return
    const res = await deleteRateSchedule(id)
    if (res.success) { toast.success('Horario eliminado'); load() }
    else toast.error(res.error || 'Error')
  }

  const groupSchedules = (vehicleType: string) =>
    schedules.filter(s => s.vehicle_type === vehicleType && s.is_active)

  if (isLoading) return (
    <div className="max-w-7xl mx-auto p-20 flex justify-center">
      <Loader2 className="animate-spin text-blue-500" size={40} />
    </div>
  )

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20 font-sans">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg border border-blue-100 shadow-sm">
            <Tag size={20} />
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter">Tarifas</h1>
        </div>
        <p className="text-slate-500 font-medium">Configuración del modelo de tarifa progresiva por hora.</p>
      </div>

      {/* Rate Cards Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Moto Card */}
        <div className="bg-white border border-gray-100 rounded-[2.5rem] shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-slate-50/30">
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Bike size={18} className="text-[#00606b]" /> Moto
            </h3>
          </div>
          {renderVehicleConfig('moto')}
          {renderScheduleTable('moto')}
        </div>
        {/* Carro Card */}
        <div className="bg-white border border-gray-100 rounded-[2.5rem] shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-slate-50/30">
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Car size={18} className="text-[#00606b]" /> Carro <span className="text-[10px] font-bold text-amber-500 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-100">+60%</span>
            </h3>
          </div>
          {renderVehicleConfig('car')}
          {renderScheduleTable('car')}
        </div>
      </div>

      {/* Schedule Form Modal */}
      {showScheduleForm && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-gray-100 p-8 rounded-[2.5rem] shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-black text-slate-900 tracking-tight mb-6">
              {editingScheduleId ? 'Editar Horario' : 'Nuevo Horario'}
            </h3>
            <form onSubmit={handleSaveSchedule} className="space-y-5">
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Nombre</label>
                <input type="text" required value={scheduleForm.name}
                  onChange={e => setScheduleForm({ ...scheduleForm, name: e.target.value })}
                  placeholder="Ej: Lun-Vie Mañana Moto" className="w-full px-4 py-3 bg-slate-50 border border-gray-100 rounded-xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Vehículo</label>
                  <select value={scheduleForm.vehicle_type} onChange={e => setScheduleForm({ ...scheduleForm, vehicle_type: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-gray-100 rounded-xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10">
                    <option value="moto">Moto</option>
                    <option value="car">Carro</option>
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Tipo de Día</label>
                  <select value={scheduleForm.day_type} onChange={e => setScheduleForm({ ...scheduleForm, day_type: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-gray-100 rounded-xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10">
                    <option value="weekday">Lun-Vie</option>
                    <option value="weekend">Sáb-Dom</option>
                    <option value="special">Festivo</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Turno</label>
                  <select value={scheduleForm.shift_label} onChange={e => {
                    const isMorning = e.target.value === 'morning'
                    setScheduleForm({
                      ...scheduleForm,
                      shift_label: e.target.value,
                      shift_start: isMorning ? '04:30' : '16:30',
                      shift_end: isMorning ? '16:29' : '04:29',
                    })
                  }}
                    className="w-full px-4 py-3 bg-slate-50 border border-gray-100 rounded-xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10">
                    <option value="morning">Mañana</option>
                    <option value="evening">Tarde/Noche</option>
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Base ($)</label>
                  <input type="number" required min={0} value={scheduleForm.base_fee}
                    onChange={e => setScheduleForm({ ...scheduleForm, base_fee: Number(e.target.value) })}
                    className="w-full px-4 py-3 bg-slate-50 border border-gray-100 rounded-xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Inicio</label>
                  <input type="time" required value={scheduleForm.shift_start}
                    onChange={e => setScheduleForm({ ...scheduleForm, shift_start: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-gray-100 rounded-xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10" />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Fin</label>
                  <input type="time" required value={scheduleForm.shift_end}
                    onChange={e => setScheduleForm({ ...scheduleForm, shift_end: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-gray-100 rounded-xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10" />
                </div>
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">% Aumento por Hora (compuesto)</label>
                <div className="relative">
                  <input type="number" required min={0} max={100} step={0.5} value={scheduleForm.hourly_increase_percent}
                    onChange={e => setScheduleForm({ ...scheduleForm, hourly_increase_percent: Number(e.target.value) })}
                    className="w-full px-4 py-3 bg-slate-50 border border-gray-100 rounded-xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10 pr-8" />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">%</span>
                </div>
                <p className="text-[9px] text-slate-400 mt-1">3% = cada hora sube 3% compuesto sobre el valor anterior</p>
              </div>
              <div className="flex items-center gap-4 pt-2">
                <button type="submit" disabled={isSaving}
                  className="px-8 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md flex items-center gap-2 disabled:opacity-50">
                  {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  {editingScheduleId ? 'Guardar Cambios' : 'Crear Horario'}
                </button>
                <button type="button" onClick={() => { setShowScheduleForm(false); setEditingScheduleId(null); setScheduleForm(defaultScheduleForm) }}
                  className="px-6 py-3 text-slate-500 hover:text-slate-800 text-[10px] font-black uppercase tracking-widest">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )

  function renderVehicleConfig(vehicleType: string) {
    const card = cards.find(c => c.vehicle_type === vehicleType)
    if (!card) return (
      <div className="p-6 text-center text-sm text-slate-400">
        Sin tarifa configurada.
      </div>
    )
    return (
      <div className="p-6 grid grid-cols-3 gap-4 border-b border-gray-50">
        <div className="text-center">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Mínimo</p>
          <p className="text-lg font-black text-slate-900">${card.minimum_fare.toLocaleString('es-CO')}</p>
        </div>
        <div className="text-center">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Comisión</p>
          <p className="text-lg font-black text-emerald-600">{card.commission_percent}%</p>
        </div>
        <div className="text-center">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Km incl.</p>
          <p className="text-lg font-black text-slate-900">{card.included_km} km</p>
        </div>
        <div className="text-center col-span-3">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Km adicional</p>
          <p className="text-sm font-black text-slate-700">+{card.extra_km_percent}% del valor base actual por km extra</p>
        </div>
      </div>
    )
  }

  function renderScheduleTable(vehicleType: string) {
    const rows = groupSchedules(vehicleType)
    return (
      <div className="divide-y divide-gray-50">
        {rows.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-400">Sin horarios configurados.</div>
        ) : rows.map(s => {
          const ShiftIcon = shiftLabels[s.shift_label]?.icon || Clock
          return (
            <div key={s.id} className="p-5 hover:bg-slate-50/40 transition-colors">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${s.day_type === 'weekday' ? 'bg-blue-50 text-blue-600' : s.day_type === 'weekend' ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-500'}`}>
                    {dayTypeLabels[s.day_type]}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                    <ShiftIcon size={12} />
                    {s.shift_start.slice(0, 5)} - {s.shift_end.slice(0, 5)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => handleEditSchedule(s)}
                    className="p-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-all" title="Editar">
                    <Pencil size={12} />
                  </button>
                  <button onClick={() => handleDeleteSchedule(s.id, s.name)}
                    className="p-1.5 text-red-500 bg-red-50 hover:bg-red-100 rounded-lg transition-all" title="Eliminar">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div>
                  <span className="text-lg font-black text-slate-900">${s.base_fee.toLocaleString('es-CO')}</span>
                  <span className="text-[10px] text-slate-400 ml-1.5">base</span>
                </div>
                <div className="flex items-center gap-1 text-emerald-600 font-black text-sm">
                  <ArrowUp size={14} />
                  {s.hourly_increase_percent}% <span className="text-[10px] text-slate-400 font-bold">/hora</span>
                </div>
              </div>
              <div className="mt-1.5">
                <span className="text-[9px] text-slate-400">
                  Ej: 1h → ${(s.base_fee * (1 + s.hourly_increase_percent / 100)).toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                  {' · '}2h → ${(s.base_fee * Math.pow(1 + s.hourly_increase_percent / 100, 2)).toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                  {' · '}3h → ${(s.base_fee * Math.pow(1 + s.hourly_increase_percent / 100, 3)).toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                </span>
              </div>
            </div>
          )
        })}
        <div className="p-4 border-t border-gray-50">
          <button onClick={() => { setShowScheduleForm(true); setEditingScheduleId(null); setScheduleForm({ ...defaultScheduleForm, vehicle_type: vehicleType }) }}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
            <Plus size={14} /> Agregar Horario
          </button>
        </div>
      </div>
    )
  }
}
