'use client'

import { useState, useEffect } from 'react'
import { Tag, Plus, Pencil, Trash2, Loader2, Car, Bike } from 'lucide-react'
import { getRateCards, createRateCard, updateRateCard, deleteRateCard } from './actions'
import { useToast } from '@/contexts/ToastContext'

type RateCard = {
  id: string
  name: string
  vehicle_type: string
  base_fee: number
  price_per_km: number
  price_per_minute: number
  minimum_fare: number
  free_waiting_minutes: number
  waiting_price_per_minute: number
  commission_percent: number
  is_active: boolean
  created_at: string
}

const defaultForm = {
  name: '',
  vehicle_type: 'car',
  base_fee: 2500,
  price_per_km: 1000,
  price_per_minute: 150,
  minimum_fare: 3500,
  free_waiting_minutes: 5,
  waiting_price_per_minute: 200,
  commission_percent: 10,
}

export default function TarifasPage() {
  const toast = useToast()
  const [rateCards, setRateCards] = useState<RateCard[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(defaultForm)
  const [isSaving, setIsSaving] = useState(false)

  const load = () => {
    getRateCards().then(data => { setRateCards(data); setIsLoading(false) })
  }

  useEffect(() => { load() }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    const payload = { ...form }
    if (editingId) {
      const res = await updateRateCard(editingId, payload)
      if (res.success) toast.success('Tarifa actualizada')
      else toast.error(res.error || 'Error al actualizar')
    } else {
      const res = await createRateCard(payload)
      if (res.success) toast.success('Tarifa creada')
      else toast.error(res.error || 'Error al crear')
    }
    setIsSaving(false)
    setShowForm(false)
    setEditingId(null)
    setForm(defaultForm)
    load()
  }

  const handleEdit = (rc: RateCard) => {
    setForm({
      name: rc.name,
      vehicle_type: rc.vehicle_type,
      base_fee: rc.base_fee,
      price_per_km: rc.price_per_km,
      price_per_minute: rc.price_per_minute,
      minimum_fare: rc.minimum_fare,
      free_waiting_minutes: rc.free_waiting_minutes,
      waiting_price_per_minute: rc.waiting_price_per_minute,
      commission_percent: rc.commission_percent,
    })
    setEditingId(rc.id)
    setShowForm(true)
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar tarifa "${name}"?`)) return
    const res = await deleteRateCard(id)
    if (res.success) { toast.success('Tarifa eliminada'); load() }
    else toast.error(res.error || 'Error al eliminar')
  }

  const handleToggle = async (rc: RateCard) => {
    const res = await updateRateCard(rc.id, { is_active: !rc.is_active })
    if (res.success) { toast.info(`Tarifa ${rc.is_active ? 'desactivada' : 'activada'}`); load() }
    else toast.error(res.error || 'Error')
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20 font-sans">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg border border-blue-100 shadow-sm">
              <Tag size={20} />
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter">Tarifas Base</h1>
          </div>
          <p className="text-slate-500 font-medium">Configuración de tarifas por tipo de vehículo para el municipio.</p>
        </div>
        {!showForm && (
          <button onClick={() => { setShowForm(true); setEditingId(null); setForm(defaultForm) }}
            className="flex items-center gap-2 px-6 py-3 bg-[#00E5FF] hover:bg-[#00D0E8] text-[#131313] rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md active:scale-95">
            <Plus size={14} /> Nueva Tarifa
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-white border border-gray-100 p-8 rounded-[2.5rem] shadow-sm">
          <h3 className="text-xl font-black text-slate-900 tracking-tight mb-6">
            {editingId ? 'Editar Tarifa' : 'Nueva Tarifa Base'}
          </h3>
          <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Nombre</label>
              <input type="text" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Ej: Tarifa Estándar" className="w-full px-4 py-3 bg-slate-50 border border-gray-100 rounded-xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10" />
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Tipo Vehículo</label>
              <select value={form.vehicle_type} onChange={e => setForm({ ...form, vehicle_type: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 border border-gray-100 rounded-xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10">
                <option value="car">Carro</option>
                <option value="moto">Moto</option>
              </select>
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Comisión %</label>
              <input type="number" required min={0} max={100} step={0.5} value={form.commission_percent}
                onChange={e => setForm({ ...form, commission_percent: Number(e.target.value) })}
                className="w-full px-4 py-3 bg-slate-50 border border-gray-100 rounded-xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10" />
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Banderazo ($)</label>
              <input type="number" required min={0} value={form.base_fee} onChange={e => setForm({ ...form, base_fee: Number(e.target.value) })}
                className="w-full px-4 py-3 bg-slate-50 border border-gray-100 rounded-xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10" />
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Precio por Km ($)</label>
              <input type="number" required min={0} value={form.price_per_km} onChange={e => setForm({ ...form, price_per_km: Number(e.target.value) })}
                className="w-full px-4 py-3 bg-slate-50 border border-gray-100 rounded-xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10" />
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Precio por min ($)</label>
              <input type="number" required min={0} value={form.price_per_minute} onChange={e => setForm({ ...form, price_per_minute: Number(e.target.value) })}
                className="w-full px-4 py-3 bg-slate-50 border border-gray-100 rounded-xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10" />
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Tarifa mínima ($)</label>
              <input type="number" required min={0} value={form.minimum_fare} onChange={e => setForm({ ...form, minimum_fare: Number(e.target.value) })}
                className="w-full px-4 py-3 bg-slate-50 border border-gray-100 rounded-xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10" />
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Minutos espera gratis</label>
              <input type="number" required min={0} value={form.free_waiting_minutes} onChange={e => setForm({ ...form, free_waiting_minutes: Number(e.target.value) })}
                className="w-full px-4 py-3 bg-slate-50 border border-gray-100 rounded-xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10" />
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Espera adicional ($/min)</label>
              <input type="number" required min={0} value={form.waiting_price_per_minute} onChange={e => setForm({ ...form, waiting_price_per_minute: Number(e.target.value) })}
                className="w-full px-4 py-3 bg-slate-50 border border-gray-100 rounded-xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10" />
            </div>
            <div className="md:col-span-2 lg:col-span-3 flex items-center gap-4 pt-4">
              <button type="submit" disabled={isSaving}
                className="px-8 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md flex items-center gap-2 disabled:opacity-50">
                {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                {editingId ? 'Guardar Cambios' : 'Crear Tarifa'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setEditingId(null); setForm(defaultForm) }}
                className="px-6 py-3 text-slate-500 hover:text-slate-800 text-[10px] font-black uppercase tracking-widest">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white border border-gray-100 rounded-[2.5rem] shadow-sm overflow-hidden">
        <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-slate-50/30">
          <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Car size={20} className="text-[#00606b]" />
            Tarifas Configuradas
          </h3>
          <span className="px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-black rounded-lg border border-blue-100">{rateCards.length}</span>
        </div>

        {isLoading ? (
          <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-blue-500" size={40} /></div>
        ) : rateCards.length === 0 ? (
          <div className="p-20 text-center">
            <Tag className="mx-auto mb-4 text-slate-200" size={40} />
            <h4 className="text-lg font-black text-slate-400 uppercase tracking-tighter">Sin tarifas configuradas</h4>
            <p className="text-slate-300 text-sm mt-2">Crea la primera tarifa base para tu municipio.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 border-b border-gray-100">
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Nombre</th>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Tipo</th>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Banderazo</th>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Km</th>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Minuto</th>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Comisión</th>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Estado</th>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rateCards.map(rc => (
                  <tr key={rc.id} className="hover:bg-slate-50/40 transition-colors">
                    <td className="px-6 py-5 font-bold text-slate-800 text-sm">{rc.name}</td>
                    <td className="px-6 py-5">
                      <span className="flex items-center gap-1.5 text-sm font-bold text-slate-600">
                        {rc.vehicle_type === 'car' ? <Car size={14} /> : <Bike size={14} />}
                        {rc.vehicle_type === 'car' ? 'Carro' : 'Moto'}
                      </span>
                    </td>
                    <td className="px-6 py-5 font-black text-slate-800">${rc.base_fee.toLocaleString('es-CO')}</td>
                    <td className="px-6 py-5 font-black text-slate-800">${rc.price_per_km.toLocaleString('es-CO')}</td>
                    <td className="px-6 py-5 font-black text-slate-800">${rc.price_per_minute.toLocaleString('es-CO')}</td>
                    <td className="px-6 py-5 font-black text-emerald-600">{rc.commission_percent}%</td>
                    <td className="px-6 py-5">
                      <button onClick={() => handleToggle(rc)}
                        className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${rc.is_active ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-500 border-red-100'}`}>
                        {rc.is_active ? 'Activa' : 'Inactiva'}
                      </button>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <button onClick={() => handleEdit(rc)}
                          className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-all" title="Editar">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => handleDelete(rc.id, rc.name)}
                          className="p-2 text-red-500 bg-red-50 hover:bg-red-100 rounded-xl transition-all" title="Eliminar">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
