import { Loader2 } from 'lucide-react';

/**
 * Fallback de carga mostrado mientras se resuelve el layout del panel admin.
 * Usa el mismo diseño del panel (sidebar + área principal) para evitar
 * saltos visuales durante la carga inicial.
 */
export default function AdminLoading() {
  return (
    <div className="flex w-full min-h-screen bg-gray-50">
      {/* Sidebar skeleton */}
      <aside className="w-64 bg-white hidden md:flex flex-col fixed h-full border-r border-gray-200 z-10">
        <div className="h-24 bg-black animate-pulse" />
        <div className="flex-1 px-4 py-8 space-y-3">
          <div className="h-3 w-24 bg-gray-100 rounded mb-6 animate-pulse" />
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 bg-gray-50 rounded-2xl animate-pulse" />
          ))}
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        {/* Header skeleton */}
        <header className="bg-white border-b border-gray-100 h-16 flex items-center justify-between px-8">
          <div className="h-4 w-32 bg-gray-100 rounded animate-pulse" />
          <div className="flex items-center gap-4">
            <div className="h-4 w-20 bg-gray-100 rounded animate-pulse" />
            <div className="w-10 h-10 bg-gray-100 rounded-full animate-pulse" />
          </div>
        </header>

        {/* Content loading */}
        <main className="flex-1 p-6 md:p-8 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 size={40} className="animate-spin text-gray-300" />
            <p className="text-sm font-medium text-gray-400">
              Cargando panel de administración...
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
