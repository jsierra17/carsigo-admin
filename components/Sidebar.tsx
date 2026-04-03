'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';

const menuItems = [
  { name: 'Dashboard', path: '/admin', icon: '📊', roles: ['admin', 'superadmin'] },
  { name: 'Viajes', path: '/admin/viajes', icon: '🚗', roles: ['admin', 'superadmin'] },
  { name: 'Conductores', path: '/admin/conductores', icon: '👥', roles: ['admin', 'superadmin'] },
  { name: 'Zonas', path: '/admin/zonas', icon: '📍', roles: ['superadmin'] },
  { name: 'Finanzas', path: '/admin/finanzas', icon: '💰', roles: ['superadmin'] },
  { name: 'Administradores', path: '/admin/administradores', icon: '🛡️', roles: ['superadmin'] },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { role, isLoading } = useAuth();

  return (
    <aside className="w-64 bg-white text-slate-800 hidden md:flex flex-col fixed h-full border-r border-gray-200 shadow-sm z-10 font-sans">
      <div className="h-24 bg-black flex flex-col items-center justify-center px-6">
        <div className="relative w-full h-24">
          <Image
            src="/assets/logo.png"
            alt="CarSiGo Logo"
            fill
            className="object-contain"
            priority
          />
        </div>
      </div>

      <nav className="flex-1 px-4 py-8 space-y-2 overflow-y-auto">
        <p className="px-3 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6">
          SISTEMA CARSIGO
        </p>

        {/* Mientras carga el contexto, muestra esqueleto del menú */}
        {isLoading ? (
          <div className="space-y-2 animate-pulse px-2">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-12 bg-slate-100 rounded-2xl"></div>
            ))}
          </div>
        ) : (
          menuItems
            .filter(item => role ? item.roles.includes(role) : false)
            .map((item) => {
              const isActive = pathname === item.path;
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  prefetch={true}
                  className={`flex items-center gap-3 px-4 py-4 rounded-2xl transition-all duration-300 ${isActive
                    ? 'bg-[#00E5FF]/10 text-[#00606b] shadow-sm border border-[#00E5FF]/20'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                >
                  <span className="text-xl opacity-80">{item.icon}</span>
                  <span className="font-black text-[11px] uppercase tracking-wider">{item.name}</span>
                </Link>
              );
            })
        )}
      </nav>

      <div className="p-6 border-t border-gray-100 bg-slate-50 flex flex-col items-center gap-6">
        <div className="w-full">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">AUTENTICACIÓN</p>
          <div className="flex items-center gap-2.5">
            <div className={`w-2 h-2 rounded-full ${role === 'superadmin' ? 'bg-[#00E5FF] shadow-[0_0_10px_rgba(0,229,255,0.3)]' : 'bg-emerald-500'}`}></div>
            <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest">
              {isLoading ? '...' : (role || 'admin')}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}