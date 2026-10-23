import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

/// Destino guardado localmente (sin red): permite repetir viajes frecuentes
/// aunque el mapa no tenga indexado el lugar.
class RecentDestination {
  final String name;
  final double lat;
  final double lng;

  const RecentDestination({
    required this.name,
    required this.lat,
    required this.lng,
  });

  Map<String, dynamic> toJson() => {'name': name, 'lat': lat, 'lng': lng};

  factory RecentDestination.fromJson(Map<String, dynamic> j) {
    return RecentDestination(
      name: (j['name'] as String?)?.trim() ?? '',
      lat: (j['lat'] as num?)?.toDouble() ?? 0,
      lng: (j['lng'] as num?)?.toDouble() ?? 0,
    );
  }
}

class RecentDestinations {
  static const _key = 'recent_destinations_v1';
  static const max = 8;

  static Future<List<RecentDestination>> load() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_key);
    if (raw == null || raw.isEmpty) return [];
    try {
      final list = (jsonDecode(raw) as List).cast<Map<String, dynamic>>();
      return list
          .map(RecentDestination.fromJson)
          .where((d) => d.name.isNotEmpty)
          .toList();
    } catch (_) {
      return [];
    }
  }

  /// Inserta al inicio y elimina duplicados por nombre (sin importar
  /// mayúsculas). Mantiene máximo [max] entradas.
  static Future<void> add(RecentDestination d) async {
    if (d.name.trim().isEmpty) return;
    final list = await load();
    list.removeWhere(
      (x) => x.name.toLowerCase() == d.name.trim().toLowerCase(),
    );
    list.insert(0, d);
    if (list.length > max) list.removeRange(max, list.length);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      _key,
      jsonEncode([for (final x in list) x.toJson()]),
    );
  }
}