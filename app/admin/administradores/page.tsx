'use client';

import { useState, useTransition, useEffect, useRef } from 'react'
import { inviteAdmin, getAdmins, toggleAdminStatus, updateAdmin } from './actions'
import { ShieldCheck, UserPlus, ShieldAlert, Users, Power, PowerOff, Shield, Edit2, X } from 'lucide-react'

export default function AdministradoresPage() {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<boolean>(false)
  const [isPending, startTransition] = useTransition()
  const [admins, setAdmins] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingAdmin, setEditingAdmin] = useState<any | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    async function loadData() {
      const data = await getAdmins()
      setAdmins(data)
      setIsLoading(false)
    }
    loadData()
  }, [])

  const handleSubmit = async (formData: FormData) => {
    setError(null)
    setSuccess(false)
    startTransition(async () => {
      let result;
      if (editingAdmin) {
        result = await updateAdmin(editingAdmin.id, formData)
      } else {
        result = await inviteAdmin(formData)
      }

      if (result?.error) {
        setError(result.error)
      } else if (result?.success) {
        setSuccess(true)
        const updated = await getAdmins()
        setAdmins(updated)
        if (editingAdmin) setEditingAdmin(null)
        formRef.current?.reset()
      }
    })
  }

  const handleEdit = (admin: any) => {
    setEditingAdmin(admin)
    setError(null)
    setSuccess(false)
    // Desplazamos al formulario si es necesario
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleToggleStatus = (userId: string, currentStatus: string) => {
    startTransition(async () => {
      const result = await toggleAdminStatus(userId, currentStatus)
      if (result?.success) {
        const updated = await getAdmins()
        setAdmins(updated)
      }
    })
  }

  const activeAdmins = admins.filter(a => a.status === 'active').length

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">

      {/* Resumen Estadístico */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#141416] p-6 rounded-3xl border border-white/5 shadow-sm flex items-center gap-4 transition-all">
          <div className="p-4 bg-purple-500/10 text-purple-400 rounded-xl">
            <Users size={28} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-400">Total Administradores</p>
            <p className="text-3xl font-bold text-white tabular-nums">{admins.length}</p>
          </div>
        </div>
        <div className="bg-[#141416] p-6 rounded-3xl border border-white/5 shadow-sm flex items-center gap-4 transition-all">
          <div className="p-4 bg-emerald-500/10 text-emerald-400 rounded-xl">
            <ShieldCheck size={28} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-400">Cuentas Activas</p>
            <p className="text-3xl font-bold text-emerald-400 tabular-nums">{activeAdmins}</p>
          </div>
        </div>
        <div className="bg-[#141416] p-6 rounded-3xl border border-white/5 shadow-sm flex items-center gap-4 transition-all group">
          <div className="p-4 rounded-xl bg-orange-500/10 text-orange-400">
            <PowerOff size={28} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-400">Cuentas Pausadas</p>
            <p className="text-3xl font-bold text-orange-400 tabular-nums">{admins.length - activeAdmins}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Formulario de Creación */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-[#141416] p-6 rounded-3xl border border-white/5 shadow-sm overflow-hidden relative">
            <div className="absolute top-0 right-0 w-24 h-24 bg-[#00E5FF]/10 rounded-bl-full -z-0 opacity-20"></div>

            <div className="relative z-10">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${editingAdmin ? 'bg-orange-500/10 text-orange-400' : 'bg-[#00E5FF]/10 text-[#00E5FF]'}`}>
                    {editingAdmin ? <Edit2 size={20} /> : <UserPlus size={20} />}
                  </div>
                  <h2 className="text-xl font-black text-white tracking-tight">{editingAdmin ? 'Editar Administrador' : 'Nueva Invitación'}</h2>
                </div>
                {editingAdmin && (
                  <button onClick={() => setEditingAdmin(null)} className="p-2 hover:bg-white/5 rounded-full text-slate-400 transition-colors focus-visible:ring-2 focus-visible:ring-[#00E5FF]/60">
                    <X size={20} />
                  </button>
                )}
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-2xl mb-6 flex gap-3 animate-in shake duration-300">
                  <ShieldAlert size={20} className="shrink-0" />
                  <p className="text-xs font-bold leading-tight">{error}</p>
                </div>
              )}

              {success && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-2xl mb-6 flex gap-3 animate-bounce-subtle">
                  <ShieldCheck size={20} className="shrink-0" />
                  <p className="text-xs font-bold leading-tight">¡{editingAdmin ? 'Actualizado' : 'Creado'} con éxito!</p>
                </div>
              )}

              <form ref={formRef} action={handleSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nombre Completo</label>
                  <input key={`name-${editingAdmin?.id}`} name="name" type="text" required defaultValue={editingAdmin?.name} className="w-full px-4 py-3 bg-[#0f0f11] border border-white/10 rounded-xl outline-none focus:ring-2 focus:ring-[#00E5FF]/40 focus:border-[#00E5FF]/40 transition-all font-medium text-white placeholder:text-slate-500" placeholder="P Ej. Juan Valdez" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Email Corporativo</label>
                  <input key={`email-${editingAdmin?.id}`} name="email" type="email" required defaultValue={editingAdmin?.email} className="w-full px-4 py-3 bg-[#0f0f11] border border-white/10 rounded-xl outline-none focus:ring-2 focus:ring-[#00E5FF]/40 focus:border-[#00E5FF]/40 transition-all font-medium text-white placeholder:text-slate-500" placeholder="admin@carsigo.com" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Teléfono Móvil</label>
                  <input key={`phone-${editingAdmin?.id}`} name="phone" type="tel" required defaultValue={editingAdmin?.phone} className="w-full px-4 py-3 bg-[#0f0f11] border border-white/10 rounded-xl outline-none focus:ring-2 focus:ring-[#00E5FF]/40 focus:border-[#00E5FF]/40 transition-all font-medium text-white placeholder:text-slate-500" placeholder="+57 300 123 4567" />
                </div>
                {!editingAdmin && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Contraseña Temporal</label>
                    <input name="password" type="password" required className="w-full px-4 py-3 bg-[#0f0f11] border border-white/10 rounded-xl outline-none focus:ring-2 focus:ring-[#00E5FF]/40 focus:border-[#00E5FF]/40 transition-all font-medium text-white placeholder:text-slate-500" placeholder="••••••••" />
                  </div>
                )}

                <button type="submit" disabled={isPending} className={`w-full py-4 rounded-xl font-black uppercase tracking-widest transition-all active:scale-[0.98] disabled:opacity-50 focus-visible:ring-2 ${editingAdmin ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20 hover:bg-orange-500/20 focus-visible:ring-orange-500/60' : 'bg-[#00E5FF] hover:bg-[#00D0E8] text-[#131313] focus-visible:ring-[#00E5FF]/60'}`}>
                  {isPending ? 'Procesando...' : (editingAdmin ? 'Guardar Cambios' : 'Habilitar Cuenta')}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Lista de Administradores */}
        <div className="lg:col-span-2">
          {/* ... */}
          <div className="bg-[#141416] rounded-3xl border border-white/5 shadow-sm overflow-hidden min-h-[500px]">
            <div className="p-6 md:p-8 border-b border-white/5 flex items-center justify-between bg-white/2">
              <h3 className="font-black text-white flex items-center gap-2 tracking-tight">
                <Shield size={20} className="text-[#00E5FF]" />
                Listado de Seguridad
              </h3>
              <div className="px-3 py-1 bg-[#00E5FF]/10 text-[#00E5FF] border border-[#00E5FF]/20 rounded-full text-[10px] font-bold uppercase tracking-widest">
                Sincronizado con Firestore
              </div>
            </div>

            <div className="divide-y divide-white/5 overflow-y-auto max-h-[600px]">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 animate-pulse">
                  <LoaderIcon size={40} className="animate-spin mb-4" />
                  <p className="text-slate-400 font-bold">Consiguiendo datos...</p>
                </div>
              ) : admins.length === 0 ? (
                <div className="text-center py-20 text-slate-500 px-10">
                  <p className="font-bold text-lg mb-2">No hay otros administradores</p>
                  <p className="text-sm text-slate-400">Usa el formulario de la izquierda para invitar a tu primer colaborador.</p>
                </div>
              ) : (
                admins.map((admin) => (
                  <div key={admin.id} className="p-6 flex items-center justify-between hover:bg-[#00E5FF]/5 transition-all group">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg shadow-sm group-hover:scale-110 transition-transform ${admin.role === 'superadmin' ? 'bg-[#00E5FF]/10 text-[#00E5FF] border border-[#00E5FF]/40 ring-4 ring-white/5' : 'bg-white/5 border border-white/10 text-[#00E5FF] ring-4 ring-white/5'}`}>
                        {(admin.name || 'A').charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-black text-white tracking-tight">{admin.name}</h4>
                          {admin.role === 'superadmin' && <span className="bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded-full text-[9px] font-black uppercase">DUEÑO</span>}
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                          <p className="text-xs text-slate-400 font-medium">{admin.email}</p>
                          <span className="hidden sm:inline text-slate-600">•</span>
                          <p className="text-[10px] font-black text-[#00E5FF] uppercase tracking-wider flex items-center gap-1">
                            <span>📞</span> {admin.phone || 'S/N'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right hidden sm:block">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${admin.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                          {admin.status === 'active' ? 'Activo' : 'Pausado'}
                        </span>
                      </div>

                      {admin.role !== 'superadmin' && (
                        <>
                          <button
                            onClick={() => handleEdit(admin)}
                            disabled={isPending}
                            className="p-3 bg-orange-500/10 text-orange-400 border border-orange-500/20 hover:bg-orange-500/20 rounded-xl transition-all shadow-sm focus-visible:ring-2 focus-visible:ring-orange-500/60"
                            title="Editar Perfil"
                          >
                            <Edit2 size={20} />
                          </button>

                          <button
                            onClick={() => handleToggleStatus(admin.id, admin.status)}
                            disabled={isPending}
                            className={`p-3 rounded-xl transition-all shadow-sm focus-visible:ring-2 ${admin.status === 'active' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20 hover:bg-orange-500/20 focus-visible:ring-orange-500/60' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 focus-visible:ring-emerald-500/60'}`}
                            title={admin.status === 'active' ? 'Pausar Acceso' : 'Activar Acceso'}
                          >
                            {admin.status === 'active' ? <PowerOff size={20} /> : <Power size={20} />}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function LoaderIcon({ size, className }: { size: number, className?: string }) {
  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      <div className="absolute inset-0 rounded-full border-4 border-white/10"></div>
      <div className="absolute inset-0 rounded-full border-4 border-[#00E5FF] border-t-transparent animate-spin"></div>
    </div>
  )
}
