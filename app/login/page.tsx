'use client';

import { useState, useTransition } from 'react';
import { login, resetPassword, signInWithGoogle } from './actions';
import { Mail, Lock, Loader2, ArrowRight, ArrowLeft, CheckCircle, Shield } from 'lucide-react';
import Image from 'next/image';

export default function LoginAdmin() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [modoRecuperar, setModoRecuperar] = useState(false);
  const [emailRecuperar, setEmailRecuperar] = useState('');
  const [recuperacionEnviada, setRecuperacionEnviada] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      try {
        const result = await login(formData);
        if (result?.error) setError(result.error);
      } catch (err: any) {
        setError('Error inesperado al intentar iniciar sesion.');
      }
    });
  };

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

  const handleGoogleSignIn = () => {
    setError(null);
    startTransition(async () => {
      const result = await signInWithGoogle();
      if (result?.error) setError(result.error);
    });
  };

  const resetForm = () => {
    setModoRecuperar(false);
    setRecuperacionEnviada(false);
    setEmailRecuperar('');
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white flex selection:bg-cyan-400/30 font-sans">
      {/* ── Ambient background ─────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 -left-40 w-150 h-150 bg-cyan-500/6 rounded-full blur-3xl" />
        <div className="absolute bottom-0 -right-40 w-125 h-125 bg-blue-600/5 rounded-full blur-3xl" />
      </div>

      {/* ── Grid ───────────────────────────────────────── */}
      <div
        className="fixed inset-0 opacity-[0.02] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      {/* ── Left brand panel ───────────────────────────── */}
      <div className="hidden lg:flex relative z-10 w-120 bg-white/1.5 border-r border-white/5 flex-col items-center justify-center p-12">
        <div className="flex-1 flex flex-col items-center justify-center max-w-sm text-center">
          <div className="relative w-64 h-24 mb-10">
            <Image
              src="/assets/logo.png"
              alt="CarSiGo Logo"
              fill
              sizes="256px"
              className="object-contain"
              priority
            />
          </div>

          <h2 className="text-2xl font-bold text-white mb-3">
            Panel de <span className="text-cyan-400">Administracion</span>
          </h2>
          <p className="text-slate-500 text-sm leading-relaxed">
            Gestiona tu flota, conductores, finanzas y zonas de operacion desde un solo lugar.
          </p>

          <div className="mt-10 w-full space-y-4">
            {[
              { icon: Shield, text: 'Acceso exclusivo para administradores' },
              { icon: Shield, text: 'Conexion segura con Supabase Auth' },
              { icon: Shield, text: 'Monitoreo en tiempo real 24/7' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3 text-slate-500 text-xs">
                <Icon size={14} className="text-cyan-400/60 shrink-0" />
                <span>{text}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-slate-600 text-[10px] font-bold uppercase tracking-[0.3em] mt-auto">
          CarSiGo v2.0
        </p>
      </div>

      {/* ── Right form panel ───────────────────────────── */}
      <div className="relative z-10 flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden relative w-44 h-16 mx-auto mb-8">
            <Image
              src="/assets/sub.png"
              alt="CarSiGo"
              fill
              sizes="176px"
              className="object-contain"
            />
          </div>

          {/* Card */}
          <div className="bg-white/2 backdrop-blur-2xl border border-white/5 rounded-3xl p-8 md:p-10 shadow-2xl">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="hidden lg:block relative w-36 h-14 mx-auto mb-6">
                <Image
                  src="/assets/sub.png"
                  alt="CarSiGo"
                  fill
                  sizes="144px"
                  className="object-contain"
                />
              </div>
              <h1 className="text-2xl font-black text-white tracking-tight">
                {modoRecuperar ? 'Recuperar Acceso' : 'Iniciar Sesion'}
              </h1>
              <p className="text-slate-500 text-xs font-medium mt-2">
                {modoRecuperar
                  ? 'Ingresa tu correo y te enviaremos un enlace'
                  : 'Panel de Gestion y Administracion'}
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-xs font-bold mb-6 flex items-start gap-3 animate-in slide-in-from-top-2">
                <span className="text-red-500 shrink-0 mt-0.5">!</span> {error}
              </div>
            )}

            {/* ── Success state ────────────────────────── */}
            {recuperacionEnviada ? (
              <div className="flex flex-col items-center text-center py-4 gap-5 animate-in fade-in duration-500">
                <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20">
                  <CheckCircle className="text-emerald-400" size={30} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">Correo Enviado</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    Revisa <span className="text-cyan-400 font-semibold">{emailRecuperar}</span> y
                    sigue el enlace para restablecer tu contrasena.
                  </p>
                </div>
                <button
                  onClick={resetForm}
                  className="flex items-center gap-2 text-slate-400 hover:text-white text-sm font-medium transition-colors mt-2"
                >
                  <ArrowLeft size={15} /> Volver al inicio de sesion
                </button>
              </div>
            ) : modoRecuperar ? (
              /* ── Recovery form ──────────────────────── */
              <form onSubmit={handleRecovery} className="space-y-5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Correo Electronico
                  </label>
                  <div className="relative">
                    <Mail
                      size={16}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600"
                    />
                    <input
                      type="email"
                      value={emailRecuperar}
                      onChange={(e) => setEmailRecuperar(e.target.value)}
                      className="w-full pl-12 pr-5 py-3.5 bg-white/3 border border-white/10 rounded-xl focus:ring-2 focus:ring-cyan-400/20 focus:border-cyan-400/40 outline-none transition-all placeholder:text-slate-700 text-white text-sm font-medium"
                      placeholder="admin@carsigo.com"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full bg-cyan-400 hover:bg-cyan-300 text-[#0a0a0b] font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 text-sm"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="animate-spin" size={18} /> Enviando...
                    </>
                  ) : (
                    <>
                      Enviar Instrucciones <ArrowRight size={18} />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => { setModoRecuperar(false); setError(null); }}
                  className="w-full py-2.5 text-slate-500 hover:text-white font-medium text-sm flex items-center justify-center gap-2 transition-colors"
                >
                  <ArrowLeft size={15} /> Cancelar
                </button>
              </form>
            ) : (
              /* ── Login form ─────────────────────────── */
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Correo Electronico
                  </label>
                  <div className="relative">
                    <Mail
                      size={16}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 peer-focus:text-cyan-400 transition-colors"
                    />
                    <input
                      type="email"
                      name="email"
                      className="w-full pl-12 pr-5 py-3.5 bg-white/3 border border-white/10 rounded-xl focus:ring-2 focus:ring-cyan-400/20 focus:border-cyan-400/40 outline-none transition-all placeholder:text-slate-700 text-white text-sm font-medium peer"
                      placeholder="admin@carsigo.com"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Contrasena
                  </label>
                  <div className="relative">
                    <Lock
                      size={16}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600"
                    />
                    <input
                      type="password"
                      name="password"
                      className="w-full pl-12 pr-5 py-3.5 bg-white/3 border border-white/10 rounded-xl focus:ring-2 focus:ring-cyan-400/20 focus:border-cyan-400/40 outline-none transition-all placeholder:text-slate-700 text-white text-sm font-medium"
                      placeholder="••••••••"
                      required
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => { setModoRecuperar(true); setError(null); }}
                    className="text-[11px] font-bold text-slate-500 hover:text-cyan-400 uppercase tracking-wider transition-colors"
                  >
                    Olvidaste tu contrasena?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full bg-cyan-400 hover:bg-cyan-300 text-[#0a0a0b] font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 text-sm shadow-[0_0_30px_rgba(34,211,238,0.12)]"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="animate-spin" size={18} /> Verificando...
                    </>
                  ) : (
                    <>
                      Iniciar Sesion <ArrowRight size={18} />
                    </>
                  )}
                </button>

                <div className="relative my-5">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/8" />
                  </div>
                  <div className="relative flex justify-center text-[10px] font-bold uppercase tracking-wider">
                    <span className="bg-[#0b0b0c] px-3 text-slate-600">o continua con</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isPending}
                  className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium py-3 rounded-xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:opacity-50 text-sm"
                >
                  {isPending ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62Z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z" fill="#EA4335"/>
                    </svg>
                  )}
                  <span>{isPending ? 'Conectando con Google...' : 'Google'}</span>
                </button>
              </form>
            )}
          </div>

          {/* Footer text */}
          <p className="text-center text-slate-600 text-[10px] font-bold uppercase tracking-[0.3em] mt-6">
            CarSiGo Systems &copy; {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
}
