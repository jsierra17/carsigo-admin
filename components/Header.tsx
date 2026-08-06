'use client';

import { useState, useRef, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { LogOut, ChevronDown } from 'lucide-react';

/**
 * Header del Panel Admin.
 */
export default function Header() {
  const supabase = createClient();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const { user, role, isLoading } = useAuth();

  const adminName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'Admin';

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const roleLabel = { superadmin: 'Super Admin', admin: 'Admin' }[role as string] || role || 'Admin';

  return (
    <header className="bg-[#0b0b0d]/90 backdrop-blur-xl border-b border-white/5 h-16 flex items-center justify-between px-6 md:px-8 sticky top-0 z-30">
      <div className="flex items-center gap-4">
        <div className="w-2 h-2 rounded-full bg-[#00E5FF] shadow-[0_0_10px_rgba(0,229,255,0.5)]" aria-hidden="true" />
        <h2 className="text-slate-400 font-medium text-sm">Panel de Control</h2>
      </div>

      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-haspopup="menu"
          aria-expanded={isMenuOpen}
          aria-label="Menú de usuario"
          className="flex items-center gap-3 py-1.5 pl-1.5 pr-3 rounded-full hover:bg-white/5 transition-colors focus-visible:ring-2 focus-visible:ring-[#00E5FF]/60"
        >
          <span className="flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-[#00E5FF]/30 to-[#0080ff]/20 text-[#00E5FF] font-black text-sm border border-white/10">
            {adminName.charAt(0)}
          </span>
          <span className="hidden sm:flex flex-col items-start">
            <span className="text-sm font-bold text-white leading-tight max-w-[160px] truncate">{adminName}</span>
            <span className="text-[10px] font-black text-[#00E5FF] uppercase tracking-tight leading-tight">{roleLabel}</span>
          </span>
          <ChevronDown size={14} className={`text-slate-500 transition-transform duration-200 ${isMenuOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>

        {isMenuOpen && (
          <div
            role="menu"
            aria-label="Acciones de usuario"
            className="absolute right-0 mt-2 w-56 bg-[#141416] rounded-2xl shadow-2xl border border-white/10 py-2 animate-in fade-in slide-in-from-top-2 overflow-hidden"
          >
            {isLoading ? null : (
              <div className="px-4 py-2 border-b border-white/5">
                <p className="text-xs font-bold text-slate-200 truncate">{adminName}</p>
                <p className="text-[10px] text-slate-500">{user?.email}</p>
              </div>
            )}
            <button
              role="menuitem"
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 font-semibold hover:bg-red-500/10 transition-colors"
            >
              <LogOut size={15} aria-hidden="true" /> Cerrar sesión
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
