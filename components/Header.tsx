import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Header del Panel Admin.
 */
export default function Header() {
  const supabase = createClient();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const { user, role, isLoading } = useAuth();

  const adminName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'Admin';

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <header className="bg-white border-b border-gray-100 h-16 flex items-center justify-between px-8 sticky top-0 z-30">
      <div className="flex items-center gap-4">
        <h2 className="text-gray-400 font-medium text-sm">Panel de Control</h2>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex flex-col items-end">
          <span className="text-sm font-bold text-gray-900">{adminName}</span>
          <span className="text-[10px] font-black text-blue-600 uppercase tracking-tighter bg-blue-50 px-2 py-0.5 rounded">
            {role}
          </span>
        </div>

        <div className="relative">
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors overflow-hidden border-2 border-white shadow-sm"
          >
            <span className="text-gray-500 font-bold text-xs">{adminName.charAt(0)}</span>
          </button>

          {isMenuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-2 animate-in fade-in slide-in-from-top-2">
              <button 
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 text-sm text-red-600 font-bold hover:bg-red-50 transition-colors"
              >
                Cerrar Sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
