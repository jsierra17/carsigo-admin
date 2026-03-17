'use client';

import { X, CheckCircle, XCircle } from 'lucide-react';
import { Driver } from '@/lib/types';

interface DocumentModalProps {
  driver: Driver | null;
  onClose: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

export default function DocumentModal({ driver, onClose, onApprove, onReject }: DocumentModalProps) {
  if (!driver) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <h2 className="text-xl font-bold text-gray-800">
            Documentos: <span className="text-emerald-600">{driver.name}</span>
          </h2>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1 bg-gray-50/30">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider">Cédula de Ciudadanía</h3>
              <div className="aspect-[1.58/1] bg-gray-200 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center relative overflow-hidden group">
                {/* Mock Image Placeholder */}
                <div className="absolute inset-0 bg-gradient-to-br from-gray-100 to-gray-200" />
                <div className="relative text-center p-4">
                  <div className="w-16 h-16 bg-white rounded-full mx-auto mb-2 flex items-center justify-center shadow-sm">
                    <span className="text-2xl">🪪</span>
                  </div>
                  <p className="text-sm text-gray-500 font-medium">{driver.documents.cedula}</p>
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider">Tarjeta de Propiedad</h3>
              <div className="aspect-[1.58/1] bg-gray-200 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center relative overflow-hidden group">
                {/* Mock Image Placeholder */}
                <div className="absolute inset-0 bg-gradient-to-br from-gray-100 to-gray-200" />
                <div className="relative text-center p-4">
                  <div className="w-16 h-16 bg-white rounded-full mx-auto mb-2 flex items-center justify-center shadow-sm">
                    <span className="text-2xl">📄</span>
                  </div>
                  <p className="text-sm text-gray-500 font-medium">{driver.documents.tarjetaPropiedad}</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-8 bg-blue-50 p-4 rounded-xl border border-blue-100">
            <h4 className="text-sm font-semibold text-blue-800 mb-2">Información del Vehículo</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Vehículo:</span>
                <p className="font-medium text-gray-800">{driver.vehicle}</p>
              </div>
              <div>
                <span className="text-gray-500">Placa:</span>
                <p className="font-medium text-gray-800">{driver.plate}</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="p-5 border-t border-gray-100 bg-white flex items-center justify-end gap-3">
          <button 
            onClick={() => { onReject(driver.id); onClose(); }}
            className="flex items-center px-4 py-2.5 bg-white border-2 border-red-100 text-red-600 rounded-lg hover:bg-red-50 hover:border-red-200 font-medium transition-all"
          >
            <XCircle className="w-4 h-4 mr-2" />
            Rechazar
          </button>
          <button 
            onClick={() => { onApprove(driver.id); onClose(); }}
            className="flex items-center px-6 py-2.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 shadow-sm shadow-emerald-200 font-medium transition-all"
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Aprobar Conductor
          </button>
        </div>
      </div>
    </div>
  );
}
