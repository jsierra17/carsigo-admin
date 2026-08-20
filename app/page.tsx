import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-[#131313] text-white selection:bg-[#00E5FF]/30 font-sans flex flex-col items-center justify-center px-6 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[10%] left-[15%] w-96 h-96 bg-[#00E5FF]/5 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[10%] right-[10%] w-[500px] h-[500px] bg-[#00E5FF]/5 rounded-full blur-[150px]"></div>
      </div>

      <main className="relative z-10 flex flex-col items-center text-center">
        <div className="relative w-full max-w-[380px] h-32 mb-10 animate-in fade-in zoom-in duration-700">
          <Image
            src="/assets/logo.png"
            alt="CarSiGo Admin Logo"
            fill
            className="object-contain"
            priority
          />
        </div>

        <h1 className="text-2xl md:text-4xl font-black tracking-tighter leading-tight max-w-xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
          Bienvenido al Panel Administrativo CarSiGo
        </h1>

        <p className="text-slate-400 font-medium text-sm md:text-base mt-4 animate-in fade-in duration-700 delay-300">
          Acceso restringido para administradores.
        </p>

        <div className="pt-10 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-400">
          <Link
            href="/login"
            className="inline-flex items-center gap-3 bg-[#00E5FF] hover:bg-[#00D0E8] text-[#131313] px-10 py-4 rounded-2xl font-black text-base md:text-lg transition-all shadow-xl hover:scale-[1.03] active:scale-95"
          >
            Iniciar Sesión
            <ArrowRight size={20} className="transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </main>

      <footer className="relative z-10 py-8 text-center text-slate-600 text-[9px] font-black uppercase tracking-[0.5em] absolute bottom-0 inset-x-0">
        CarSiGo Global &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}