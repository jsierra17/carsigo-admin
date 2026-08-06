'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

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

const OWNER_EMAIL = process.env.NEXT_PUBLIC_OWNER_EMAIL || 'todoobraparabien1998@gmail.com';

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = createClient();
  const router = useRouter();
  const [state, setState] = useState<AuthContextType>({ user: null, role: '', isLoading: true });

  useEffect(() => {
    async function resolverSesionServidor() {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          setState({ user: null, role: '', isLoading: false });
          router.push('/login');
          return;
        }

        // Firmar el SDK del navegador para que las reglas de Firestore
        // (isSignedIn/isAdmin) no denieguen las lecturas/escrituras cliente.
        await supabase.auth.ensureBrowserSession();

        if (user.email === OWNER_EMAIL) {
          setState({ user, role: 'superadmin', isLoading: false });
          return;
        }

        const { data: profile } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();

        const role = profile?.role || 'admin';
        setState({ user, role, isLoading: false });

      } catch (err) {
        console.error('AuthContext: error resolviendo usuario', err);
        setState({ user: null, role: '', isLoading: false });
        router.push('/login');
      }
    }

    resolverSesionServidor();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: string, session: { user?: { id: string; email: string; user_metadata?: { name?: string | null } } | null } | null) => {
        if (event === 'SIGNED_OUT') {
          // El auth de Firebase del navegador no mantiene sesión (la sesión real
          // vive en la cookie del servidor). Verificar antes de redirigir:
          // solo salir si la cookie tampoco tiene sesión.
          const server = await supabase.auth.getUser();
          if (!server.data?.user) {
            setState({ user: null, role: '', isLoading: false });
            router.push('/login');
          }
          return;
        }

        if (event === 'TOKEN_REFRESHED' && session?.user) {
          const user = session.user;

          if (user.email === OWNER_EMAIL) {
            setState({ user, role: 'superadmin', isLoading: false });
            return;
          }

          const { data: profile } = await supabase
            .from('users')
            .select('role')
            .eq('id', user.id)
            .maybeSingle();

          setState({ user, role: profile?.role || 'admin', isLoading: false });
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
