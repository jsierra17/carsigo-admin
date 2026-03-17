'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export default function Header() {
  const [adminName, setAdminName] = useState('Administrador');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    getAdminData();
  }, []);

  const getAdminData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // Buscamos el nombre real en nuestra tabla de perfiles
      const { data } = await supabase
        .from('users')
        .select('name')
        .eq('id', user.id)
        .single();
      
      if (data?.name) setAdminName(data.name);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    document.cookie = "carsigo-auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    router.push('/login');
  };

  return (
    <header className="h-20 bg-white border-b border-gray-200 flex items-center justify-between px-8 sticky top-0 z-20">
      <div className="flex items-center gap-4">
        <h2 className="text-gray-500 font-medium">Panel de Control</h2>
      </div>

      <div className="flex items-center gap-6">
        {/* Notificaciones (Por ahora solo el icono) */}
        <button className="relative p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-colors">
          <span className="text-xl">🔔</span>
          {/* Puntito rojo de aviso */}
          <span className="absolute top-1 right-1 w-3 h-3 bg-red-500 border-2 border-white rounded-full"></span>
        </button>

        {/* Perfil del Usuario */}
        <div className="relative">
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="flex items-center gap-3 p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-gray-900 leading-none">{adminName}</p>
              <p className="text-xs text-blue-600 font-medium mt-1">Súper Admin</p>
            </div>
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold shadow-sm">
              {adminName.charAt(0)}
            </div>
          </button>

          {/* Menú Desplegable (Dropdown) */}
          {isMenuOpen && (
            <>
              <div 
                className="fixed inset-0 z-10" 
                onClick={() => setIsMenuOpen(false)}
              ></div>
              <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-xl shadow-xl z-20 py-2">
                <div className="px-4 py-2 border-b border-gray-100 mb-2">
                  <p className="text-xs text-gray-400">Sesión iniciada como</p>
                  <p className="text-sm font-semibold truncate">{adminName}</p>
                </div>
                
                <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                  ⚙️ Mi Perfil
                </button>
                
                <button 
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-sm text-green-600 hover:bg-red-200 font-medium transition-colors border-t border-gray-100 mt-2"
                >
                  Cerrar Sesión
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}