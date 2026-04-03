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
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">

      {/* Resumen Estadístico */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl">
            <Users size={28} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Total Administradores</p>
            <p className="text-3xl font-black text-gray-900">{admins.length}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl">
            <ShieldCheck size={28} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Cuentas Activas</p>
            <p className="text-3xl font-black text-emerald-600">{activeAdmins}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow group">
          <div className="p-4 bg-orange-50 text-orange-600 rounded-2xl group-hover:bg-orange-100 transition-colors">
            <PowerOff size={28} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Cuentas Pausadas</p>
            <p className="text-3xl font-black text-orange-600">{admins.length - activeAdmins}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Formulario de Creación */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xl overflow-hidden relative">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-full -z-0 opacity-50"></div>

            <div className="relative z-10">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className={`p-2 ${editingAdmin ? 'bg-orange-500' : 'bg-blue-600'} text-white rounded-lg shadow-lg`}>
                    {editingAdmin ? <Edit2 size={20} /> : <UserPlus size={20} />}
                  </div>
                  <h2 className="text-xl font-black text-gray-900">{editingAdmin ? 'Editar Administrador' : 'Nueva Invitación'}</h2>
                </div>
                {editingAdmin && (
                  <button onClick={() => setEditingAdmin(null)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400">
                    <X size={20} />
                  </button>
                )}
              </div>

              {error && (
                <div className="bg-red-50 border border-red-100 text-red-700 p-4 rounded-2xl mb-6 flex gap-3 animate-in shake duration-300">
                  <ShieldAlert size={20} className="shrink-0" />
                  <p className="text-xs font-bold leading-tight">{error}</p>
                </div>
              )}

              {success && (
                <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 p-4 rounded-2xl mb-6 flex gap-3 animate-bounce-subtle">
                  <ShieldCheck size={20} className="shrink-0" />
                  <p className="text-xs font-bold leading-tight">¡{editingAdmin ? 'Actualizado' : 'Creado'} con éxito!</p>
                </div>
              )}

              <form ref={formRef} action={handleSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-tighter ml-1">Nombre Completo</label>
                  <input key={`name-${editingAdmin?.id}`} name="name" type="text" required defaultValue={editingAdmin?.name} className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-medium" placeholder="P Ej. Juan Valdez" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-tighter ml-1">Email Corporativo</label>
                  <input key={`email-${editingAdmin?.id}`} name="email" type="email" required defaultValue={editingAdmin?.email} className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-medium" placeholder="admin@carsigo.com" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-tighter ml-1">Teléfono Móvil</label>
                  <input key={`phone-${editingAdmin?.id}`} name="phone" type="tel" required defaultValue={editingAdmin?.phone} className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-medium" placeholder="+57 300 123 4567" />
                </div>
                {!editingAdmin && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-tighter ml-1">Contraseña Temporal</label>
                    <input name="password" type="password" required className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-medium" placeholder="••••••••" />
                  </div>
                )}

                <button type="submit" disabled={isPending} className={`w-full py-4 ${editingAdmin ? 'bg-orange-600 hover:bg-orange-700 shadow-orange-500/30' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/30'} text-white rounded-2xl font-black shadow-lg transition-all active:scale-[0.98] disabled:opacity-50`}>
                  {isPending ? 'Procesando...' : (editingAdmin ? 'Guardar Cambios' : 'Habilitar Cuenta')}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Lista de Administradores */}
        <div className="lg:col-span-2">
          {/* ... */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden min-h-[500px]">
            <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-slate-50/50">
              <h3 className="font-black text-gray-900 flex items-center gap-2 tracking-tight">
                <Shield size={20} className="text-blue-600" />
                Listado de Seguridad
              </h3>
              <div className="px-3 py-1 bg-white border border-gray-200 rounded-full text-[10px] font-bold text-gray-500 shadow-sm">
                Sincronizado con PostGIS
              </div>
            </div>

            <div className="divide-y divide-gray-50 overflow-y-auto max-h-[600px]">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 animate-pulse">
                  <LoaderIcon size={40} className="text-blue-200 animate-spin mb-4" />
                  <p className="text-gray-400 font-bold">Consiguiendo datos...</p>
                </div>
              ) : admins.length === 0 ? (
                <div className="text-center py-20 text-gray-400 px-10">
                  <p className="font-bold text-lg mb-2">No hay otros administradores</p>
                  <p className="text-sm">Usa el formulario de la izquierda para invitar a tu primer colaborador.</p>
                </div>
              ) : (
                admins.map((admin) => (
                  <div key={admin.id} className="p-6 flex items-center justify-between hover:bg-blue-50/30 transition-colors group">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg shadow-sm group-hover:scale-110 transition-transform ${admin.role === 'superadmin' ? 'bg-indigo-600 text-white ring-4 ring-indigo-50' : 'bg-white border border-gray-200 text-blue-600'}`}>
                        {admin.name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-black text-gray-900 tracking-tight">{admin.name}</h4>
                          {admin.role === 'superadmin' && <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-[9px] font-black uppercase">DUEÑO</span>}
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                          <p className="text-xs text-gray-400 font-medium">{admin.email}</p>
                          <span className="hidden sm:inline text-gray-200">•</span>
                          <p className="text-[10px] font-black text-blue-500 uppercase tracking-tighter flex items-center gap-1">
                            <span>📞</span> {admin.phone || 'S/N'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right hidden sm:block">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${admin.status === 'active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                          {admin.status === 'active' ? 'Activo' : 'Pausado'}
                        </span>
                      </div>

                      {admin.role !== 'superadmin' && (
                        <>
                          <button
                            onClick={() => handleEdit(admin)}
                            disabled={isPending}
                            className="p-3 bg-orange-50 text-orange-600 hover:bg-orange-100 rounded-2xl transition-all shadow-sm"
                            title="Editar Perfil"
                          >
                            <Edit2 size={20} />
                          </button>

                          <button
                            onClick={() => handleToggleStatus(admin.id, admin.status)}
                            disabled={isPending}
                            className={`p-3 rounded-2xl transition-all shadow-sm ${admin.status === 'active' ? 'bg-amber-50 text-amber-600 hover:bg-amber-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}
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
      <div className="absolute inset-0 rounded-full border-4 border-slate-100"></div>
      <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin"></div>
    </div>
  )
}
