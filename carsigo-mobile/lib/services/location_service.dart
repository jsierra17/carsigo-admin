import 'dart:convert';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;
import 'zone_service.dart';

class LocationService {
  static String get _mapboxToken => dotenv.env['MAPBOX_ACCESS_TOKEN'] ?? '';

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

  static Future<List<MapSuggestion>> searchAddress(String query, {ZoneInfo? zone, double? userLat, double? userLng}) async {
    if (query.length < 3 || _mapboxToken.isEmpty) return [];

    String enhancedQuery = query;
    if (zone != null) {
      enhancedQuery = '$query, ${zone.municipalityName}';
    }

    var urlStr = 'https://api.mapbox.com/geocoding/v5/mapbox.places/${Uri.encodeComponent(enhancedQuery)}.json'
        '?access_token=$_mapboxToken&country=co&language=es&limit=5&types=address,place,locality,region';

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
        final coords = f['geometry']?['coordinates'] as List? ?? [0, 0];
        return MapSuggestion(
          placeName: f['place_name'] ?? '',
          lat: (coords[1] as num).toDouble(),
          lng: (coords[0] as num).toDouble(),
        );
      }).toList();

      if (zone != null && zone.polygons.isNotEmpty) {
        suggestions = suggestions.where((s) =>
            _pointInZone(s.lat, s.lng, zone.polygons)).toList();
      }

      return suggestions;
    } catch (_) {
      return [];
    }
  }

  static bool _pointInZone(double lat, double lng, List<List<List<double>>> polygons) {
    for (final polygon in polygons) {
      if (_pointInPolygon(lat, lng, polygon)) return true;
    }
    return false;
  }

  static bool _pointInPolygon(double testLat, double testLng, List<List<double>> ring) {
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

  static Future<String> reverseGeocode(double lat, double lng) async {
    if (_mapboxToken.isEmpty) return '$lat, $lng';

    final url = Uri.parse(
      'https://api.mapbox.com/geocoding/v5/mapbox.places/$lng,$lat.json'
      '?access_token=$_mapboxToken&language=es&limit=1',
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
    if (_mapboxToken.isEmpty) return null;

    final url = Uri.parse(
      'https://api.mapbox.com/geocoding/v5/mapbox.places/$lng,$lat.json'
      '?access_token=$_mapboxToken&types=place,locality,region&language=es&limit=5',
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
}

class MapSuggestion {
  final String placeName;
  final double lat;
  final double lng;

  MapSuggestion({required this.placeName, required this.lat, required this.lng});
}
