'use client';

import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary para el panel admin.
 * Captura errores de renderizado en cualquier componente hijo
 * y muestra una UI de fallback en lugar de una pantalla en blanco.
 */
export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary capturó:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-xl p-10 max-w-md w-full text-center">
            <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-red-100">
              <AlertTriangle size={32} className="text-red-500" />
            </div>
            <h2 className="text-xl font-black text-gray-900 mb-2">
              Error Inesperado
            </h2>
            <p className="text-sm text-gray-500 mb-2">
              Ha ocurrido un problema al cargar esta sección del panel.
            </p>
            {this.state.error && (
              <p className="text-xs text-red-400 font-mono bg-red-50 rounded-xl p-3 mb-6 break-all">
                {this.state.error.message}
              </p>
            )}
            <button
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-xl font-bold text-sm hover:bg-gray-800 transition-all active:scale-[0.98]"
            >
              <RefreshCw size={16} />
              Reintentar
            </button>
            <p className="text-[10px] text-gray-400 mt-4 font-medium">
              Si el problema persiste, contacta al equipo de desarrollo.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
