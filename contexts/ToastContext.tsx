'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { CheckCircle, AlertCircle, XCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastMessage {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextType {
  success: (msg: string) => void;
  error: (msg: string) => void;
  warning: (msg: string) => void;
  info: (msg: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const success = useCallback((msg: string) => addToast('success', msg), [addToast]);
  const error = useCallback((msg: string) => addToast('error', msg), [addToast]);
  const warning = useCallback((msg: string) => addToast('warning', msg), [addToast]);
  const info = useCallback((msg: string) => addToast('info', msg), [addToast]);

  return (
    <ToastContext.Provider value={{ success, error, warning, info }}>
      {children}
      <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-4 max-w-sm pointer-events-none">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: ToastMessage, onDismiss: () => void }) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => Math.max(0, prev - (100 / 50))); // 5 segundos
    }, 100);
    return () => clearInterval(timer);
  }, []);

  const config: Record<ToastType, { icon: React.ReactNode, color: string, title: string }> = {
    success: { 
      icon: <CheckCircle size={22} className="text-[#00E5FF]" />, 
      color: 'border-[#00E5FF]',
      title: 'Éxito en la Operación'
    },
    error: { 
      icon: <XCircle size={22} className="text-red-500" />, 
      color: 'border-red-500',
      title: 'Error detectado'
    },
    warning: { 
      icon: <AlertCircle size={22} className="text-amber-500" />, 
      color: 'border-amber-500',
      title: 'Atención'
    },
    info: { 
      icon: <Info size={22} className="text-blue-400" />, 
      color: 'border-blue-400',
      title: 'Información'
    },
  };

  const { icon, color, title } = config[toast.type];

  return (
    <div
      className={`pointer-events-auto relative overflow-hidden bg-[#131313]/90 backdrop-blur-xl p-5 rounded-[1.25rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] border-l-4 ${color} animate-in slide-in-from-right-10 duration-500 group cursor-pointer hover:translate-x-[-4px] transition-all`}
      onClick={onDismiss}
    >
      <div className="flex items-start gap-4">
        <div className="p-2 bg-white/5 rounded-xl">
          {icon}
        </div>
        <div className="flex-1 pr-4">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{title}</p>
          <p className="text-sm font-bold text-white leading-relaxed tracking-tight">
            {toast.message}
          </p>
        </div>
        <button className="text-slate-600 hover:text-white transition-colors">
          <X size={18} />
        </button>
      </div>

      {/* Progress Bar */}
      <div 
        className="absolute bottom-0 left-0 h-1 bg-white/10"
        style={{ width: '100%' }}
      >
        <div 
          className="h-full bg-current transition-all duration-100 ease-linear"
          style={{ 
            width: `${progress}%`,
            backgroundColor: toast.type === 'success' ? '#00E5FF' : undefined 
          }}
        ></div>
      </div>
    </div>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
