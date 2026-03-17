'use client';

import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex w-full min-h-screen bg-gray-50">
      {/* El Menú Lateral que ahora aparecerá en TODO /admin */}
      <Sidebar />
      
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        {/* El Cabezal superior */}
        <Header />
        
        {/* Aquí es donde se cargará cada página (Dashboard, Finanzas, etc.) */}
        <main className="flex-1 p-6 md:p-8 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}