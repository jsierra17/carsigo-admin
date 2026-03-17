'use client';

import { X, Map, CheckCircle } from 'lucide-react';

interface NewZoneModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function NewZoneModal({ isOpen, onClose, onSubmit }: NewZoneModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <h2 className="text-xl font-bold text-gray-800 flex items-center">
            <Map className="w-5 h-5 mr-2 text-emerald-500" />
            Desbloquear Municipio
          </h2>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={onSubmit} className="p-6">
          <p className="text-sm text-gray-600 mb-6">
            Completa la información para habilitar operaciones en una nueva zona o municipio.
          </p>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="zoneName" className="block text-sm font-medium text-gray-700 mb-1">Nombre del Municipio/Zona</label>
              <input 
                type="text" 
                id="zoneName" 
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors cursor-text" 
                placeholder="Ej. Envigado, Sabaneta..." 
              />
            </div>
            
            <div>
              <label htmlFor="zoneDesc" className="block text-sm font-medium text-gray-700 mb-1">Descripción (Opcional)</label>
              <textarea 
                id="zoneDesc" 
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors resize-none cursor-text" 
                placeholder="Detalles sobre esta zona..." 
              />
            </div>
            
            <div className="flex items-center mt-2">
              <input 
                type="checkbox" 
                id="activeStatus" 
                defaultChecked
                className="h-4 w-4 text-emerald-600 focus:ring-2 focus:ring-emerald-500/50 border-gray-300 rounded cursor-pointer accent-emerald-500"
              />
              <label htmlFor="activeStatus" className="ml-2 block text-sm text-gray-700 cursor-pointer select-none">
                Activar inmediatamente
              </label>
            </div>
          </div>
          
          <div className="mt-8 flex gap-3">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              className="flex-1 flex items-center justify-center px-4 py-2.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 shadow-sm shadow-emerald-200 font-medium transition-all cursor-pointer"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
