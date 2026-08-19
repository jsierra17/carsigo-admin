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
  ///
  /// NO se anexa el municipio al query (eso hacía que Mapbox devolviera el
  /// municipio como resultado para cualquier texto, repitiendo el mismo
  /// nombre); solo se usa como fallback si el query simple no arroja nada.
  static Future<List<MapSuggestion>> searchAddress(
    String query, {
    List<ZoneInfo> zones = const [],
    double? userLat,
    double? userLng,
  }) async {
    if (query.length < 2) return [];

    final municipality = zones.isNotEmpty
        ? zones.first.municipalityName.trim()
        : '';
    final bounds = _zonesBounds(zones);

    final addressLike = _addressLikeQuery(query);
    final suggestions = <MapSuggestion>[];

    if (addressLike) {
      // Direcciones (calle/carrera + número): Mapbox indexa bien números,
      // pero en municipios pequeños Photon/Nominatim aportan la vía completa;
      // se combinan las tres fuentes y se deduplica.
      if (_token.isNotEmpty) {
        suggestions.addAll(await _geocode(
          query,
          bounds: bounds,
          proximityLat: userLat,
          proximityLng: userLng,
        ));
      }
      suggestions.addAll(await _photonSearch(
        query,
        bounds: bounds,
        proximityLat: userLat,
        proximityLng: userLng,
      ));
      suggestions.addAll(await _nominatimSearch(
        query,
        bounds: bounds,
        proximityLat: userLat,
        proximityLng: userLng,
        municipality: municipality,
      ));
    } else {
      suggestions.addAll(await _photonSearch(
        query,
        bounds: bounds,
        proximityLat: userLat,
        proximityLng: userLng,
      ));
      suggestions.addAll(await _nominatimSearch(
        query,
        bounds: bounds,
        proximityLat: userLat,
        proximityLng: userLng,
      ));
      if (suggestions.isEmpty && _token.isNotEmpty) {
        suggestions.addAll(await _geocode(
          query,
          bounds: bounds,
          proximityLat: userLat,
          proximityLng: userLng,
        ));
      }
    }

    // Si el texto completo no dio resultados, reintenta con la base de la
    // dirección: 'calle 24 # 40-52' -> 'calle 24' (la vía sí existe en OSM),
    // y 'barrio la esperanza mz 5' -> 'barrio la esperanza'.
    if (suggestions.isEmpty) {
      for (final variant in _fallbackVariants(query)) {
        suggestions.addAll(await _photonSearch(
          variant,
          bounds: bounds,
          proximityLat: userLat,
          proximityLng: userLng,
        ));
        suggestions.addAll(await _nominatimSearch(
          variant,
          bounds: bounds,
          proximityLat: userLat,
          proximityLng: userLng,
          municipality: municipality,
        ));
      }
    }

    final filtered = _filterByZones(suggestions, zones);
    // Capa de casco urbano: descarta resultados fuera del radio urbano de
    // las zonas activas (la parte rural no se cubre).
    final urban = zones.isEmpty
        ? filtered
        : filtered
            .where((s) => zones.any((z) => z.containsUrban(s.lat, s.lng)))
            .toList();
    if (urban.isEmpty) {
      return _localPoiSuggestions(
        query,
        municipality,
        zones.isNotEmpty ? zones.first.centerLat : userLat,
        zones.isNotEmpty ? zones.first.centerLng : userLng,
      );
    }

    return _dedupeAndSort(urban);
  }

  /// ¿Parece una dirección (calle/carrera/avenida + número de predio)?
  static bool _addressLikeQuery(String query) {
    final q = query.trim().toLowerCase();
    final hasDigits = RegExp(r'\d').hasMatch(q);
    final hasArtery = RegExp(
      r'\b(calle|callej(o?n)?|carrera|av(enida)?|avenida|ave|transversal|trav|diagonal|autopista|vereda)\b',
    ).hasMatch(q);
    return hasDigits && hasArtery;
  }

  /// Variantes "base" de la consulta para reintentar cuando el texto completo
  /// no arroja resultados (ver [_withoutHouseNumber] y [_withoutBlockMarkers]).
  static List<String> _fallbackVariants(String query) {
    final original = query.trim().toLowerCase();
    final variants = <String>{
      _withoutHouseNumber(query),
      _withoutBlockMarkers(query),
    };
    variants.removeWhere((v) {
      final t = v.trim().toLowerCase();
      return t.length < 3 || t == original;
    });
    return variants.toList();
  }

  /// Recorta el marcador de número de predio: 'calle 24 # 40-52' -> 'calle 24',
  /// 'carrera 15 No. 12-28' -> 'carrera 15', 'avenida 2 40-25' -> 'avenida 2'.
  static String _withoutHouseNumber(String query) {
    final q = query.trim().replaceAll(RegExp(r'\s+'), ' ');
    final marker = RegExp(
      r'(?:#|Nº|nº|No\.|N\.|num\.|numero|número)\s*\d',
      caseSensitive: false,
    );
    final m = marker.firstMatch(q);
    if (m != null) return q.substring(0, m.start).trim();

    final dashed = RegExp(r'^(.+?)\s+\d{1,4}\s*[-–.]\s*\d{1,4}(?:\s*[-–.]\s*\d{1,4})*$');
    final m2 = dashed.firstMatch(q);
    if (m2 != null) {
      final base = m2.group(1)?.trim();
      if (base == null || base.length < 3) return '';
      return base;
    }
    return ''; // Sin marcador de predio: no hay qué recortar.
  }

  /// Quita marcadores de manzana/bloque/etapa: 'barrio la esperanza mz 5'
  /// -> 'barrio la esperanza'. Si solo quedara el marcador, devuelve ''.
  static String _withoutBlockMarkers(String query) {
    final re = RegExp(
      r'\b(?:manzana|manz\.|mz\.?|mza\.?|bloque|block|etapa|sector|conjunto|urbanizaci[oó]n)\b[\s.,]*\d*[\s.,]*',
      caseSensitive: false,
    );
    final stripped = query.replaceAll(re, ' ').trim();
    return stripped.length >= 3 ? stripped : '';
  }

  /// Photon (komoot.io): búsqueda gratuita sobre OpenStreetMap, sin API key.
  /// Cubre los POIs que Mapbox no indexa en municipios pequeños (plazas,
  /// hospitales, colegios, calles). Filtra por bbox de las zonas y prioriza
  /// por proximidad al teléfono; si el bbox no devuelve nada reintenta sin él.
  static Future<List<MapSuggestion>> _photonSearch(
    String query, {
    required (double, double, double, double)? bounds,
    double? proximityLat,
    double? proximityLng,
  }) async {
    var features = await _photonFetch(
      query,
      bounds: bounds,
      proximityLat: proximityLat,
      proximityLng: proximityLng,
    );
    if (features.isEmpty && bounds != null) {
      features = await _photonFetch(
        query,
        bounds: null,
        proximityLat: proximityLat,
        proximityLng: proximityLng,
      );
    }

    final out = <MapSuggestion>[];
    for (final f in features) {
      final p = f['properties'] as Map<String, dynamic>? ?? {};
      final coords =
          (f['geometry'] as Map<String, dynamic>?)?['coordinates'] as List? ??
              const [0, 0];
      final lat = (coords[1] as num?)?.toDouble() ?? 0;
      final lng = (coords[0] as num?)?.toDouble() ?? 0;
      final name = (p['name'] as String?)?.trim() ?? '';
      if (name.isEmpty) continue;
      final city = (p['city'] as String?) ?? (p['district'] as String?);
      final placeName = city != null && city.isNotEmpty && !name.contains(city)
          ? '$name · $city'
          : name;
      out.add(MapSuggestion(
        placeName: placeName,
        lat: lat,
        lng: lng,
        distanceKm: proximityLat != null && proximityLng != null
            ? _haversineKm(proximityLat, proximityLng, lat, lng)
            : null,
      ));
    }
    return out;
  }

  static Future<List<Map<String, dynamic>>> _photonFetch(
    String query, {
    required (double, double, double, double)? bounds,
    double? proximityLat,
    double? proximityLng,
  }) async {
    // OJO: Photon no acepta 'lang=es' (solo default/de/en/fr) y responde error.
    // Por eso no se pasa idiom: la proximidad y el filtro por zona bastan.
    var url = 'https://photon.komoot.io/api/?q=${Uri.encodeComponent(query)}'
        '&limit=8';
    if (bounds != null) {
      final (loLng, loLat, hiLng, hiLat) = bounds;
      url += '&bbox=$loLng,$loLat,$hiLng,$hiLat';
    }
    if (proximityLat != null && proximityLng != null) {
      url += '&lat=$proximityLat&lon=$proximityLng';
    }
    try {
      final res = await http.get(
        Uri.parse(url),
        headers: const {'User-Agent': 'CarSiGo/1.0 (app movilidad)'},
      ).timeout(const Duration(seconds: 8));
      if (res.statusCode != 200) return const [];

      final data = jsonDecode(res.body) as Map<String, dynamic>;
      return (data['features'] as List?)?.cast<Map<String, dynamic>>() ??
          const [];
    } catch (_) {
      return const [];
    }
  }

  /// Nominatim (OpenStreetMap), sin API key: complementa con calles
  /// (secondary/residential), barrios y amenidades (hoteles, clínicas) que
  /// Mapbox no indexa en municipios pequeños. No se limita por bbox aquí:
  /// el filtro por zonas se aplica después en [_filterByZones].
  static Future<List<MapSuggestion>> _nominatimSearch(
    String query, {
    required (double, double, double, double)? bounds,
    double? proximityLat,
    double? proximityLng,
    String municipality = '',
  }) async {
    final url = Uri.parse(
      'https://nominatim.openstreetmap.org/search'
      '?format=jsonv2&accept-language=es&countrycodes=co&limit=8'
      '&q=${Uri.encodeComponent(query)}',
    );
    try {
      final res = await http.get(
        url,
        headers: const {'User-Agent': 'CarSiGo/1.0 (app de movilidad)'},
      ).timeout(const Duration(seconds: 8));
      if (res.statusCode != 200) return const [];

      final data = jsonDecode(res.body) as List? ?? const [];
      final out = <MapSuggestion>[];
      for (final item in data) {
        if (item is! Map<String, dynamic>) continue;
        final lat = double.tryParse(item['lat']?.toString() ?? '');
        final lng = double.tryParse(item['lon']?.toString() ?? '');
        if (lat == null || lng == null) continue;
        final display = (item['display_name'] as String?)?.trim() ?? '';
        if (display.isEmpty) continue;

        final parts = display.split(',').map((p) => p.trim()).toList();
        var city = '';
        if (municipality.isNotEmpty) {
          for (final p in parts.skip(1)) {
            if (p.toLowerCase().contains(municipality.toLowerCase())) {
              city = p;
              break;
            }
          }
        }
        final label = parts.isNotEmpty ? parts[0] : display;
        final name = city.isNotEmpty &&
                !label.toLowerCase().contains(municipality.toLowerCase())
            ? '$label · $city'
            : label;

        out.add(MapSuggestion(
          placeName: name,
          lat: lat,
          lng: lng,
          distanceKm: (proximityLat != null && proximityLng != null)
              ? _haversineKm(proximityLat, proximityLng, lat, lng)
              : null,
        ));
      }
      return out;
    } catch (_) {
      return const [];
    }
  }

  static List<MapSuggestion> _filterByZones(
    List<MapSuggestion> suggestions,
    List<ZoneInfo> zones,
  ) {
    if (zones.isEmpty) return suggestions;
    return suggestions
        .where((s) => zones.any((z) => z.contains(s.lat, s.lng)))
        .toList();
  }

  static List<MapSuggestion> _dedupeAndSort(
    List<MapSuggestion> suggestions,
  ) {
    final seen = <String>{};
    final out = <MapSuggestion>[];
    for (final s in suggestions) {
      if (s.placeName.isEmpty || !seen.add(s.placeName.toLowerCase())) continue;
      out.add(s);
    }
    out.sort((a, b) {
      final da = a.distanceKm ?? double.infinity;
      final db = b.distanceKm ?? double.infinity;
      return da.compareTo(db);
    });
    return out;
  }

  /// POIs locales generados desde la zona. Mapbox no indexa municipios
  /// pequeños (no devuelve plaza/hospital/colegio en El Carmen de Bolívar),
  /// así que creamos sugerencias básicas ancladas a [baseLat/lng] (la
  /// posición del usuario, siempre dentro de la zona activa).
  static List<MapSuggestion> _localPoiSuggestions(
    String query,
    String municipality,
    double? baseLat,
    double? baseLng,
  ) {
    if (municipality.isEmpty || baseLat == null || baseLng == null) {
      return const [];
    }
    final munLabel = municipality.length > 3 ? municipality : 'El centro';
    final q = query.trim().toLowerCase();

    const seeds = <(String, List<String>)>[
      ('Plaza principal', ['plaza', 'principal', 'central', 'parque']),
      ('Hospital', ['hospital', 'clinica', 'salud']),
      ('Colegio', ['colegio', 'escuela', 'instituto', 'liceo']),
      ('Iglesia', ['iglesia', 'parroquia', 'templo', 'catedral']),
      ('Mercado', ['mercado', 'plaza de mercado']),
      ('Terminal de transporte', ['terminal', 'transporte', 'bus']),
    ];

    final matched = <MapSuggestion>[];
    for (final (label, keywords) in seeds) {
      final labelLower = label.toLowerCase();
      final hitsQuery = q.isNotEmpty && (labelLower.contains(q) || keywords.any((k) => q.contains(k)));
      if (hitsQuery || (q.isEmpty && labelLower == 'plaza principal')) {
        matched.add(MapSuggestion(
          placeName: '$label · $munLabel',
          lat: baseLat,
          lng: baseLng,
          distanceKm: 0,
        ));
      }
    }
    return matched;
  }

  static Future<List<MapSuggestion>> _geocode(
    String searchQuery, {
    required (double, double, double, double)? bounds,
    double? proximityLat,
    double? proximityLng,
  }) async {
    // Sin types=place/locality: evita que el municipio mismo aparezca como
    // resultado repetido para cualquier consulta.
    var urlStr =
        'https://api.mapbox.com/geocoding/v5/mapbox.places/'
        '${Uri.encodeComponent(searchQuery)}.json'
        '?access_token=$_token&country=co&language=es&limit=8'
        '&types=address,poi,neighborhood,district';

    if (bounds != null) {
      final (loLng, loLat, hiLng, hiLat) = bounds;
      urlStr += '&bbox=$loLng,$loLat,$hiLng,$hiLat';
    }
    if (proximityLat != null && proximityLng != null) {
      urlStr += '&proximity=$proximityLng,$proximityLat';
    }

    try {
      final res = await http.get(Uri.parse(urlStr))
          .timeout(const Duration(seconds: 8));
      if (res.statusCode != 200) return const [];

      final data = jsonDecode(res.body) as Map<String, dynamic>;
      final features = data['features'] as List? ?? [];

      final out = <MapSuggestion>[];
      for (final f in features) {
        final coords = (f['geometry'] as Map<String, dynamic>?)?
                ['coordinates'] as List? ??
            const [0, 0];
        final lat = (coords[1] as num).toDouble();
        final lng = (coords[0] as num).toDouble();
        out.add(MapSuggestion(
          placeName: (f['place_name'] as String?) ?? '',
          lat: lat,
          lng: lng,
          distanceKm: proximityLat != null && proximityLng != null
              ? _haversineKm(proximityLat, proximityLng, lat, lng)
              : null,
        ));
      }
      return out;
    } catch (_) {
      return const [];
    }
  }

  /// Bbox que encierra todas las zonas permitidas, o null si no hay zonas.
  static (double, double, double, double)? _zonesBounds(List<ZoneInfo> zones) {
    if (zones.isEmpty) return null;
    double loLat = double.infinity, hiLat = double.negativeInfinity;
    double loLng = double.infinity, hiLng = double.negativeInfinity;
    for (final z in zones) {
      loLat = min(loLat, z.minLat);
      hiLat = max(hiLat, z.maxLat);
      loLng = min(loLng, z.minLng);
      hiLng = max(hiLng, z.maxLng);
    }
    return (loLng, loLat, hiLng, hiLat);
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
      final res = await http.get(url)
          .timeout(const Duration(seconds: 8));
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
      final res = await http.get(url)
          .timeout(const Duration(seconds: 8));
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
      final res = await http.get(url)
          .timeout(const Duration(seconds: 8));
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