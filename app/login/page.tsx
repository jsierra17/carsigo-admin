'use client';

import { useState, useTransition } from 'react';
import { login, resetPassword } from './actions';
import { Mail, Lock, Loader2, ArrowRight, ArrowLeft, CheckCircle } from 'lucide-react';
import Image from 'next/image';

export default function LoginAdmin() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Estado para el flujo de recuperación de contraseña
  const [modoRecuperar, setModoRecuperar] = useState(false);
  const [emailRecuperar, setEmailRecuperar] = useState('');
  const [recuperacionEnviada, setRecuperacionEnviada] = useState(false);

  // ─── Manejador de Login ────────────────────────────────────────────────
  const handleSubmit = async (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const result = await login(formData);
      if (result?.error) {
        setError(result.error);
      }
    });
  };

  // ─── Manejador de Recuperación de Contraseña ───────────────────────────
  const handleRecovery = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailRecuperar.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await resetPassword(emailRecuperar);
      if (result?.error) {
        setError(result.error);
      } else {
        setRecuperacionEnviada(true);
      }
    });
  };

  return (
    <div className="min-h-screen bg-[#131313] text-white flex items-center justify-center p-4 selection:bg-[#00E5FF]/30 font-sans">

      {/* Elementos decorativos de fondo */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[10%] left-[15%] w-96 h-96 bg-[#00E5FF]/5 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[10%] right-[10%] w-[500px] h-[500px] bg-[#00E5FF]/5 rounded-full blur-[150px]"></div>
      </div>

      <div className="relative z-10 w-full max-w-lg animate-in fade-in zoom-in duration-700">
        <div className="bg-white/[0.03] backdrop-blur-3xl border border-white/5 rounded-[2.5rem] shadow-2xl overflow-hidden p-1">

          <div className="p-10 pb-6 text-center">
            <div className="relative w-48 h-20 mx-auto mb-8 hover:scale-105 transition-transform duration-500">
              <Image
                src="/assets/sub-logo.png"
                alt="CarSiGo Logo"
                fill
                className="object-contain"
                priority
              />
            </div>
            <h1 className="text-3xl font-black text-white tracking-tighter uppercase mb-2">
              {modoRecuperar ? 'Recuperar' : 'Acceso'} <span className="text-[#00E5FF]">{modoRecuperar ? 'Acceso' : 'Admin'}</span>
            </h1>
            <p className="text-slate-500 font-bold text-[10px] uppercase tracking-[0.3em]">
              {modoRecuperar ? 'Recibirás un correo para restablecer tu contraseña' : 'Infraestructura de Gestión v2.0'}
            </p>
          </div>

          <div className="px-10 pb-12">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-5 rounded-2xl text-xs font-bold mb-8 flex items-start gap-3 animate-in slide-in-from-top-2">
                <span className="opacity-70">¡ERROR!</span> {error}
              </div>
            )}

            {/* ─── MODO: Recuperación enviada ─────────────────────────── */}
            {recuperacionEnviada ? (
              <div className="flex flex-col items-center text-center py-6 gap-6 animate-in fade-in duration-500">
                <div className="w-20 h-20 bg-emerald-500/10 rounded-3xl flex items-center justify-center border border-emerald-500/20">
                  <CheckCircle className="text-emerald-400" size={36} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white mb-2">¡Correo Enviado!</h3>
                  <p className="text-slate-400 text-sm font-medium leading-relaxed">
                    Revisa tu bandeja de entrada en <span className="text-[#00E5FF] font-bold">{emailRecuperar}</span> y sigue las instrucciones para restablecer tu contraseña.
                  </p>
                </div>
                <button
                  onClick={() => { setModoRecuperar(false); setRecuperacionEnviada(false); setEmailRecuperar(''); }}
                  className="flex items-center gap-2 text-slate-400 hover:text-white text-sm font-bold transition-colors"
                >
                  <ArrowLeft size={16} /> Volver al Login
                </button>
              </div>

            ) : modoRecuperar ? (
              /* ─── MODO: Formulario de Recuperación ─────────────────── */
              <form onSubmit={handleRecovery} className="space-y-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Correo del Administrador</label>
                  <div className="relative group">
                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-[#00E5FF] transition-colors">
                      <Mail size={18} />
                    </div>
                    <input
                      type="email"
                      value={emailRecuperar}
                      onChange={e => setEmailRecuperar(e.target.value)}
                      className="w-full pl-14 pr-6 py-4 bg-white/[0.02] border border-white/5 rounded-2xl focus:ring-4 focus:ring-[#00E5FF]/10 focus:border-[#00E5FF]/30 outline-none transition-all placeholder:text-slate-700 font-bold text-white tracking-tight"
                      placeholder="admin@carsigo.com"
                      required
                    />
                  </div>
                </div>

                <div className="pt-2 space-y-3">
                  <button
                    type="submit"
                    disabled={isPending}
                    className="w-full bg-[#00E5FF] hover:bg-[#00D0E8] text-[#131313] font-black py-5 rounded-2xl shadow-[0_15px_30px_rgba(0,229,255,0.2)] flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:opacity-50 uppercase text-sm tracking-widest"
                  >
                    {isPending ? <><Loader2 className="animate-spin" size={20} /> ENVIANDO...</> : <>ENVIAR INSTRUCCIONES <ArrowRight size={20} className="stroke-[3]" /></>}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setModoRecuperar(false); setError(null); }}
                    className="w-full py-3 text-slate-500 hover:text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors"
                  >
                    <ArrowLeft size={16} /> Volver al Login
                  </button>
                </div>
              </form>

            ) : (
              /* ─── MODO: Login normal ─────────────────────────────────── */
              <form action={handleSubmit} className="space-y-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Correo Electrónico</label>
                  <div className="relative group">
                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-[#00E5FF] transition-colors">
                      <Mail size={18} />
                    </div>
                    <input
                      type="email"
                      name="email"
                      className="w-full pl-14 pr-6 py-4 bg-white/[0.02] border border-white/5 rounded-2xl focus:ring-4 focus:ring-[#00E5FF]/10 focus:border-[#00E5FF]/30 outline-none transition-all placeholder:text-slate-700 font-bold text-white tracking-tight"
                      placeholder="admin@carsigo.com"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Contraseña de Control</label>
                  <div className="relative group">
                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-[#00E5FF] transition-colors">
                      <Lock size={18} />
                    </div>
                    <input
                      type="password"
                      name="password"
                      className="w-full pl-14 pr-6 py-4 bg-white/[0.02] border border-white/5 rounded-2xl focus:ring-4 focus:ring-[#00E5FF]/10 focus:border-[#00E5FF]/30 outline-none transition-all placeholder:text-slate-700 font-bold text-white tracking-tight"
                      placeholder="••••••••"
                      required
                    />
                  </div>
                </div>

                {/* Enlace de recuperación */}
                <div className="text-right -mt-2">
                  <button
                    type="button"
                    onClick={() => { setModoRecuperar(true); setError(null); }}
                    className="text-[10px] font-black text-slate-500 hover:text-[#00E5FF] uppercase tracking-widest transition-colors"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isPending}
                    className="w-full bg-[#00E5FF] hover:bg-[#00D0E8] text-[#131313] font-black py-5 rounded-2xl shadow-[0_15px_30px_rgba(0,229,255,0.2)] flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:opacity-50 uppercase text-sm tracking-widest"
                  >
                    {isPending ? (
                      <><Loader2 className="animate-spin" size={20} />VERIFICANDO...</>
                    ) : (
                      <>IDENTIFICARSE<ArrowRight size={20} className="stroke-[3]" /></>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>

          <div className="bg-black/40 p-8 text-center border-t border-white/5">
            <p className="text-[9px] text-slate-600 font-black uppercase tracking-[0.5em]">
              CarSiGo Systems Architecture &copy; 2026
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}