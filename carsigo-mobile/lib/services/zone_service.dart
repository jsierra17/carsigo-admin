import 'dart:math';
import 'package:flutter/foundation.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../services/location_service.dart';

const double _adjacentRadiusKm = 28;

class ZoneInfo {
  final String id;
  final String municipalityName;
  final double baseMultiplier;
  final List<List<List<double>>> polygons;

  /// Radio del casco urbano (km) desde el centro urbano de la zona.
  /// Configurable en Firestore con `urban_radius_km`; por defecto 2.5 km
  /// (El Carmen de Bolívar: casco urbano + alrededores cercanos, sin rural).
  final double urbanRadiusKm;

  /// Centro real del casco urbano: viene de `center_lat`/`center_lng` de
  /// Firestore si existen; si no, de un municipio conocido; si no, se usa el
  /// centroide del polígono (poco fiable en municipios con zona rural amplia).
  final double? urbanCenterLat;
  final double? urbanCenterLng;

  late final double minLat;
  late final double maxLat;
  late final double minLng;
  late final double maxLng;
  late final double centerLat;
  late final double centerLng;

  ZoneInfo({
    required this.id,
    required this.municipalityName,
    required this.baseMultiplier,
    this.polygons = const [],
    this.urbanRadiusKm = 2.5,
    this.urbanCenterLat,
    this.urbanCenterLng,
  }) {
    _computeBounds();
  }

  void _computeBounds() {
    double loLat = double.infinity, hiLat = double.negativeInfinity;
    double loLng = double.infinity, hiLng = double.negativeInfinity;
    double sumLat = 0, sumLng = 0;
    int count = 0;
    for (final ring in polygons) {
      for (final pt in ring) {
        loLat = min(loLat, pt[0]);
        hiLat = max(hiLat, pt[0]);
        loLng = min(loLng, pt[1]);
        hiLng = max(hiLng, pt[1]);
        sumLat += pt[0];
        sumLng += pt[1];
        count++;
      }
    }
    minLat = loLat;
    maxLat = hiLat;
    minLng = loLng;
    maxLng = hiLng;
    centerLat = count > 0 ? sumLat / count : 0;
    centerLng = count > 0 ? sumLng / count : 0;
  }

  bool contains(double lat, double lng) {
    for (final polygon in polygons) {
      if (_pointInPolygon(lat, lng, polygon)) return true;
    }
    return false;
  }

  /// ¿Está el punto dentro del casco urbano (radio) de esta zona?
  bool containsUrban(double lat, double lng) {
    final clat = urbanCenterLat ?? centerLat;
    final clng = urbanCenterLng ?? centerLng;
    return distanceToKm(lat, lng, clat, clng) <= urbanRadiusKm;
  }

  static double distanceToKm(double lat1, double lng1, double lat2, double lng2) {
    const R = 6371;
    final dLat = (lat2 - lat1) * pi / 180;
    final dLng = (lng2 - lng1) * pi / 180;
    final a = sin(dLat / 2) * sin(dLat / 2) +
        cos(lat1 * pi / 180) * cos(lat2 * pi / 180) *
            sin(dLng / 2) * sin(dLng / 2);
    return R * 2 * atan2(sqrt(a), sqrt(1 - a));
  }

  double distanceCenterKm(double lat, double lng) {
    const R = 6371;
    final dLat = (lat - centerLat) * pi / 180;
    final dLng = (lng - centerLng) * pi / 180;
    final a = sin(dLat / 2) * sin(dLat / 2) +
        cos(centerLat * pi / 180) * cos(lat * pi / 180) *
            sin(dLng / 2) * sin(dLng / 2);
    return R * 2 * atan2(sqrt(a), sqrt(1 - a));
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
}

class ZoneService {
  final _firestore = FirebaseFirestore.instance;

  CollectionReference<Map<String, dynamic>> get _zones =>
      _firestore.collection('geofences');

  Future<ZoneInfo?> findActiveZone(double lat, double lng) async {
    // LAYER 1: Client-side point-in-polygon sobre el boundary de Firestore
    final fromBoundary = await _findByBoundary(lat, lng);
    if (fromBoundary != null) return fromBoundary;

    // LAYER 2: Mapbox reverse geocoding — match por nombre de municipio
    final fromMapbox = await _findByMapboxName(lat, lng);
    if (fromMapbox != null) return fromMapbox;

    return null;
  }

  /// Devuelve la zona donde está el usuario + las zonas activas adyacentes
  /// (distancia entre centros <= [_adjacentRadiusKm] km). Con esto la búsqueda
  /// se limita al área cubierta: la zona actual y las vecinas habilitadas.
  Future<List<ZoneInfo>> findActiveAndAdjacentZones(double lat, double lng) async {
    try {
      final data = await _zones.where('is_active', isEqualTo: true).get();
      if (data.docs.isEmpty) return const [];

      final all = data.docs
          .map((d) => _zoneFromDoc(d.id, d.data()))
          .nonNulls
          .toList();
      if (all.isEmpty) return const [];

      final current = all.where((z) => z.contains(lat, lng)).toList();
      if (current.isNotEmpty) {
        final allowed = [...current];
        for (final z in all) {
          final isOverlap = z.contains(lat, lng) || current.any((c) => _zonesOverlap(c, z));
          final isNear = z.distanceCenterKm(lat, lng) <= _adjacentRadiusKm ||
              current.any((c) => _zonesNear(c, z));
          if (z.id != current.first.id && (isOverlap || isNear)) {
            if (!allowed.any((a) => a.id == z.id)) allowed.add(z);
          }
        }
        return allowed;
      }

      // No hay zona conteniendo el punto: devuelve las más cercanas
      final sorted = [...all]..sort(
          (a, b) => a.distanceCenterKm(lat, lng).compareTo(b.distanceCenterKm(lat, lng)));
      return sorted.length <= 2 ? sorted : sorted.sublist(0, 2);
    } catch (_) {
      return const [];
    }
  }

  bool _zonesNear(ZoneInfo a, ZoneInfo b) {
    return a.distanceCenterKm(b.centerLat, b.centerLng) <= _adjacentRadiusKm;
  }

  bool _zonesOverlap(ZoneInfo a, ZoneInfo b) {
    return !(a.maxLat < b.minLat || a.minLat > b.maxLat ||
        a.maxLng < b.minLng || a.minLng > b.maxLng);
  }

  ZoneInfo? _zoneFromDoc(String docId, Map<String, dynamic> z) {
    final polygon = _extractPolygon(z['boundary']);
    final municipality = (z['municipality_name'] as String?) ?? '';
    final known = _knownUrbanCenter(municipality);
    return ZoneInfo(
      id: (z['id'] as String?) ?? docId,
      municipalityName: municipality,
      baseMultiplier: (z['base_multiplier'] as num?)?.toDouble() ?? 1.0,
      polygons: polygon != null ? [polygon] : const [],
      urbanRadiusKm: (z['urban_radius_km'] as num?)?.toDouble() ?? 2.5,
      urbanCenterLat:
          (z['center_lat'] as num?)?.toDouble() ?? known?.$1,
      urbanCenterLng:
          (z['center_lng'] as num?)?.toDouble() ?? known?.$2,
    );
  }

  /// Centros de casco urbano conocidos para municipios donde el centroide del
  /// polígono no coincide con el pueblo (polígonos con mucha zona rural).
  static (double, double)? _knownUrbanCenter(String municipality) {
    final m = municipality.toLowerCase();
    if (m.contains('el carmen') || m.contains('carmen de bol')) {
      return (9.7205, -75.1174); // El Carmen de Bolívar, Bolívar
    }
    return null;
  }

  Future<ZoneInfo?> _findByBoundary(double lat, double lng) async {
    try {
      final data = await _zones.where('is_active', isEqualTo: true).get();

      for (final doc in data.docs) {
        final zone = _zoneFromDoc(doc.id, doc.data());
        if (zone != null && _pointInMultiPolygon(lat, lng, zone.polygons)) {
          debugPrint('ZONE_LAYER1_FIRESTORE: found ${zone.municipalityName} at ($lat,$lng)');
          return zone;
        }
      }
      debugPrint('ZONE_LAYER1_FIRESTORE: no match at ($lat,$lng)');
    } catch (e) {
      debugPrint('ZONE_LAYER1_ERROR: $e');
    }
    return null;
  }

  Future<ZoneInfo?> _findByMapboxName(double lat, double lng) async {
    try {
      final municipalityName = await LocationService.getMunicipalityName(lat, lng);
      if (municipalityName == null || municipalityName.isEmpty) return null;

      final zones = await _fetchActiveZonesName();
      final lower = municipalityName.toLowerCase();

      for (final zone in zones) {
        final zLower = zone.municipalityName.toLowerCase();
        if (zLower.contains(lower) || lower.contains(zLower)) {
          debugPrint('ZONE_LAYER2_MAPBOX: matched ${zone.municipalityName} via "$municipalityName"');
          return zone;
        }
      }
    } catch (e) {
      debugPrint('ZONE_LAYER2_ERROR: $e');
    }
    return null;
  }

  Future<List<ZoneInfo>> _fetchActiveZonesName() async {
    final data = await _zones.where('is_active', isEqualTo: true).get();

    return data.docs.map((d) => _zoneFromDoc(d.id, d.data())).nonNulls.toList();
  }

  /// Convierte `boundary` (lista de `{lat, lng}` en Firestore) a un anillo
  /// `[[lat, lng], ...]` para point-in-polygon.
  List<List<double>>? _extractPolygon(dynamic boundary) {
    if (boundary is! List || boundary.isEmpty) return null;

    final ring = <List<double>>[];
    for (final pt in boundary) {
      if (pt is Map) {
        final lat = (pt['lat'] as num?)?.toDouble();
        final lng = (pt['lng'] as num?)?.toDouble();
        if (lat != null && lng != null) ring.add([lat, lng]);
      }
    }
    return ring.isEmpty ? null : ring;
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