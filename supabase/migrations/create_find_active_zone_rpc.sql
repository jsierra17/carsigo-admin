-- RPC: find_active_zone
-- Usa ST_Contains de PostGIS para determinar en qué zona activa está un punto geográfico.
-- Devuelve la primera zona activa que contiene el punto, o null si no está en ninguna.
CREATE OR REPLACE FUNCTION public.find_active_zone(p_lat NUMERIC, p_lng NUMERIC)
RETURNS TABLE (
  id UUID,
  municipality_name TEXT,
  base_multiplier NUMERIC,
  boundaries JSON
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    g.id,
    g.municipality_name,
    g.base_multiplier,
    ST_AsGeoJSON(g.boundaries)::JSON AS boundaries
  FROM public.geofences g
  WHERE g.is_active = true
    AND ST_Contains(
      g.boundaries,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)
    )
  LIMIT 1;
END;
$$;
