import 'package:google_maps_flutter/google_maps_flutter.dart';

/// Perímetro urbano de El Carmen de Bolívar, Bolívar.
///
/// Los límites aproximados son:
///   - Norte: hasta Mala Noche (restaurante Cositas Ricas)
///   - Sur: hasta el centro poblado de Verdún
///   - Oriente: hasta la Institución Educativa Las Marías
///   - Occidente: hasta la Vía al Bledo
///
/// Las coordenadas son aproximadas (basadas en la posición urbana conocida
/// 9.7205, -75.1174). Se pueden ajustar una vez se tenga el GeoJSON oficial
/// del casco urbano.
class CarsigoUrbanPolygon {
  /// Lista ordenada de puntos que cierra el polígono (último punto = primero).
  static const List<LatLng> urbanPerimeter = <LatLng>[
    // Norte: Mala Noche / Cositas Ricas
    LatLng(9.7420, -75.1190),
    LatLng(9.7415, -75.1180),
    LatLng(9.7410, -75.1175),
    LatLng(9.7405, -75.1170),
    // Noreste
    LatLng(9.7350, -75.1100),
    LatLng(9.7300, -75.1050),
    // Oriente: Institución Educativa Las Marías
    LatLng(9.7250, -75.1000),
    LatLng(9.7200, -75.0980),
    LatLng(9.7180, -75.0990),
    LatLng(9.7150, -75.1000),
    // Sureste
    LatLng(9.7100, -75.1020),
    LatLng(9.7050, -75.1050),
    // Sur: centro poblado de Verdún
    LatLng(9.7000, -75.1100),
    LatLng(9.7005, -75.1120),
    LatLng(9.7010, -75.1140),
    // Suroeste
    LatLng(9.7050, -75.1180),
    LatLng(9.7100, -75.1220),
    LatLng(9.7150, -75.1250),
    // Oeste: Vía al Bledo
    LatLng(9.7200, -75.1280),
    LatLng(9.7220, -75.1290),
    LatLng(9.7250, -75.1285),
    LatLng(9.7280, -75.1270),
    // Noroeste (cierra al punto inicial)
    LatLng(9.7350, -75.1210),
    LatLng(9.7400, -75.1200),
    LatLng(9.7420, -75.1190),
  ];

  /// Centro aproximado del casco urbano (usado como referencia).
  static const LatLng center = LatLng(9.7205, -75.1174);

  /// Radio aproximado del casco urbano en kilómetros (para búsquedas rápidas).
  static const double urbanRadiusKm = 4.0;
}

/// Algoritmo de ray-casting (casting de rayos) para determinar si un punto
/// [point] está dentro del polígono [polygon].
///
/// Devuelve `true` si el punto está dentro, `false` si está fuera o sobre
/// el borde.
bool isPointInPolygon(LatLng point, List<LatLng> polygon) {
  bool inside = false;
  final int n = polygon.length;
  if (n < 3) return false;

  for (int i = 0, j = n - 1; i < n; j = i++) {
    final double xi = polygon[i].latitude, yi = polygon[i].longitude;
    final double xj = polygon[j].latitude, yj = polygon[j].longitude;

    // ¿El punto está entre los dos vértices en latitud?
    final bool intersect =
        ((yi > point.longitude) != (yj > point.longitude)) &&
            (point.latitude <
                (xj - xi) * (point.longitude - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/// Valida si un punto está dentro del polígono urbano de El Carmen de Bolívar.
bool isPointInUrbanPolygon(LatLng point) {
  return isPointInPolygon(point, CarsigoUrbanPolygon.urbanPerimeter);
}

/// Calcula el rectángulo (bounding box) que engloba el polígono urbano,
/// útil para usar como restricción de ubicación en Google Places.
/// Retorna (minLat, minLng, maxLat, maxLng).
(double, double, double, double) urbanPolygonBounds() {
  double minLat = double.infinity;
  double minLng = double.infinity;
  double maxLat = -double.infinity;
  double maxLng = -double.infinity;

  for (final pt in CarsigoUrbanPolygon.urbanPerimeter) {
    if (pt.latitude < minLat) minLat = pt.latitude;
    if (pt.longitude < minLng) minLng = pt.longitude;
    if (pt.latitude > maxLat) maxLat = pt.latitude;
    if (pt.longitude > maxLng) maxLng = pt.longitude;
  }

  return (minLat, minLng, maxLat, maxLng);
}