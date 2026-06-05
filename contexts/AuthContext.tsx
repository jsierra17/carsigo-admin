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
    async function resolverAuth() {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          setState({ user: null, role: '', isLoading: false });
          router.push('/login');
          return;
        }

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

    resolverAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT') {
          setState({ user: null, role: '', isLoading: false });
          router.push('/login');
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
