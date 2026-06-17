'use client'

import { useState, useEffect } from 'react'
import { Zap, Plus, Pencil, Trash2, Loader2, Calendar, Clock, MapPin } from 'lucide-react'
import { getDynamicPricingRules, createDynamicPricingRule, updateDynamicPricingRule, deleteDynamicPricingRule, getGeofences } from './actions'
import { useToast } from '@/contexts/ToastContext'

type Rule = {
  id: string
  name: string
  description: string | null
  rule_type: string
  start_time: string | null
  end_time: string | null
  days_of_week: number[] | null
  specific_date: string | null
  is_recurring: boolean
  date_from: string | null
  date_to: string | null
  multiplier: number
  flat_surcharge: number
  geofence_id: string | null
  vehicle_type: string | null
  is_active: boolean
  priority: number
  created_at: string
}

type Geofence = { id: string; municipality_name: string }

const ruleTypeLabels: Record<string, string> = {
  time_range: 'Rango Horario',
  day_of_week: 'Día de Semana',
  specific_date: 'Fecha Específica',
  date_range: 'Rango de Fechas',
  demand_zone: 'Zona de Demanda',
  event: 'Evento Especial',
}

const dayLabels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const defaultForm = {
  name: '',
  description: '',
  rule_type: 'time_range',
  start_time: '',
  end_time: '',
  days_of_week: [] as number[],
  specific_date: '',
  is_recurring: false,
  date_from: '',
  date_to: '',
  multiplier: 1.3,
  flat_surcharge: 0,
  geofence_id: '',
  vehicle_type: '',
  priority: 100,
}

export default function PrecioDinamicoPage() {
  const toast = useToast()
  const [rules, setRules] = useState<Rule[]>([])
  const [geofences, setGeofences] = useState<Geofence[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(defaultForm)
  const [isSaving, setIsSaving] = useState(false)

  const load = () => {
    Promise.all([getDynamicPricingRules(), getGeofences()]).then(([data, fences]) => {
      setRules(data); setGeofences(fences); setIsLoading(false)
    })
  }

  useEffect(() => { load() }, [])

  const toggleDay = (day: number) => {
    setForm(prev => ({
      ...prev,
      days_of_week: prev.days_of_week.includes(day)
        ? prev.days_of_week.filter(d => d !== day)
        : [...prev.days_of_week, day]
    }))
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    const payload: any = {
      name: form.name,
      description: form.description || null,
      rule_type: form.rule_type,
      multiplier: form.multiplier,
      flat_surcharge: form.flat_surcharge,
      priority: form.priority,
      geofence_id: form.geofence_id || null,
      vehicle_type: form.vehicle_type || null,
      is_recurring: form.is_recurring,
    }
    if (form.rule_type === 'time_range') {
      payload.start_time = form.start_time || null
      payload.end_time = form.end_time || null
      payload.days_of_week = form.days_of_week.length > 0 ? form.days_of_week : null
    }
    if (form.rule_type === 'day_of_week') {
      payload.days_of_week = form.days_of_week
    }
    if (form.rule_type === 'specific_date') {
      payload.specific_date = form.specific_date || null
    }
    if (form.rule_type === 'date_range') {
      payload.date_from = form.date_from || null
      payload.date_to = form.date_to || null
    }
    if (form.rule_type === 'demand_zone') {
      payload.geofence_id = form.geofence_id || null
      payload.days_of_week = form.days_of_week.length > 0 ? form.days_of_week : null
      payload.start_time = form.start_time || null
      payload.end_time = form.end_time || null
    }

    if (editingId) {
      const res = await updateDynamicPricingRule(editingId, payload)
      if (res.success) toast.success('Regla actualizada')
      else toast.error(res.error || 'Error al actualizar')
    } else {
      const res = await createDynamicPricingRule(payload)
      if (res.success) toast.success('Regla creada')
      else toast.error(res.error || 'Error al crear')
    }
    setIsSaving(false)
    setShowForm(false)
    setEditingId(null)
    setForm(defaultForm)
    load()
  }

  const handleEdit = (rule: Rule) => {
    setForm({
      name: rule.name,
      description: rule.description || '',
      rule_type: rule.rule_type,
      start_time: rule.start_time?.slice(0, 5) || '',
      end_time: rule.end_time?.slice(0, 5) || '',
      days_of_week: rule.days_of_week || [],
      specific_date: rule.specific_date || '',
      is_recurring: rule.is_recurring,
      date_from: rule.date_from || '',
      date_to: rule.date_to || '',
      multiplier: rule.multiplier,
      flat_surcharge: rule.flat_surcharge,
      geofence_id: rule.geofence_id || '',
      vehicle_type: rule.vehicle_type || '',
      priority: rule.priority,
    })
    setEditingId(rule.id)
    setShowForm(true)
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar regla "${name}"?`)) return
    const res = await deleteDynamicPricingRule(id)
    if (res.success) { toast.success('Regla eliminada'); load() }
    else toast.error(res.error || 'Error al eliminar')
  }

  const handleToggle = async (rule: Rule) => {
    const res = await updateDynamicPricingRule(rule.id, { is_active: !rule.is_active })
    if (res.success) { toast.info(`Regla ${rule.is_active ? 'desactivada' : 'activada'}`); load() }
    else toast.error(res.error || 'Error')
  }

  const getSummary = (rule: Rule) => {
    const parts: string[] = []
    if (rule.rule_type === 'time_range') {
      if (rule.start_time && rule.end_time) parts.push(`${rule.start_time.slice(0, 5)} - ${rule.end_time.slice(0, 5)}`)
      if (rule.days_of_week) parts.push(rule.days_of_week.map(d => dayLabels[d - 1]).join(', '))
    }
    if (rule.rule_type === 'day_of_week' && rule.days_of_week) {
      parts.push(rule.days_of_week.map(d => dayLabels[d - 1]).join(', '))
    }
    if (rule.rule_type === 'specific_date') {
      parts.push(rule.specific_date || '')
      if (rule.is_recurring) parts.push('Cada año')
    }
    if (rule.rule_type === 'date_range' && rule.date_from && rule.date_to) {
      parts.push(`${rule.date_from} → ${rule.date_to}`)
    }
    if (rule.rule_type === 'demand_zone' && rule.geofence_id) {
      const gf = geofences.find(g => g.id === rule.geofence_id)
      if (gf) parts.push(gf.municipality_name)
    }
    return parts.join(' · ') || '—'
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'time_range': return <Clock size={14} />
      case 'day_of_week': return <Calendar size={14} />
      case 'specific_date': return <Calendar size={14} />
      case 'date_range': return <Calendar size={14} />
      case 'demand_zone': return <MapPin size={14} />
      case 'event': return <Zap size={14} />
      default: return <Zap size={14} />
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20 font-sans">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg border border-purple-100 shadow-sm">
              <Zap size={20} />
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter">Precio Dinámico</h1>
          </div>
          <p className="text-slate-500 font-medium">Reglas de aumento de tarifa por hora, día, fecha especial o zona.</p>
        </div>
        {!showForm && (
          <button onClick={() => { setShowForm(true); setEditingId(null); setForm(defaultForm) }}
            className="flex items-center gap-2 px-6 py-3 bg-[#00E5FF] hover:bg-[#00D0E8] text-[#131313] rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md active:scale-95">
            <Plus size={14} /> Nueva Regla
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-white border border-gray-100 p-8 rounded-[2.5rem] shadow-sm">
          <h3 className="text-xl font-black text-slate-900 tracking-tight mb-6">
            {editingId ? 'Editar Regla' : 'Nueva Regla de Precio Dinámico'}
          </h3>
          <form onSubmit={handleSave} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Nombre</label>
                <input type="text" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Ej: Hora Pico Mañana" className="w-full px-4 py-3 bg-slate-50 border border-gray-100 rounded-xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10" />
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Tipo de Regla</label>
                <select value={form.rule_type} onChange={e => setForm({ ...form, rule_type: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-gray-100 rounded-xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10">
                  {Object.entries(ruleTypeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Multiplicador (×)</label>
                <input type="number" required min={0.5} max={5} step={0.1} value={form.multiplier}
                  onChange={e => setForm({ ...form, multiplier: Number(e.target.value) })}
                  className="w-full px-4 py-3 bg-slate-50 border border-gray-100 rounded-xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10" />
                <p className="text-[9px] text-slate-400 mt-1">1.0 = normal, 1.5 = +50%, 2.0 = +100%</p>
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Recargo fijo ($)</label>
                <input type="number" min={0} value={form.flat_surcharge} onChange={e => setForm({ ...form, flat_surcharge: Number(e.target.value) })}
                  className="w-full px-4 py-3 bg-slate-50 border border-gray-100 rounded-xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10" />
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Prioridad</label>
                <input type="number" min={0} max={999} value={form.priority} onChange={e => setForm({ ...form, priority: Number(e.target.value) })}
                  className="w-full px-4 py-3 bg-slate-50 border border-gray-100 rounded-xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10" />
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Vehículo (opcional)</label>
                <select value={form.vehicle_type} onChange={e => setForm({ ...form, vehicle_type: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-gray-100 rounded-xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10">
                  <option value="">Ambos</option>
                  <option value="moto">Solo Moto</option>
                  <option value="car">Solo Carro</option>
                </select>
              </div>
            </div>

            {/* Campos dinámicos según tipo */}
            {(form.rule_type === 'time_range' || form.rule_type === 'demand_zone') && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Hora Inicio</label>
                  <input type="time" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-gray-100 rounded-xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10" />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Hora Fin</label>
                  <input type="time" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-gray-100 rounded-xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10" />
                </div>
              </div>
            )}

            {(form.rule_type === 'time_range' || form.rule_type === 'day_of_week' || form.rule_type === 'demand_zone') && (
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-3">Días de la Semana</label>
                <div className="flex flex-wrap gap-2">
                  {dayLabels.map((label, i) => {
                    const dayNum = i + 1
                    const selected = form.days_of_week.includes(dayNum)
                    return (
                      <button key={dayNum} type="button" onClick={() => toggleDay(dayNum)}
                        className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${selected ? 'bg-[#00E5FF] text-[#131313] border-[#00E5FF] shadow-sm' : 'bg-slate-50 text-slate-500 border-gray-100 hover:border-gray-200'}`}>
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {form.rule_type === 'specific_date' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Fecha</label>
                  <input type="date" value={form.specific_date} onChange={e => setForm({ ...form, specific_date: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-gray-100 rounded-xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10" />
                </div>
                <div className="flex items-end pb-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={form.is_recurring} onChange={e => setForm({ ...form, is_recurring: e.target.checked })}
                      className="w-5 h-5 accent-[#00E5FF]" />
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Repetir cada año</span>
                  </label>
                </div>
              </div>
            )}

            {form.rule_type === 'date_range' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Desde</label>
                  <input type="date" value={form.date_from} onChange={e => setForm({ ...form, date_from: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-gray-100 rounded-xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10" />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Hasta</label>
                  <input type="date" value={form.date_to} onChange={e => setForm({ ...form, date_to: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-gray-100 rounded-xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10" />
                </div>
              </div>
            )}

            {form.rule_type === 'demand_zone' && (
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Zona</label>
                <select value={form.geofence_id} onChange={e => setForm({ ...form, geofence_id: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-gray-100 rounded-xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10">
                  <option value="">Seleccionar zona...</option>
                  {geofences.map(gf => <option key={gf.id} value={gf.id}>{gf.municipality_name}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Descripción (opcional)</label>
              <input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Ej: Aumento por hora pico de la mañana" className="w-full px-4 py-3 bg-slate-50 border border-gray-100 rounded-xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10" />
            </div>

            <div className="flex items-center gap-4 pt-2">
              <button type="submit" disabled={isSaving}
                className="px-8 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md flex items-center gap-2 disabled:opacity-50">
                {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                {editingId ? 'Guardar Cambios' : 'Crear Regla'}
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
            <Zap size={20} className="text-purple-600" />
            Reglas de Precio Dinámico
          </h3>
          <span className="px-3 py-1 bg-purple-50 text-purple-600 text-[10px] font-black rounded-lg border border-purple-100">{rules.length}</span>
        </div>

        {isLoading ? (
          <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-purple-500" size={40} /></div>
        ) : rules.length === 0 ? (
          <div className="p-20 text-center">
            <Zap className="mx-auto mb-4 text-slate-200" size={40} />
            <h4 className="text-lg font-black text-slate-400 uppercase tracking-tighter">Sin reglas configuradas</h4>
            <p className="text-slate-300 text-sm mt-2">Agrega reglas para aumentar tarifas en horas pico, fines de semana o fechas especiales.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 border-b border-gray-100">
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Nombre</th>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Tipo</th>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Detalle</th>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Mult.</th>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Recargo</th>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Prioridad</th>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Estado</th>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rules.map(rule => (
                  <tr key={rule.id} className="hover:bg-slate-50/40 transition-colors">
                    <td className="px-6 py-5">
                      <p className="font-bold text-slate-800 text-sm">{rule.name}</p>
                      {rule.description && <p className="text-[10px] text-slate-400 mt-0.5">{rule.description}</p>}
                    </td>
                    <td className="px-6 py-5">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-600 rounded-full text-[9px] font-black uppercase tracking-widest border border-purple-100">
                        {getTypeIcon(rule.rule_type)} {ruleTypeLabels[rule.rule_type]}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-xs font-medium text-slate-600 max-w-[200px] truncate">{getSummary(rule)}</td>
                    <td className="px-6 py-5 font-black text-amber-600">×{rule.multiplier}</td>
                    <td className="px-6 py-5 font-bold text-slate-600">{rule.flat_surcharge > 0 ? `$${rule.flat_surcharge.toLocaleString('es-CO')}` : '—'}</td>
                    <td className="px-6 py-5">
                      <span className="font-mono text-xs font-bold text-slate-500">{rule.priority}</span>
                    </td>
                    <td className="px-6 py-5">
                      <button onClick={() => handleToggle(rule)}
                        className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${rule.is_active ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-500 border-red-100'}`}>
                        {rule.is_active ? 'Activa' : 'Inactiva'}
                      </button>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <button onClick={() => handleEdit(rule)}
                          className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-all" title="Editar">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => handleDelete(rule.id, rule.name)}
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
