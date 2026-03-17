'use client';

import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

export default function ZonasMapas() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);

  const municipios = [
    { nombre: 'Soacha', estado: 'Activo', color: 'bg-green-500' },
    { nombre: 'Sibaté', estado: 'Activo', color: 'bg-green-500' },
    { nombre: 'Bogotá (Bosa)', estado: 'Pendiente', color: 'bg-yellow-500' },
  ];

  useEffect(() => {
    // Si no hay token o el contenedor no está listo, detenemos
    if (!MAPBOX_TOKEN || !mapContainer.current) return;
    
    // Si el mapa ya se dibujó, no lo volvemos a dibujar
    if (map.current) return; 

    mapboxgl.accessToken = MAPBOX_TOKEN;
    
    // Creamos el mapa directamente con la herramienta base
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [-74.2189, 4.5824], // Coordenadas de Soacha
      zoom: 12
    });
  }, []);

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Zonas de Operación</h1>
        <p className="text-gray-500">Configura las áreas geográficas donde CarSiGo presta servicio.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Contenedor del Mapa Nativo */}
        <div className="lg:col-span-2 bg-slate-200 rounded-3xl min-h-[400px] border-4 border-white shadow-inner overflow-hidden relative">
          {MAPBOX_TOKEN ? (
            <div ref={mapContainer} className="w-full h-full min-h-[400px]" />
          ) : (
            <div className="flex items-center justify-center h-full bg-slate-100">
              <p className="font-bold text-slate-500">⚠️ Agrega el NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN en tu archivo .env.local</p>
            </div>
          )}
        </div>

        {/* Panel de Municipios Original */}
        <div className="space-y-4">
          <h3 className="font-bold text-gray-800">Municipios Habilitados</h3>
          {municipios.map((m) => (
            <div key={m.nombre} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
              <span className="font-medium text-gray-700">{m.nombre}</span>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${m.color}`}></span>
                <span className="text-xs font-bold text-gray-500">{m.estado}</span>
              </div>
            </div>
          ))}
          <button className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200">
            + Agregar Nueva Zona
          </button>
        </div>
      </div>
    </div>
  );
}