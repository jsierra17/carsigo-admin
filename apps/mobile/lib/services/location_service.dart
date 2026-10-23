import 'dart:convert';
import 'dart:math';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;
import 'package:latlong2/latlong.dart';
import 'zone_service.dart';

class LocationService {
  static String get _googleKey => dotenv.env['GOOGLE_WEB_SERVICES_KEY'] ?? '';

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
  /// habilitadas). Usa Google Places (Text Search) como única fuente externa
  /// (tiendas, gimnasios, iglesias, veredas, direcciones, etc.), reforzado por
  /// Google Geocoding para números de predio y por los lugares locales
  /// sembrados en Firestore. El filtro por zonas/casco urbano se aplica al
  /// final y es idéntico al que ya existía.
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

    // Lugares locales sembrados (veredas, centros poblados, barrios) con su
    // nombre exacto tal como se conoce en la zona: se muestran primero.
    final local = await _localPlacesSearch(
      query,
      zones,
      proximityLat: userLat,
      proximityLng: userLng,
    );
    suggestions.addAll(local);

    // Google Places Text Search (New): la base de datos de Google Maps
    // (comercios, iglesias, gimnasios, puntos de interés y direcciones).
    var googleResults = await _googleTextSearch(
      query,
      proximityLat: userLat,
      proximityLng: userLng,
      bounds: bounds,
    );
    if (googleResults.isEmpty && municipality.isNotEmpty) {
      // Reintenta anexando el municipio para desambiguar y ampliar cobertura.
      googleResults = await _googleTextSearch(
        '$query, $municipality',
        proximityLat: userLat,
        proximityLng: userLng,
        bounds: bounds,
      );
    }
    suggestions.addAll(googleResults);

    // Direcciones (calle/carrera + número): Google Geocoding resuelve bien
    // los números de predio y complementa a Text Search.
    if (addressLike) {
      suggestions.addAll(await _geocode(
        query,
        bounds: bounds,
        proximityLat: userLat,
        proximityLng: userLng,
      ));
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

    // Cercanía: se muestran los destinos a ≤4 km del teléfono y también los
    // que están dentro del área de servicio aunque queden más lejos (el
    // corredor vial hasta La Cansona, veredas de orilla de carretera).
    final nearby = userLat != null && userLng != null
        ? urban.where((s) {
            final dist = s.distanceKm ?? double.infinity;
            final inService = zones.any((z) => z.containsUrban(s.lat, s.lng));
            return dist <= 4.0 || inService;
          }).toList()
        : urban;
    if (nearby.isEmpty) {
      return _localPoiSuggestions(query, municipality, userLat, userLng);
    }

    return _dedupeAndSort(nearby);
  }

  /// Busca en la colección `places` (Firestore): veredas, centros poblados y
  /// barrios sembrados con su nombre local exacto, para que aparezcan aunque
  /// Google no los tenga indexados con ese nombre.
  static Future<List<MapSuggestion>> _localPlacesSearch(
    String query,
    List<ZoneInfo> zones, {
    double? proximityLat,
    double? proximityLng,
  }) async {
    if (zones.isEmpty || query.trim().length < 2) return const [];
    final zoneIds = zones.map((z) => z.id).toList();
    try {
      final snap = await FirebaseFirestore.instance
          .collection('places')
          .where('zone_id', whereIn: zoneIds)
          .get();
      final q = query.trim().toLowerCase();
      final out = <MapSuggestion>[];
      for (final doc in snap.docs) {
        final d = doc.data();
        if (d['is_active'] == false) continue;
        final name = (d['name'] as String?)?.trim() ?? '';
        if (name.isEmpty || !name.toLowerCase().contains(q)) continue;
        final lat = (d['lat'] as num?)?.toDouble() ?? 0;
        final lng = (d['lng'] as num?)?.toDouble() ?? 0;
        if (lat == 0 && lng == 0) continue;
        final type = (d['type'] as String?) ?? '';
        final label = type == 'vereda' ? '$name (vereda)' : name;
        out.add(MapSuggestion(
          placeName: label,
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

  /// ¿Parece una dirección (calle/carrera/avenida + número de predio)?
  static bool _addressLikeQuery(String query) {
    final q = query.trim().toLowerCase();
    final hasDigits = RegExp(r'\d').hasMatch(q);
    final hasArtery = RegExp(
      r'\b(calle|callej(o?n)?|carrera|av(enida)?|avenida|ave|transversal|trav|diagonal|autopista|vereda)\b',
    ).hasMatch(q);
    return hasDigits && hasArtery;
  }

  /// Google Places Text Search (New): devuelve resultados con coordenadas en
  /// una sola llamada (POST places:searchText). Sin límites estrictos por
  /// zona: el radio y el filtro por zonas se aplican después.
  static Future<List<MapSuggestion>> _googleTextSearch(
    String query, {
    double? proximityLat,
    double? proximityLng,
    (double, double, double, double)? bounds,
  }) async {
    if (_googleKey.isEmpty) return const [];

    final body = <String, dynamic>{
      'textQuery': query,
      'languageCode': 'es',
      'maxResultCount': 8,
    };
    if (proximityLat != null && proximityLng != null) {
      body['locationBias'] = {
        'circle': {
          'center': {'latitude': proximityLat, 'longitude': proximityLng},
          'radius': 40000.0,
        },
      };
    } else if (bounds != null) {
      final (loLng, loLat, hiLng, hiLat) = bounds;
      body['locationBias'] = {
        'rectangle': {
          'low': {'latitude': loLat, 'longitude': loLng},
          'high': {'latitude': hiLat, 'longitude': hiLng},
        },
      };
    }

    try {
      final res = await http
          .post(
            Uri.parse('https://places.googleapis.com/v1/places:searchText'),
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': _googleKey,
              'X-Goog-FieldMask':
                  'places.displayName,places.formattedAddress,places.location',
            },
            body: jsonEncode(body),
          )
          .timeout(const Duration(seconds: 8));
      if (res.statusCode != 200) return const [];

      final data = jsonDecode(res.body) as Map<String, dynamic>;
      final places =
          (data['places'] as List?)?.cast<Map<String, dynamic>>() ??
              const [];

      final out = <MapSuggestion>[];
      for (final p in places) {
        final name =
            (p['displayName'] as Map<String, dynamic>?)?['text'] as String? ??
                '';
        if (name.isEmpty) continue;
        final loc = p['location'] as Map<String, dynamic>?;
        final lat = (loc?['latitude'] as num?)?.toDouble() ?? 0;
        final lng = (loc?['longitude'] as num?)?.toDouble() ?? 0;
        if (lat == 0 && lng == 0) continue;
        out.add(MapSuggestion(
          placeName: name,
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

  /// POIs locales generados desde la zona. Google no indexa municipios
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

  /// Geocodificación directa con Google Geocoding API (fallback para
  /// direcciones con número de predio que Text Search no resuelve).
  static Future<List<MapSuggestion>> _geocode(
    String searchQuery, {
    required (double, double, double, double)? bounds,
    double? proximityLat,
    double? proximityLng,
  }) async {
    if (_googleKey.isEmpty) return const [];

    var urlStr =
        'https://maps.googleapis.com/maps/api/geocode/json'
        '?address=${Uri.encodeComponent(searchQuery)}'
        '&components=country:CO&language=es&key=$_googleKey';

    if (bounds != null) {
      final (loLng, loLat, hiLng, hiLat) = bounds;
      urlStr += '&bounds=$loLat,$loLng|$hiLat,$hiLng';
    }

    try {
      final res = await http.get(Uri.parse(urlStr))
          .timeout(const Duration(seconds: 8));
      if (res.statusCode != 200) return const [];

      final data = jsonDecode(res.body) as Map<String, dynamic>;
      final results = data['results'] as List? ?? [];

      final out = <MapSuggestion>[];
      for (final r in results.take(8)) {
        final geo = (r as Map<String, dynamic>)['geometry']
            as Map<String, dynamic>?;
        final loc = geo?['location'] as Map<String, dynamic>?;
        final lat = (loc?['lat'] as num?)?.toDouble() ?? 0;
        final lng = (loc?['lng'] as num?)?.toDouble() ?? 0;
        final address = (r['formatted_address'] as String?) ?? '';
        if (lat == 0 && lng == 0) continue;
        out.add(MapSuggestion(
          placeName: address,
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

  /// Ruta real (con curvas) vía Google Directions API. Devuelve puntos del
  /// camino en orden, la distancia en km y la duración estimada en minutos.
  static Future<RouteInfo> getRoute({
    required double fromLat,
    required double fromLng,
    required double toLat,
    required double toLng,
  }) async {
    if (_googleKey.isEmpty) {
      return _fallbackRoute(fromLat, fromLng, toLat, toLng);
    }
    try {
      final url = Uri.parse(
        'https://maps.googleapis.com/maps/api/directions/json'
        '?origin=$fromLat,$fromLng&destination=$toLat,$toLng'
        '&mode=driving&language=es&key=$_googleKey',
      );
      final res = await http.get(url)
          .timeout(const Duration(seconds: 8));
      if (res.statusCode != 200) {
        return _fallbackRoute(fromLat, fromLng, toLat, toLng);
      }
      final data = jsonDecode(res.body) as Map<String, dynamic>;
      if ((data['status'] as String?) != 'OK') {
        return _fallbackRoute(fromLat, fromLng, toLat, toLng);
      }
      final routes = data['routes'] as List? ?? [];
      if (routes.isEmpty) return _fallbackRoute(fromLat, fromLng, toLat, toLng);

      final route = routes.first as Map<String, dynamic>;
      final legs = route['legs'] as List? ?? [];
      if (legs.isEmpty) return _fallbackRoute(fromLat, fromLng, toLat, toLng);
      final leg = legs.first as Map<String, dynamic>;
      final distanceM = (leg['distance'] as Map<String, dynamic>?)?['value']
              as num? ??
          0;
      final durationS = (leg['duration'] as Map<String, dynamic>?)?['value']
              as num? ??
          0;

      final encoded = (route['overview_polyline'] as Map<String, dynamic>?)?['points']
              as String? ??
          '';
      final points = _decodePolyline(encoded);
      if (points.length < 2) {
        return _fallbackRoute(fromLat, fromLng, toLat, toLng);
      }

      return RouteInfo(
        points: points,
        distanceKm: distanceM.toDouble() / 1000,
        durationMin: durationS.toDouble() / 60,
        hasRoad: true,
      );
    } catch (_) {
      return _fallbackRoute(fromLat, fromLng, toLat, toLng);
    }
  }

  /// Decodifica una polilínea codificada de Google (algoritmo estándar).
  static List<LatLng> _decodePolyline(String encoded) {
    final points = <LatLng>[];
    var lat = 0, lng = 0;
    var index = 0;
    final len = encoded.length;
    while (index < len) {
      int b, shift = 0, result = 0;
      do {
        b = encoded.codeUnitAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      final dlat = (result & 1) != 0 ? ~(result >> 1) : (result >> 1);
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = encoded.codeUnitAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      final dlng = (result & 1) != 0 ? ~(result >> 1) : (result >> 1);
      lng += dlng;

      points.add(LatLng(lat / 1e5, lng / 1e5));
    }
    return points;
  }

  static Future<String> reverseGeocode(double lat, double lng) async {
    if (_googleKey.isEmpty) return '$lat, $lng';

    final url = Uri.parse(
      'https://maps.googleapis.com/maps/api/geocode/json'
      '?latlng=$lat,$lng&language=es&key=$_googleKey',
    );

    try {
      final res = await http.get(url)
          .timeout(const Duration(seconds: 8));
      if (res.statusCode != 200) return '$lat, $lng';

      final data = jsonDecode(res.body) as Map<String, dynamic>;
      final results = data['results'] as List? ?? [];
      if (results.isEmpty) return '$lat, $lng';

      return (results.first as Map<String, dynamic>)['formatted_address']
              as String? ??
          '$lat, $lng';
    } catch (_) {
      return '$lat, $lng';
    }
  }

  static Future<String?> getMunicipalityName(double lat, double lng) async {
    if (_googleKey.isEmpty) return null;

    final url = Uri.parse(
      'https://maps.googleapis.com/maps/api/geocode/json'
      '?latlng=$lat,$lng&language=es&key=$_googleKey',
    );

    try {
      final res = await http.get(url)
          .timeout(const Duration(seconds: 8));
      if (res.statusCode != 200) return null;

      final data = jsonDecode(res.body) as Map<String, dynamic>;
      final results = data['results'] as List? ?? [];

      for (final r in results) {
        final components = (r as Map<String, dynamic>)['address_components']
                as List? ??
            const [];
        for (final c in components) {
          final types = (c as Map<String, dynamic>)['types'] as List? ?? [];
          final longName = c['long_name'] as String? ?? '';
          final shortName = c['short_name'] as String? ?? '';
          if (types.contains('locality') ||
              types.contains('administrative_area_level_2') ||
              types.contains('administrative_area_level_3')) {
            return longName.isNotEmpty ? longName : shortName;
          }
        }
      }

      return null;
    } catch (_) {
      return null;
    }
  }

  static RouteInfo _fallbackRoute(double fromLat, double fromLng, double toLat, double toLng) =>
      fallbackRoute(fromLat, fromLng, toLat, toLng);

  /// Ruta de emergencia (línea recta + distancia haversine): sirve solo para
  /// estimar la tarifa cuando la API de rutas falla; NO debe dibujarse en el
  /// mapa (hasRoad=false lo indica).
  static RouteInfo fallbackRoute(double fromLat, double fromLng, double toLat, double toLng) {
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