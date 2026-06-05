'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Lock, Loader2, CheckCircle, ArrowRight } from 'lucide-react'
import Image from 'next/image'

export default function ResetPasswordPage() {
  const supabase = createClient()
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password || password.length < 6) {
      setError('La contrasena debe tener al menos 6 caracteres.')
      return
    }

    setIsLoading(true)
    setError(null)

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    })

    if (updateError) {
      setError(updateError.message)
      setIsLoading(false)
      return
    }

    setSuccess(true)
    setTimeout(() => router.push('/admin'), 2000)
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white flex selection:bg-cyan-400/30 font-sans">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 -left-40 w-150 h-150 bg-cyan-500/6 rounded-full blur-3xl" />
        <div className="absolute bottom-0 -right-40 w-125 h-125 bg-blue-600/5 rounded-full blur-3xl" />
      </div>

      <div
        className="fixed inset-0 opacity-[0.02] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      <div className="relative z-10 flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="relative w-44 h-16 mx-auto mb-8">
            <Image
              src="/assets/sub.png"
              alt="CarSiGo"
              fill
              sizes="176px"
              className="object-contain"
            />
          </div>

          <div className="bg-white/2 backdrop-blur-2xl border border-white/5 rounded-3xl p-8 md:p-10 shadow-2xl">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-black text-white tracking-tight">
                {success ? 'Contrasena Actualizada' : 'Nueva Contrasena'}
              </h1>
              <p className="text-slate-500 text-xs font-medium mt-2">
                {success
                  ? 'Redirigiendo al panel de administracion...'
                  : 'Ingresa tu nueva contrasena para continuar'}
              </p>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-xs font-bold mb-6 flex items-start gap-3">
                <span className="text-red-500 shrink-0 mt-0.5">!</span> {error}
              </div>
            )}

            {success ? (
              <div className="flex flex-col items-center py-4 gap-4 animate-in fade-in duration-500">
                <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20">
                  <CheckCircle className="text-emerald-400" size={30} />
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Nueva Contrasena
                  </label>
                  <div className="relative">
                    <Lock
                      size={16}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600"
                    />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-12 pr-5 py-3.5 bg-white/3 border border-white/10 rounded-xl focus:ring-2 focus:ring-cyan-400/20 focus:border-cyan-400/40 outline-none transition-all placeholder:text-slate-700 text-white text-sm font-medium"
                      placeholder="Minimo 6 caracteres"
                      required
                      minLength={6}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-cyan-400 hover:bg-cyan-300 text-[#0a0a0b] font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 text-sm shadow-[0_0_30px_rgba(34,211,238,0.12)]"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="animate-spin" size={18} /> Actualizando...
                    </>
                  ) : (
                    <>
                      Actualizar Contrasena <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
