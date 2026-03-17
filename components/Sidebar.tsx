'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

// Conexión a Supabase para poder cerrar sesión
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  // Definimos todas las rutas de tu plataforma
  const menuItems = [
    { name: 'Dashboard General', path: '/admin', icon: '📊' },
    { name: 'Conductores Pendientes', path: '/admin/conductores', icon: '📋' },
    { name: 'Conductores Activos', path: '/admin/conductores/activos', icon: '🚗' },
    { name: 'Zonas y Mapas', path: '/admin/zonas', icon: '🗺️' },
    { name: 'Finanzas', path: '/admin/finanzas', icon: '💰' },
  ];

  const handleLogout = async () => {
    // 1. Cerramos sesión en Supabase
    await supabase.auth.signOut();
    // 2. Le quitamos la llave al guardia de seguridad (Middleware)
    document.cookie = "carsigo-auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    // 3. Te devolvemos a la pantalla de Login
    router.push('/login');
  };

  return (
    <aside className="w-64 bg-slate-900 text-white hidden md:flex flex-col fixed h-full shadow-2xl z-10">
      {/* Logotipo de CarSiGo */}
      <div className="h-20 flex items-center justify-center border-b border-slate-800">
        <h2 className="text-2xl font-extrabold tracking-wider text-white">
         <span className="text-red-500">Car</span><span className="text-yellow-500">Si</span><span className="text-green-500">Go</span>
        </h2>
      </div>

      {/* Lista de Navegación */}
      <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
        <p className="px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
          Menú Principal
        </p>
        
        {menuItems.map((item) => {
          // Detectamos si esta es la página actual para pintarla de azul
          const isActive = pathname === item.path;
          
          return (
            <Link
              key={item.path}
              href={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                isActive 
                  ? 'bg-green-600 text-white shadow-md shadow-green-900/20' 
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="font-medium">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Botón de Cerrar Sesión al fondo */}
      <div className="p-4 border-slate-800">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all duration-200"
        >
          <span className="text-xl">🚪</span>
        </button>
      </div>
    </aside>
  );
}