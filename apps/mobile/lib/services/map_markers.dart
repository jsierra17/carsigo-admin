import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

/// Genera bitmaps para marcadores de Google Maps (pines redondos con icono
/// blanco) y los cachea por (color, icono) para no regenerarlos en cada build.
final _cache = <String, BitmapDescriptor>{};

Future<BitmapDescriptor> pinBitmap(
  Color color,
  IconData icon, {
  double scale = 1.0,
}) async {
  final key = 'pin-${color.toARGB32()}-${icon.codePoint}-$scale';
  final cached = _cache[key];
  if (cached != null) return cached;

  const base = 96.0;
  final size = (base * scale).ceil();
  final canvasSize = size.toDouble();
  final recorder = ui.PictureRecorder();
  final canvas = Canvas(recorder);
  final center = Offset(canvasSize / 2, canvasSize / 2);
  final radius = canvasSize / 2 - 8 * scale;

  // Sombra suave.
  canvas.drawCircle(
    center.translate(0, 4 * scale),
    radius,
    Paint()..color = Colors.black38,
  );
  // Círculo de color.
  canvas.drawCircle(center, radius, Paint()..color = color);
  // Borde blanco.
  canvas.drawCircle(
    center,
    radius,
    Paint()
      ..color = Colors.white
      ..style = PaintingStyle.stroke
      ..strokeWidth = 6 * scale,
  );
  // Glifo del icono.
  final tp = TextPainter(textDirection: TextDirection.ltr);
  tp.text = TextSpan(
    text: String.fromCharCode(icon.codePoint),
    style: TextStyle(
      fontSize: 42 * scale,
      fontFamily: icon.fontFamily,
      color: Colors.white,
    ),
  );
  tp.layout();
  tp.paint(
    canvas,
    Offset(canvasSize / 2 - tp.width / 2, canvasSize / 2 - tp.height / 2),
  );

  final img = await recorder.endRecording().toImage(size, size);
  final bytes = await img.toByteData(format: ui.ImageByteFormat.png);
  final descriptor = BitmapDescriptor.bytes(bytes!.buffer.asUint8List());
  _cache[key] = descriptor;
  return descriptor;
}
