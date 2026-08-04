'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { MapPin, Power, PowerOff, Search, Loader2, Save, Globe, Navigation, Layers, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { createGeofence, deleteGeofence, toggleGeofenceStatus, searchMunicipality } from './actions';
import { useToast } from '@/contexts/ToastContext';
import dynamic from 'next/dynamic';
import type { Geometry } from 'geojson';

const ZoneMap = dynamic(() => import('./ZoneMap'), { ssr: false });

type Zona = {
  id: string;
  municipality_name: string;
  is_active: boolean;
  base_multiplier: number;
  boundaries: Geometry;
};

type NominatimResult = {
  display_name: string;
  geojson: Geometry;
  boundingbox: [string, string, string, string];
  type: string;
  class: string;
};

type PreviewZone = {
  name: string;
  geometry: Geometry;
};

export default function ZonasPage() {
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([]);
  const [previewZone, setPreviewZone] = useState<PreviewZone | null>(null);
  const [selectedResultIndex, setSelectedResultIndex] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const mapRef = useRef<any>(null);
  const toast = useToast();

  const fetchZonas = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('geofences')
        .select('id, municipality_name, is_active, base_multiplier, boundaries')
        .order('municipality_name', { ascending: true });

      if (error) throw error;
      setZonas(data || []);
    } catch (error) {
      console.error('Error fetching zonas:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchZonas();
  }, [fetchZonas]);

  const selectResult = (results: NominatimResult[], index: number) => {
    const match = results[index];
    if (!match) return;
    setSelectedResultIndex(index);
    setPreviewZone({
      name: match.display_name.split(',')[0],
      geometry: match.geojson
    });
    const [latMin, latMax, lonMin, lonMax] = match.boundingbox.map(parseFloat);
    const center: [number, number] = [(latMin + latMax) / 2, (lonMin + lonMax) / 2];
    if (mapRef.current) {
      mapRef.current.setView(center, 11);
    }
  };

  const handleSearchMunicipality = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchResults([]);
    setPreviewZone(null);
    setSelectedResultIndex(null);

    try {
      const { data, success, error, message } = await searchMunicipality(searchQuery);

      if (!success || error) {
        toast.error(error || 'Ocurrió un error en la búsqueda.');
        return;
      }

      if (message) {
        toast.info(message);
        return;
      }

      if (data && data.length > 0) {
        setSearchResults(data);
        selectResult(data, 0);
      }
    } catch (err) {
      console.error("Error en búsqueda:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleCreateZone = async () => {
    if (!previewZone) return;
    setIsSaving(true);
    try {
      await createGeofence({
        municipality_name: previewZone.name,
        boundaries: previewZone.geometry,
        is_active: true,
        base_multiplier: 1.0
      });
      toast.success(`¡Zona habilitada con éxito: ${previewZone.name}!`);
      setPreviewZone(null);
      setSearchQuery('');
      fetchZonas();
    } catch (error) {
      toast.error('Error al guardar la zona.');
      console.error('Error al guardar zona:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Estás seguro de eliminar el área habilitada para ${name}?`)) return;
    try {
      await deleteGeofence(id);
      toast.success(`Zona eliminada: ${name}`);
      fetchZonas();
    } catch (error) {
      toast.error('No se pudo eliminar la zona.');
      console.error('Error al eliminar:', error);
    }
  };

  const handleToggleStatus = async (id: string, current: boolean) => {
    try {
      await toggleGeofenceStatus(id, current);
      toast.info(`Estado de zona actualizado.`);
      fetchZonas();
    } catch (error) {
      toast.error('No se pudo cambiar el estado de la zona.');
      console.error('Error al cambiar estado:', error);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20 font-sans">

      {/* Encabezado Zonas Light */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg border border-blue-100 shadow-sm">
              <Globe size={20} />
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter">Geo-Cercas y Cobertura</h1>
          </div>
          <p className="text-slate-500 font-medium">Control geográfico inteligente. Busca municipios para habilitarlos en la red CarSiGo.</p>
        </div>
      </div>

      {/* Buscador de Municipios Light */}
      <div className="bg-white border border-gray-100 p-6 rounded-[2.5rem] shadow-sm">
        <form onSubmit={handleSearchMunicipality} className="flex flex-col md:flex-row gap-4 items-center">
          <div className="flex-1 w-full relative group">
            <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-500 transition-colors">
              <Search size={22} />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-14 pr-8 py-5 bg-slate-50/50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500/30 outline-none font-bold text-slate-800 transition-all placeholder:text-slate-400"
              placeholder="Ej: Cartagena, Montería, Sincelejo..."
            />
          </div>
          <button
            type="submit"
            disabled={isSearching}
            className="w-full md:w-auto px-8 py-5 bg-[#00E5FF] hover:bg-[#00D0E8] text-[#131313] rounded-2xl font-black uppercase tracking-widest transition-all shadow-md flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
          >
            {isSearching ? <Loader2 className="animate-spin" size={20} /> : <Navigation size={20} />}
            Buscar Ciudad
          </button>
        </form>

        {searchResults.length > 0 && (
          <div className="mt-6 space-y-4 animate-in slide-in-from-top-4 duration-300">
            {/* Lista de resultados */}
            <div className="flex gap-3 overflow-x-auto pb-2">
              {searchResults.map((result, idx) => {
                const selected = selectedResultIndex === idx;
                const areaKm2 = result.boundingbox
                  ? ((parseFloat(result.boundingbox[3]) - parseFloat(result.boundingbox[2])) *
                     (parseFloat(result.boundingbox[1]) - parseFloat(result.boundingbox[0])) * 111 * 111).toFixed(0)
                  : '?';
                return (
                  <button
                    key={idx}
                    onClick={() => selectResult(searchResults, idx)}
                    className={`flex-shrink-0 p-4 rounded-2xl border-2 text-left transition-all ${
                      selected
                        ? 'bg-emerald-50 border-emerald-400 shadow-md'
                        : 'bg-white border-gray-100 hover:border-blue-200 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-2 h-2 rounded-full ${selected ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                      <span className="text-[10px] font-black text-slate-400 uppercase">{result.type || result.class}</span>
                    </div>
                    <p className="font-black text-slate-800 text-sm leading-tight">{result.display_name.split(',')[0]}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{areaKm2} km² aprox.</p>
                  </button>
                );
              })}
            </div>

            {/* Botón Habilitar */}
            {previewZone && (
              <div className="p-6 bg-emerald-50 border border-emerald-100 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-emerald-600 shadow-sm border border-emerald-100">
                    <Navigation size={24} className="animate-pulse" />
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Área Seleccionada</p>
                    <h4 className="text-xl font-black text-slate-800 tracking-tight">{previewZone.name}</h4>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => { setSearchResults([]); setPreviewZone(null); setSelectedResultIndex(null); }}
                    className="px-6 py-4 text-slate-400 font-bold hover:text-slate-600"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleCreateZone}
                    disabled={isSaving}
                    className="px-8 py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest transition-all shadow-lg flex items-center gap-3"
                  >
                    {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                    Habilitar Zona
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* Listado de Zonas Activas Light */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white border border-gray-100 rounded-[2.5rem] p-6 shadow-sm h-[650px] flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-black text-slate-900 tracking-tight uppercase">Cobertura</h3>
              <span className="px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-black rounded-lg border border-blue-100">{zonas.length}</span>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-3">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-16 bg-slate-50 rounded-2xl animate-pulse"></div>
                ))
              ) : zonas.length === 0 ? (
                <div className="text-center py-20 opacity-20">
                  <MapPin className="mx-auto mb-3" size={32} />
                  <p className="text-[10px] font-black uppercase tracking-widest">Sin zonas activas</p>
                </div>
              ) : (
                zonas.map((zona) => (
                  <div key={zona.id} className="group p-4 bg-slate-50/50 hover:bg-white border border-transparent hover:border-blue-100 rounded-2xl transition-all flex flex-col gap-3 shadow-sm hover:shadow-md">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2">
                          <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${zona.is_active ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                          <span className="font-black text-slate-800 text-[12px] leading-tight break-words pr-2">
                            {zona.municipality_name}
                          </span>
                        </div>
                        <span className="text-[9px] font-black text-slate-400 mt-1 uppercase block ml-4">
                          Tarifa Base: {zona.base_multiplier}x
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 pt-0.5">
                        <button
                          onClick={() => handleToggleStatus(zona.id, zona.is_active)}
                          className={`p-2 rounded-xl transition-all ${zona.is_active ? 'text-amber-600 bg-amber-50 hover:bg-amber-100' : 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100'}`}
                          title={zona.is_active ? 'Desactivar Cobertura' : 'Activar Cobertura'}
                        >
                          {zona.is_active ? <PowerOff size={16} /> : <Power size={16} />}
                        </button>
                        <button
                          onClick={() => handleDelete(zona.id, zona.municipality_name)}
                          className="p-2 text-red-500 bg-red-50 hover:bg-red-100 rounded-xl transition-all"
                          title="Eliminar Zona Permanentemente"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Mapa con Leaflet (sin WebGL) */}
        <div className="lg:col-span-8 h-[650px] bg-white rounded-[3rem] overflow-hidden border border-gray-100 shadow-xl relative">
          <ZoneMap zonas={zonas} previewZone={previewZone} mapRef={mapRef} />
          <div className="absolute top-6 left-6 z-[1000]">
            <div className="bg-white/80 backdrop-blur-md p-3 rounded-2xl border border-gray-200 flex items-center gap-3 shadow-sm pointer-events-none">
              <Layers className="text-blue-500" size={18} />
              <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Capa Vectorial CarSiGo</span>
            </div>
          </div>

          <div className="absolute top-6 left-6">
            <div className="bg-white/80 backdrop-blur-md p-3 rounded-2xl border border-gray-200 flex items-center gap-3 shadow-sm">
              <Layers className="text-blue-500" size={18} />
              <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Capa Vectorial CarSiGo</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}