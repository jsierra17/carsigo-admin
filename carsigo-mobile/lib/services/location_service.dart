import 'dart:convert';
import 'dart:math';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;
import 'package:latlong2/latlong.dart';
import 'zone_service.dart';

class LocationService {
  static String get _token => dotenv.env['MAPBOX_ACCESS_TOKEN'] ?? '';
  static String get mapboxToken => _token;

  static Future<Position> getCurrentPosition() async {
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      throw Exception('Los servicios de ubicacion estan desactivados.\nActivalos en Configuracion > Ubicacion.');
    }

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        throw Exception('Permiso de ubicacion denegado.\nConcedelo en Configuracion > Permisos.');
      }
    }

    if (permission == LocationPermission.deniedForever) {
      throw Exception('Permiso de ubicacion denegado permanentemente.\nConcedelo en Configuracion > Permisos.');
    }

    return await Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
    );
  }

  /// Busca direcciones/POIs limitado a [zones] (zona actual + adyacentes
  /// habilitadas). Usa `bbox` de Mapbox para confinar la búsqueda al área
  /// cubierta y proximity para priorizar lo cercano al teléfono.
  static Future<List<MapSuggestion>> searchAddress(
    String query, {
    List<ZoneInfo> zones = const [],
    double? userLat,
    double? userLng,
  }) async {
    if (query.length < 2 || _token.isEmpty) return [];

    // Anexa el municipio de la zona actual para que Mapbox ubique la búsqueda
    // en la zona correcta (sin esto, el bbox devuelve 0 resultados).
    var searchQuery = query;
    if (zones.isNotEmpty) {
      final mun = zones.first.municipalityName.trim();
      if (mun.isNotEmpty && !query.toLowerCase().contains(mun.toLowerCase())) {
        searchQuery = '$query, $mun';
      }
    }

    var urlStr = 'https://api.mapbox.com/geocoding/v5/mapbox.places/${Uri.encodeComponent(searchQuery)}.json'
        '?access_token=$_token&country=co&language=es&limit=8'
        '&types=address,place,locality,district,neighborhood,poi';

    // Bounding box: encierra todas las zonas permitidas, así Mapbox prioriza
    // resultados dentro de la zona (evita que sugiera ciudades lejanas).
    if (zones.isNotEmpty) {
      double loLat = double.infinity, hiLat = double.negativeInfinity;
      double loLng = double.infinity, hiLng = double.negativeInfinity;
      for (final z in zones) {
        loLat = min(loLat, z.minLat);
        hiLat = max(hiLat, z.maxLat);
        loLng = min(loLng, z.minLng);
        hiLng = max(hiLng, z.maxLng);
      }
      if (loLng <= hiLng) {
        urlStr += '&bbox=$loLng,$loLat,$hiLng,$hiLat';
      }
    }

    if (userLat != null && userLng != null) {
      urlStr += '&proximity=$userLng,$userLat';
    }

    final url = Uri.parse(urlStr);

    try {
      final res = await http.get(url);
      if (res.statusCode != 200) return [];

      final data = jsonDecode(res.body) as Map<String, dynamic>;
      final features = data['features'] as List? ?? [];

      var suggestions = features.map((f) {
        final coords = (f['geometry'] as Map<String, dynamic>?)?
            ['coordinates'] as List? ?? [0, 0];
        final lat = (coords[1] as num).toDouble();
        final lng = (coords[0] as num).toDouble();
        return MapSuggestion(
          placeName: (f['place_name'] as String?) ?? '',
          lat: lat,
          lng: lng,
          distanceKm: userLat != null && userLng != null
              ? _haversineKm(userLat, userLng, lat, lng)
              : null,
        );
      }).toList();

final inZones = zones.isNotEmpty
          ? suggestions.where((s) => zones.any((z) => z.contains(s.lat, s.lng))).toList()
          : suggestions;
      if (inZones.isEmpty) return inZones;

      inZones.sort((a, b) {
        final da = a.distanceKm ?? double.infinity;
        final db = b.distanceKm ?? double.infinity;
        return da.compareTo(db);
      });

      return inZones;
    } catch (_) {
      return [];
    }
  }

  /// Ruta real (con curvas) vía Mapbox Directions. Devuelve puntos del camino
  /// en orden, la distancia en km y la duración estimada en minutos.
  static Future<RouteInfo> getRoute({
    required double fromLat,
    required double fromLng,
    required double toLat,
    required double toLng,
  }) async {
    if (_token.isEmpty) {
      return _fallbackRoute(fromLat, fromLng, toLat, toLng);
    }
    try {
      final url = Uri.parse(
        'https://api.mapbox.com/directions/v5/mapbox/driving/$fromLng,$fromLat;$toLng,$toLat'
        '?access_token=$_token&overview=full&geometries=geojson&steps=false'
        '&language=es&alternatives=false',
      );
      final res = await http.get(url);
      if (res.statusCode != 200) {
        return _fallbackRoute(fromLat, fromLng, toLat, toLng);
      }
      final data = jsonDecode(res.body) as Map<String, dynamic>;
      final routes = data['routes'] as List? ?? [];
      if (routes.isEmpty) return _fallbackRoute(fromLat, fromLng, toLat, toLng);

      final route = routes.first as Map<String, dynamic>;
      final geometry = route['geometry'] as Map<String, dynamic>?;
      final rawCoords = geometry?['coordinates'] as List? ?? const [];
      final points = <LatLng>[];
      for (final c in rawCoords) {
          if (c is List && c.length >= 2) {
            points.add(LatLng((c[1] as num).toDouble(), (c[0] as num).toDouble()));
          }
        }
      if (points.length < 2) return _fallbackRoute(fromLat, fromLng, toLat, toLng);

      return RouteInfo(
        points: points,
        distanceKm: ((route['distance'] as num?)?.toDouble() ?? 0) / 1000,
        durationMin: ((route['duration'] as num?)?.toDouble() ?? 0) / 60,
        hasRoad: true,
      );
    } catch (_) {
      return _fallbackRoute(fromLat, fromLng, toLat, toLng);
    }
  }

  static Future<String> reverseGeocode(double lat, double lng) async {
    if (_token.isEmpty) return '$lat, $lng';

    final url = Uri.parse(
      'https://api.mapbox.com/geocoding/v5/mapbox.places/$lng,$lat.json'
      '?access_token=$_token&language=es&limit=1',
    );

    try {
      final res = await http.get(url);
      if (res.statusCode != 200) return '$lat, $lng';

      final data = jsonDecode(res.body) as Map<String, dynamic>;
      final features = data['features'] as List? ?? [];
      if (features.isEmpty) return '$lat, $lng';

      return features[0]['place_name'] ?? '$lat, $lng';
    } catch (_) {
      return '$lat, $lng';
    }
  }

  static Future<String?> getMunicipalityName(double lat, double lng) async {
    if (_token.isEmpty) return null;

    final url = Uri.parse(
      'https://api.mapbox.com/geocoding/v5/mapbox.places/$lng,$lat.json'
      '?access_token=$_token&types=place,locality,region&language=es&limit=5',
    );

    try {
      final res = await http.get(url);
      if (res.statusCode != 200) return null;

      final data = jsonDecode(res.body) as Map<String, dynamic>;
      final features = data['features'] as List? ?? [];

      for (final f in features) {
        final placeType = f['place_type'] as List? ?? [];
        final text = f['text'] as String? ?? '';
        final context = f['context'] as List? ?? [];

        if (placeType.contains('place') || placeType.contains('locality')) {
          return text;
        }

        for (final ctx in context) {
          final ctxId = ctx['id'] as String? ?? '';
          final ctxText = ctx['text'] as String? ?? '';
          if (ctxId.startsWith('place') || ctxId.startsWith('locality') || ctxId.startsWith('region')) {
            return ctxText;
          }
        }
      }

      if (features.isNotEmpty) {
        return features[0]['text'] as String?;
      }

      return null;
    } catch (_) {
      return null;
    }
  }

  static RouteInfo _fallbackRoute(double fromLat, double fromLng, double toLat, double toLng) {
    final a = LatLng(fromLat, fromLng);
    final b = LatLng(toLat, toLng);
    final km = _haversineKm(fromLat, fromLng, toLat, toLng);
    return RouteInfo(points: [a, b], distanceKm: km, durationMin: km / 25, hasRoad: false);
  }

  static double _haversineKm(double lat1, double lng1, double lat2, double lng2) {
    const R = 6371;
    final dLat = _rad(lat2 - lat1);
    final dLng = _rad(lng2 - lng1);
    final a = sin(dLat / 2) * sin(dLat / 2) +
        cos(_rad(lat1)) * cos(_rad(lat2)) * sin(dLng / 2) * sin(dLng / 2);
    return R * 2 * atan2(sqrt(a), sqrt(1 - a));
  }

  static double _rad(double d) => d * pi / 180;
}

class MapSuggestion {
  final String placeName;
  final double lat;
  final double lng;
  final double? distanceKm;

  MapSuggestion({required this.placeName, required this.lat, required this.lng, this.distanceKm});
}

class RouteInfo {
  final List<LatLng> points;
  final double distanceKm;
  final double durationMin;
  final bool hasRoad;

  RouteInfo({
    required this.points,
    required this.distanceKm,
    required this.durationMin,
    this.hasRoad = true,
  });
}