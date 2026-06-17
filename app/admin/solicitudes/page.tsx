'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { CheckCircle, XCircle, FileText, User, Car, Clock, Eye, Search } from 'lucide-react';
import Image from 'next/image';

type DriverApplication = {
  id: string;
  user_id: string;
  status: 'pending' | 'approved' | 'rejected';
  full_name: string;
  id_number: string;
  plate: string;
  brand: string;
  model: string;
  color: string;
  vehicle_type: string;
  cedula_url: string | null;
  selfie_url: string | null;
  tarjeta_propiedad_url: string | null;
  licencia_url: string | null;
  soat_url: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewer_notes: string | null;
};

export default function SolicitudesPage() {
  const supabase = createClient();
  const { role } = useAuth();
  const [applications, setApplications] = useState<DriverApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);

  useEffect(() => {
    fetchApplications();
  }, [filter]);

  async function fetchApplications() {
    setLoading(true);
    let query = supabase
      .from('driver_applications')
      .select('*')
      .order('created_at', { ascending: false });

    if (filter !== 'all') {
      query = query.eq('status', filter);
    }

    const { data, error } = await query;
    if (!error && data) setApplications(data as DriverApplication[]);
    setLoading(false);
  }

  async function handleReview(id: string, status: 'approved' | 'rejected') {
    const { error } = await supabase
      .from('driver_applications')
      .update({
        status,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      alert('Error: ' + error.message);
      return;
    }

    // Si se aprueba, actualizar rol y crear driver_profile
    if (status === 'approved') {
      const app = applications.find(a => a.id === id);
      if (app) {
        await supabase.from('users').update({ role: 'driver' }).eq('id', app.user_id);
        await supabase.from('driver_profiles').upsert({
          user_id: app.user_id,
          vehicle_type: app.vehicle_type,
          plate: app.plate,
          status: 'active',
        });
      }
    }

    fetchApplications();
  }

  const statusBadge = (status: string) => {
    const config = {
      pending: { label: 'Pendiente', color: 'bg-orange-100 text-orange-700 border-orange-200', icon: Clock },
      approved: { label: 'Aprobada', color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle },
      rejected: { label: 'Rechazada', color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle },
    }[status] || { label: status, color: 'bg-gray-100 text-gray-700', icon: Clock };
    const Icon = config.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${config.color}`}>
        <Icon size={12} /> {config.label}
      </span>
    );
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      {/* Encabezado */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Solicitudes de Conductor</h1>
          <p className="text-gray-500 mt-1">Revisa documentos y aprueba o rechaza solicitudes.</p>
        </div>
        <div className="flex bg-white border border-gray-200 rounded-2xl p-1 shadow-sm">
          {(['all', 'pending', 'approved', 'rejected'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                filter === tab
                  ? 'bg-[#00E5FF] text-[#131313] shadow-md scale-105'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {tab === 'all' ? 'Todas' : tab === 'pending' ? 'Pendientes' : tab === 'approved' ? 'Aprobadas' : 'Rechazadas'}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-48 bg-gray-100 rounded-3xl animate-pulse" />
          ))}
        </div>
      ) : applications.length === 0 ? (
        <div className="bg-white rounded-3xl p-20 text-center border border-dashed border-gray-200">
          <FileText size={48} className="mx-auto mb-4 text-gray-200" />
          <h3 className="text-lg font-bold text-gray-400">No hay solicitudes {filter !== 'all' ? filter : ''}</h3>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {applications.map(app => (
            <div key={app.id} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Header */}
              <div className="p-6 border-b border-gray-50 flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 font-black text-lg">
                    {app.full_name?.charAt(0) || 'U'}
                  </div>
                  <div>
                    <h3 className="font-black text-gray-900">{app.full_name}</h3>
                    <p className="text-[11px] text-gray-400 font-medium">CC: {app.id_number}</p>
                  </div>
                </div>
                {statusBadge(app.status)}
              </div>

              {/* Vehículo */}
              <div className="px-6 py-3 bg-gray-50 flex items-center gap-4">
                <div className="flex items-center gap-1.5 text-xs font-bold text-gray-600">
                  <Car size={14} className="text-blue-500" />
                  {app.brand} {app.model} • {app.color}
                </div>
                <span className="text-[10px] font-mono font-bold text-gray-400 uppercase">{app.plate}</span>
                <span className="text-[10px] text-gray-400">{app.vehicle_type}</span>
              </div>

              {/* Documentos */}
              <div className="p-6">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Documentos</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Cédula', url: app.cedula_url },
                    { label: 'Selfie', url: app.selfie_url },
                    { label: 'Tarjeta Prop.', url: app.tarjeta_propiedad_url },
                    { label: 'Licencia', url: app.licencia_url },
                    { label: 'SOAT', url: app.soat_url },
                  ].map(doc => (
                    <button
                      key={doc.label}
                      onClick={() => setSelectedDoc(doc.url)}
                      disabled={!doc.url}
                      className={`text-left px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                        doc.url
                          ? 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                          : 'bg-gray-50 text-gray-300 cursor-not-allowed'
                      }`}
                    >
                      <Eye size={12} />
                      {doc.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Acciones */}
              {app.status === 'pending' && (
                <div className="p-4 border-t border-gray-50 flex gap-3 bg-gray-50/50">
                  <button
                    onClick={() => handleReview(app.id, 'approved')}
                    className="flex-1 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                  >
                    <CheckCircle size={18} /> Aprobar
                  </button>
                  <button
                    onClick={() => handleReview(app.id, 'rejected')}
                    className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                  >
                    <XCircle size={18} /> Rechazar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal de documento */}
      {selectedDoc && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-8" onClick={() => setSelectedDoc(null)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-bold text-gray-900">Documento</h3>
              <button onClick={() => setSelectedDoc(null)} className="p-2 hover:bg-gray-100 rounded-xl">
                <XCircle size={20} className="text-gray-400" />
              </button>
            </div>
            <div className="p-4 flex items-center justify-center bg-gray-100 min-h-[300px]">
              <img
                src={selectedDoc}
                alt="Documento"
                className="max-w-full max-h-[60vh] object-contain rounded-xl"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
