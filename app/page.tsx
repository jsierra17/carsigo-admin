import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-[#131313] text-white selection:bg-[#00E5FF]/30 overflow-hidden font-sans flex flex-col">

      {/* Elementos Decorativos de Fondo - igual al Login */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[10%] left-[15%] w-96 h-96 bg-[#00E5FF]/5 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[10%] right-[10%] w-[500px] h-[500px] bg-[#00E5FF]/5 rounded-full blur-[150px]"></div>
      </div>

      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 text-center">

        {/* Logotipo Principal CarSiGo (ARRIBA) */}
        <div className="relative w-full max-w-[450px] h-40 mb-10 animate-in fade-in zoom-in duration-1000">
          <Image
            src="/assets/logo.png"
            alt="CarSiGo Admin Logo"
            fill
            className="object-contain"
            priority
          />
        </div>

        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300">
          <h1 className="text-3xl md:text-5xl font-black tracking-tighter leading-tight max-w-2xl mx-auto uppercase text-white">
            Bienvenido a CarSiGo Cada dia mas Ciudad
          </h1>

          <p className="text-slate-400 font-medium text-lg max-w-xl mx-auto">
            Espacio exclusivo para administradores
          </p>

          <div className="pt-10">
            <Link
              href="/login"
              className="group inline-flex items-center gap-4 bg-[#00E5FF] hover:bg-[#00D0E8] text-[#131313] px-12 py-5 rounded-2xl font-black text-xl transition-all shadow-xl hover:scale-[1.05] active:scale-95"
            >
              ACCEDER AL PANEL
              <ArrowRight size={24} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>

        {/* Sub-Logotipo (ABAJO) */}
        <div className="mt-24 opacity-20 animate-in fade-in duration-1000 delay-700">
          <div className="relative w-40 h-14">
            <Image
              src="/assets/sub-logo.png"
              alt="CarSiGo Reference"
              fill
              className="object-contain"
            />
          </div>
        </div>
      </main>

      <footer className="relative z-10 py-10 text-center text-slate-600 text-[9px] font-black uppercase tracking-[0.5em]">
        Operado por CarSiGo Global &copy; 2025
      </footer>
    </div>
  );
}
