import 'dart:convert';
import 'dart:math';
import 'package:flutter/foundation.dart';
import '../services/supabase_service.dart';
import '../services/location_service.dart';

class ZoneInfo {
  final String id;
  final String municipalityName;
  final double baseMultiplier;
  final List<List<List<double>>> polygons;

  ZoneInfo({
    required this.id,
    required this.municipalityName,
    required this.baseMultiplier,
    this.polygons = const [],
  });
}

class ZoneService {
  final _supabase = SupabaseService.client;

  Future<ZoneInfo?> findActiveZone(double lat, double lng) async {
    // LAYER 1: PostGIS ST_Contains (RPC) — la más precisa, server-side
    final fromRpc = await _findByPostGis(lat, lng);
    if (fromRpc != null) return fromRpc;

    // LAYER 2: Mapbox reverse geocoding — match por nombre de municipio
    final fromMapbox = await _findByMapboxName(lat, lng);
    if (fromMapbox != null) return fromMapbox;

    // LAYER 3: Client-side point-in-polygon — último recurso
    return _findByClientSide(lat, lng);
  }

  Future<ZoneInfo?> _findByPostGis(double lat, double lng) async {
    try {
      final result = await _supabase.rpc('find_active_zone', params: {
        'p_lat': lat,
        'p_lng': lng,
      });

      if (result != null && result is List && result.isNotEmpty) {
        final z = result[0] as Map;
        final boundariesJson = z['boundaries'];
        final polygons = _extractPolygons(boundariesJson);
        debugPrint('ZONE_LAYER1_POSTGIS: found ${z['municipality_name']} at ($lat,$lng)');
        return ZoneInfo(
          id: z['id'],
          municipalityName: z['municipality_name'] ?? '',
          baseMultiplier: (z['base_multiplier'] as num?)?.toDouble() ?? 1.0,
          polygons: polygons,
        );
      }
    } catch (e) {
      debugPrint('ZONE_LAYER1_ERROR: $e');
    }
    return null;
  }

  Future<ZoneInfo?> _findByMapboxName(double lat, double lng) async {
    try {
      final municipalityName = await LocationService.getMunicipalityName(lat, lng);
      if (municipalityName == null || municipalityName.isEmpty) return null;

      final zones = await _fetchActiveZones();
      final lower = municipalityName.toLowerCase();

      for (final z in zones) {
        final zLower = z.municipalityName.toLowerCase();
        if (zLower.contains(lower) || lower.contains(zLower)) {
          debugPrint('ZONE_LAYER2_MAPBOX: matched ${z.municipalityName} via "$municipalityName"');
          return z;
        }
      }
    } catch (e) {
      debugPrint('ZONE_LAYER2_ERROR: $e');
    }
    return null;
  }

  Future<ZoneInfo?> _findByClientSide(double lat, double lng) async {
    try {
      final data = await _supabase
          .from('geofences')
          .select('id, municipality_name, boundaries, base_multiplier')
          .eq('is_active', true);

      for (final z in data as List) {
        final geoJson = z['boundaries'];
        final polygons = _extractPolygons(geoJson);
        if (_pointInMultiPolygon(lat, lng, polygons)) {
          debugPrint('ZONE_LAYER3_CLIENT: found ${z['municipality_name']} at ($lat,$lng)');
          return ZoneInfo(
            id: z['id'],
            municipalityName: z['municipality_name'] ?? '',
            baseMultiplier: (z['base_multiplier'] as num?)?.toDouble() ?? 1.0,
            polygons: polygons,
          );
        }
      }
    } catch (e) {
      debugPrint('ZONE_LAYER3_ERROR: $e');
    }
    return null;
  }

  Future<List<ZoneInfo>> _fetchActiveZones() async {
    final data = await _supabase
        .from('geofences')
        .select('id, municipality_name, base_multiplier')
        .eq('is_active', true);

    return (data as List).map((z) => ZoneInfo(
      id: z['id'],
      municipalityName: z['municipality_name'] ?? '',
      baseMultiplier: (z['base_multiplier'] as num?)?.toDouble() ?? 1.0,
    )).toList();
  }

  List<List<List<double>>> _extractPolygons(dynamic geoJson) {
    final result = <List<List<double>>>[];

    if (geoJson is String) {
      try { geoJson = jsonDecode(geoJson); } catch (_) { return result; }
    }
    if (geoJson is! Map) return result;

    final type = geoJson['type'] as String? ?? '';

    if (type == 'Polygon') {
      final coords = geoJson['coordinates'] as List? ?? [];
      for (final ring in coords) {
        result.add(_ringToList(ring));
      }
    } else if (type == 'MultiPolygon') {
      final coords = geoJson['coordinates'] as List? ?? [];
      for (final polygon in coords) {
        for (final ring in polygon as List) {
          result.add(_ringToList(ring));
        }
      }
    }

    return result;
  }

  List<List<double>> _ringToList(dynamic ring) {
    return (ring as List).map((c) {
      if (c is List && c.length >= 2) {
        return [(c[1] as num).toDouble(), (c[0] as num).toDouble()];
      }
      return [0.0, 0.0];
    }).toList();
  }

  bool _pointInMultiPolygon(double lat, double lng, List<List<List<double>>> polygons) {
    for (final polygon in polygons) {
      if (_pointInPolygon(lat, lng, polygon)) return true;
    }
    return false;
  }

  bool _pointInPolygon(double testLat, double testLng, List<List<double>> ring) {
    bool inside = false;
    int j = ring.length - 1;
    for (int i = 0; i < ring.length; i++) {
      final xi = ring[i][0];
      final yi = ring[i][1];
      final xj = ring[j][0];
      final yj = ring[j][1];
      if ((yi > testLng) != (yj > testLng)) {
        final xIntersect = xi + (xj - xi) * (testLng - yi) / (yj - yi);
        if (testLat < xIntersect) inside = !inside;
      }
      j = i;
    }
    return inside;
  }

  double distanceKm(double lat1, double lng1, double lat2, double lng2) {
    const R = 6371;
    final dLat = _toRad(lat2 - lat1);
    final dLng = _toRad(lng2 - lng1);
    final a = sin(dLat / 2) * sin(dLat / 2) +
        cos(_toRad(lat1)) * cos(_toRad(lat2)) * sin(dLng / 2) * sin(dLng / 2);
    return R * 2 * atan2(sqrt(a), sqrt(1 - a));
  }

  double _toRad(double d) => d * pi / 180;
}