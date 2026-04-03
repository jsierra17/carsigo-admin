'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Header del Panel Admin.
 * Consume el AuthContext — NO hace llamadas propias a Supabase Auth.
 * Solo conserva la llamada de signOut() para cerrar sesión.
 */
export default function Header() {
  const supabase = createClient();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Datos del usuario desde el contexto global (ya resueltos por AuthProvider)
  const { user, role, isLoading } = useAuth();

  // Nombre a mostrar: primero desde la DB (via metadata) o fallback
  const adminName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'Admin';

  const handleLogout = async () => {
    await supabase.auth.signOut();
    document.cookie = 'carsigo-auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    router.push('/login');
  };

  return (
    <header className="h-20 bg-white border-b border-gray-100 flex items-center justify-between px-8 sticky top-0 z-20 shadow-sm">
      <div className="flex items-center gap-4">
        <h2 className="text-slate-400 font-black uppercase text-[10px] tracking-[0.2em]">Panel de Control CarSiGo</h2>
      </div>

      <div className="flex items-center gap-6">
        {/* Notificaciones */}
        <button className="relative p-2.5 text-slate-400 hover:bg-slate-50 rounded-2xl transition-all">
          <span className="text-xl">🔔</span>
        </button>

        {/* Perfil del Usuario */}
        <div className="relative">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="flex items-center gap-4 p-2 pl-4 hover:bg-slate-50 bg-slate-50/50 border border-gray-100 rounded-2xl transition-all group"
          >
            <div className="text-right hidden sm:block">
              {isLoading ? (
                <div className="w-20 h-4 bg-gray-100 animate-pulse rounded"></div>
              ) : (
                <>
                  <p className="text-sm font-black text-slate-800 leading-none tracking-tight">{adminName}</p>
                  <div className="flex items-center justify-end gap-1.5 mt-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${role === 'superadmin' ? 'bg-[#00E5FF]' : 'bg-emerald-500'}`}></div>
                    <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">{role}</p>
                  </div>
                </>
              )}
            </div>
            <div className="w-10 h-10 bg-[#00E5FF] rounded-xl flex items-center justify-center text-[#131313] font-black shadow-sm group-hover:scale-105 transition-transform">
              {adminName.charAt(0).toUpperCase()}
            </div>
          </button>

          {/* Menú Desplegable */}
          {isMenuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setIsMenuOpen(false)}></div>
              <div className="absolute right-0 mt-3 w-64 bg-white border border-gray-200 rounded-2xl shadow-xl z-20 py-2 animate-in fade-in zoom-in-95 duration-200">
                <div className="px-5 py-4 border-b border-gray-100 mb-2">
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Sesión de Usuario</p>
                  <p className="text-sm font-black text-slate-800 truncate">{adminName}</p>
                </div>
                <div className="px-2">
                  <button className="w-full text-left px-4 py-3 text-sm text-slate-600 hover:bg-slate-50 rounded-xl transition-colors flex items-center gap-3 font-medium">
                    <span>⚙️</span> Mi Perfil
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-3 text-sm text-red-500 hover:bg-red-50 rounded-xl font-bold transition-colors mt-2 flex items-center gap-3"
                  >
                    <span>🚪</span> Cerrar Sesión
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}