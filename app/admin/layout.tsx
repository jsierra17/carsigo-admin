'use client';

import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { AuthProvider } from "@/contexts/AuthContext";
import { ToastProvider } from "@/contexts/ToastContext";

/**
 * Layout del Panel Admin.
 * El AuthProvider y ToastProvider envuelven TODO el contenido de /admin,
 * resolviendo la autenticación y notificaciones globales una sola vez.
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <ToastProvider>
        <div className="flex w-full min-h-screen bg-gray-50">
          {/* Sidebar: consume AuthContext (sin llamadas propias a Supabase) */}
          <Sidebar />

          <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
            {/* Header: consume AuthContext (sin llamadas propias a Supabase) */}
            <Header />

            {/* Contenido de cada página (Dashboard, Finanzas, Viajes, etc.) */}
            <main className="flex-1 p-6 md:p-8 overflow-auto">
              {children}
            </main>
          </div>
        </div>
      </ToastProvider>
    </AuthProvider>
  );
}