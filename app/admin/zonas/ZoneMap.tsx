'use client';

import { useRef, useEffect } from 'react';
import { MapContainer, TileLayer, GeoJSON, ZoomControl, useMap } from 'react-leaflet';
import type { Feature } from 'geojson';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

type Zona = {
  id: string;
  municipality_name: string;
  is_active: boolean;
  base_multiplier: number;
  boundaries: any;
};

type PreviewZone = {
  name: string;
  geometry: any;
};

function MapController({ mapRef }: { mapRef: React.MutableRefObject<L.Map | null> }) {
  const map = useMap();
  useEffect(() => { mapRef.current = map; }, [map]);
  return null;
}

export default function ZoneMap({
  zonas,
  previewZone,
  mapRef,
}: {
  zonas: Zona[];
  previewZone: PreviewZone | null;
  mapRef: React.MutableRefObject<L.Map | null>;
}) {
  return (
    <MapContainer
      center={[6.247, -75.567]}
      zoom={5}
      className="w-full h-full"
      zoomControl={false}
    >
      <MapController mapRef={mapRef} />
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      <ZoomControl position="topright" />

      {zonas.map((zona) => (
        <GeoJSON
          key={zona.id}
          data={{
            type: 'Feature',
            geometry: zona.boundaries,
            properties: { is_active: zona.is_active },
          } as Feature}
          style={(feature: any) => ({
            fillColor: feature?.properties?.is_active ? '#10b981' : '#ef4444',
            color: feature?.properties?.is_active ? '#059669' : '#b91c1c',
            weight: 2,
            opacity: 0.6,
            fillOpacity: 0.15,
          })}
        />
      ))}

      {previewZone && (
        <GeoJSON
          key="preview"
          data={{
            type: 'Feature',
            geometry: previewZone.geometry,
            properties: {},
          } as Feature}
          style={{
            fillColor: '#3b82f6',
            color: '#2563eb',
            weight: 3,
            opacity: 0.8,
            fillOpacity: 0.3,
            dashArray: '5, 8',
          }}
        />
      )}
    </MapContainer>
  );
}
