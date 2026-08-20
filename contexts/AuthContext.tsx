'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { createClient, TAB_SESSION_KEY } from '@/lib/firebase/client';

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

const SESSION_TIMEOUT_MINUTES = Number(process.env.NEXT_PUBLIC_SESSION_TIMEOUT_MINUTES) || 30;

export function AuthProvider({ children }: { children: ReactNode }) {
  const db = createClient();
  const router = useRouter();
  const [state, setState] = useState<AuthContextType>({ user: null, role: '', isLoading: true });

  useEffect(() => {
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    let idleResolved = false;

    const clearIdleTimer = () => {
      if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
    };

    const startIdleTimer = () => {
      clearIdleTimer();
      if (idleResolved) {
        idleTimer = setTimeout(cerrarPorInactividad, SESSION_TIMEOUT_MINUTES * 60 * 1000);
      }
    };

    const cerrarPorInactividad = async () => {
      clearIdleTimer();
      idleResolved = false;
      await db.auth.signOut();
      setState({ user: null, role: '', isLoading: false });
      router.push('/login');
    };

    const events: (keyof WindowEventMap)[] = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((ev) => window.addEventListener(ev, startIdleTimer, { passive: true }));

    async function resolverSesionServidor() {
      try {
        const { data: { user } } = await db.auth.getUser();

        if (!user) {
          setState({ user: null, role: '', isLoading: false });
          router.push('/login');
          return;
        }

        // Pestaña nueva (sessionStorage vacío) ⇒ cerrar sesión: la cookie por
        // sí sola sobreviviría al cierre de la pestaña en el navegador.
        let tabOk = true;
        try {
          tabOk = sessionStorage.getItem(TAB_SESSION_KEY) === '1';
        } catch {
          // sessionStorage no disponible: dejar pasar (la cookie de sesión
          // sigue siendo de sesión y se borra al cerrar el navegador).
        }
        if (!tabOk) {
          await db.auth.signOut();
          setState({ user: null, role: '', isLoading: false });
          router.push('/login');
          return;
        }

        // Firmar el SDK del navegador para que las reglas de Firestore
        // (isSignedIn/isAdmin) no denieguen las lecturas/escrituras cliente.
        await db.auth.ensureBrowserSession();

        if (user.email === OWNER_EMAIL) {
          setState({ user, role: 'superadmin', isLoading: false });
          idleResolved = true;
          startIdleTimer();
          return;
        }

        const { data: profile } = await db
          .from('users')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();

        const role = profile?.role || 'admin';
        setState({ user, role, isLoading: false });
        idleResolved = true;
        startIdleTimer();

      } catch (err) {
        console.error('AuthContext: error resolviendo usuario', err);
        setState({ user: null, role: '', isLoading: false });
        router.push('/login');
      }
    }

    resolverSesionServidor();

    const { data: { subscription } } = db.auth.onAuthStateChange(
      async (event: string, session: { user?: { id: string; email: string; user_metadata?: { name?: string | null } } | null } | null) => {
        if (event === 'SIGNED_OUT') {
          // El auth de Firebase del navegador no mantiene sesión (la sesión real
          // vive en la cookie del servidor). Verificar antes de redirigir:
          // solo salir si la cookie tampoco tiene sesión.
          const server = await db.auth.getUser();
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

          const { data: profile } = await db
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
      clearIdleTimer();
      events.forEach((ev) => window.removeEventListener(ev, startIdleTimer));
    };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
