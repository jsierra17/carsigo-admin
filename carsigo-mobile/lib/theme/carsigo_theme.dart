import 'package:flutter/material.dart';

/// Tokens de color de CarSiGo.
/// Fuente única de la paleta oscura (pensada para OLED: fondos near-black,
/// texto no-puro-blanco, acentos desaturados que ahorran batería).
abstract final class CarSiGoColors {
  static const Color bg = Color(0xFF0a0a0b);
  static const Color surface = Color(0xFF141416);
  static const Color surfaceLight = Color(0xFF1c1c1e);
  static const Color border = Color(0xFF2a2a2c);
  static const Color cyan = Color(0xFF00E5FF);
  static const Color green = Color(0xFF22C55E);
  static const Color red = Color(0xFFEF4444);
  static const Color orange = Color(0xFFF59E0B);
  static const Color textPrimary = Color(0xFFFFFFFF);
  static const Color textSecondary = Color(0xFF94949E);
  static const Color textMuted = Color(0xFF52525B);
}

ThemeData buildCarSiGoTheme() {
  const scheme = ColorScheme.dark(
    primary: CarSiGoColors.cyan,
    onPrimary: CarSiGoColors.bg,
    primaryContainer: CarSiGoColors.surfaceLight,
    onPrimaryContainer: CarSiGoColors.cyan,
    secondary: CarSiGoColors.green,
    onSecondary: Colors.black,
    error: CarSiGoColors.red,
    onError: Colors.white,
    surface: CarSiGoColors.surface,
    onSurface: CarSiGoColors.textPrimary,
    surfaceContainerLowest: CarSiGoColors.bg,
    surfaceContainerLow: CarSiGoColors.surface,
    surfaceContainer: CarSiGoColors.surfaceLight,
    onSurfaceVariant: CarSiGoColors.textSecondary,
    outline: CarSiGoColors.border,
    outlineVariant: CarSiGoColors.border,
    inverseSurface: CarSiGoColors.textPrimary,
    onInverseSurface: CarSiGoColors.bg,
    inversePrimary: CarSiGoColors.cyan,
    scrim: Colors.black,
    shadow: Colors.black,
  );

  final base = ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    colorScheme: scheme,
    scaffoldBackgroundColor: CarSiGoColors.bg,
    fontFamily: 'Poppins',
  );

  return base.copyWith(
    appBarTheme: const AppBarTheme(
      elevation: 0,
      centerTitle: true,
      backgroundColor: CarSiGoColors.surface,
      foregroundColor: CarSiGoColors.textPrimary,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: CarSiGoColors.surfaceLight,
      hintStyle: const TextStyle(color: CarSiGoColors.textMuted),
      contentPadding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: CarSiGoColors.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: CarSiGoColors.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: CarSiGoColors.cyan, width: 1.5),
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        minimumSize: const Size.fromHeight(52),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size.fromHeight(52),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
      ),
    ),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: CarSiGoColors.surfaceLight,
      contentTextStyle: const TextStyle(color: CarSiGoColors.textPrimary),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    ),
    dividerTheme: const DividerThemeData(color: CarSiGoColors.border),
  );
}