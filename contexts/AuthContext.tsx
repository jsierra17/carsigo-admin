'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * Estructura del contexto de autenticación compartida.
 * Se resuelve una sola vez al cargar el panel y se cachea en memoria.
 */
type AuthContextType = {
  user: any | null;
  role: string;
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: '',
  isLoading: true,
});

/**
 * Proveedor de AuthContext.
 * Resuelve el usuario y su rol UNA SOLA VEZ al montar el layout de /admin.
 * Todos los componentes hijos (Sidebar, Header, páginas) consumen este contexto
 * sin necesidad de hacer sus propias llamadas a Supabase Auth o la DB.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = createClient();
  const [state, setState] = useState<AuthContextType>({ user: null, role: '', isLoading: true });

  useEffect(() => {
    async function resolverAuth() {
      try {
        // Una sola llamada a getUser() para toda la sesión del panel
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          setState({ user: null, role: '', isLoading: false });
          return;
        }

        // Bypass de seguridad para el propietario del sistema
        if (user.email === 'todoobraparabien1998@gmail.com') {
          setState({ user, role: 'superadmin', isLoading: false });
          return;
        }

        // Una sola consulta a la DB para el rol
        const { data: profile } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();

        const role = profile?.role || user.user_metadata?.role || 'admin';
        setState({ user, role, isLoading: false });

      } catch (err) {
        console.error('AuthContext: error resolviendo usuario', err);
        setState({ user: null, role: 'admin', isLoading: false });
      }
    }

    resolverAuth();
  }, []); // Solo se ejecuta una vez al montar

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

/**
 * Hook para consumir el AuthContext en cualquier componente hijo.
 * Uso: const { user, role, isLoading } = useAuth();
 */
export function useAuth() {
  return useContext(AuthContext);
}
