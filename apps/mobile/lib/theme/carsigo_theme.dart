import 'package:flutter/material.dart';

/// Paleta de marca CarSiGo por modo (claro/oscuro).
/// Fuente única de colores: los widgets la leen vía `context.palette`.
/// En oscuro el acento es el neón #00E5FF; en claro se usa el cian profundo
/// #00838F para lo interactivo (contraste AA) y el neón queda decorativo.
class CarSiGoPalette extends ThemeExtension<CarSiGoPalette> {
  final Color bg;
  final Color surface;
  final Color surfaceLight;
  final Color surfaceHigh;
  final Color border;
  final Color cyan;
  final Color green;
  final Color red;
  final Color orange;
  final Color textPrimary;
  final Color textSecondary;
  final Color textMuted;

  const CarSiGoPalette({
    required this.bg,
    required this.surface,
    required this.surfaceLight,
    required this.surfaceHigh,
    required this.border,
    required this.cyan,
    required this.green,
    required this.red,
    required this.orange,
    required this.textPrimary,
    required this.textSecondary,
    required this.textMuted,
  });

  static const dark = CarSiGoPalette(
    bg: Color(0xFF121212),
    surface: Color(0xFF1E1E1E),
    surfaceLight: Color(0xFF26262B),
    surfaceHigh: Color(0xFF2A2A2A),
    border: Color(0xFF333338),
    cyan: Color(0xFF00E5FF),
    green: Color(0xFF22C55E),
    red: Color(0xFFEF4444),
    orange: Color(0xFFF59E0B),
    textPrimary: Color(0xFFFFFFFF),
    textSecondary: Color(0xFF9AA0A6),
    textMuted: Color(0xFF767680),
  );

  static const light = CarSiGoPalette(
    bg: Color(0xFFF7F8FA),
    surface: Color(0xFFFFFFFF),
    surfaceLight: Color(0xFFEFF1F4),
    surfaceHigh: Color(0xFFEFF1F4),
    border: Color(0xFFE2E6EC),
    cyan: Color(0xFF00E5FF),
    green: Color(0xFF16A34A),
    red: Color(0xFFDC2626),
    orange: Color(0xFFD97706),
    textPrimary: Color(0xFF16181D),
    textSecondary: Color(0xFF5C6470),
    textMuted: Color(0xFF8A9099),
  );

  /// Color principal interactivo: neón en oscuro, cian profundo en claro.
  Color get primary => this == dark ? cyan : const Color(0xFF00838F);

  @override
  CarSiGoPalette copyWith({
    Color? bg,
    Color? surface,
    Color? surfaceLight,
    Color? surfaceHigh,
    Color? border,
    Color? cyan,
    Color? green,
    Color? red,
    Color? orange,
    Color? textPrimary,
    Color? textSecondary,
    Color? textMuted,
  }) {
    return CarSiGoPalette(
      bg: bg ?? this.bg,
      surface: surface ?? this.surface,
      surfaceLight: surfaceLight ?? this.surfaceLight,
      surfaceHigh: surfaceHigh ?? this.surfaceHigh,
      border: border ?? this.border,
      cyan: cyan ?? this.cyan,
      green: green ?? this.green,
      red: red ?? this.red,
      orange: orange ?? this.orange,
      textPrimary: textPrimary ?? this.textPrimary,
      textSecondary: textSecondary ?? this.textSecondary,
      textMuted: textMuted ?? this.textMuted,
    );
  }

  @override
  CarSiGoPalette lerp(ThemeExtension<CarSiGoPalette>? other, double t) {
    if (other is! CarSiGoPalette) return this;
    return CarSiGoPalette(
      bg: Color.lerp(bg, other.bg, t)!,
      surface: Color.lerp(surface, other.surface, t)!,
      surfaceLight: Color.lerp(surfaceLight, other.surfaceLight, t)!,
      surfaceHigh: Color.lerp(surfaceHigh, other.surfaceHigh, t)!,
      border: Color.lerp(border, other.border, t)!,
      cyan: Color.lerp(cyan, other.cyan, t)!,
      green: Color.lerp(green, other.green, t)!,
      red: Color.lerp(red, other.red, t)!,
      orange: Color.lerp(orange, other.orange, t)!,
      textPrimary: Color.lerp(textPrimary, other.textPrimary, t)!,
      textSecondary: Color.lerp(textSecondary, other.textSecondary, t)!,
      textMuted: Color.lerp(textMuted, other.textMuted, t)!,
    );
  }
}

/// Acceso corto a la paleta activa y al modo desde cualquier build.
extension CarSiGoThemeX on BuildContext {
  CarSiGoPalette get palette =>
      Theme.of(this).extension<CarSiGoPalette>()!;

  bool get isDark => Theme.of(this).brightness == Brightness.dark;
}

/// Tema CarSiGo completo para un brillo dado (claro u oscuro).
ThemeData buildCarSiGoTheme(Brightness brightness) {
  final dark = brightness == Brightness.dark;
  final p = dark ? CarSiGoPalette.dark : CarSiGoPalette.light;
  final primary = p.primary;
  final onPrimary = dark ? const Color(0xFF00363D) : Colors.white;

  final scheme = ColorScheme(
    brightness: brightness,
    primary: primary,
    onPrimary: onPrimary,
    primaryContainer: p.surfaceLight,
    onPrimaryContainer: primary,
    secondary: p.green,
    onSecondary: dark ? Colors.black : Colors.white,
    error: p.red,
    onError: Colors.white,
    surface: p.surface,
    onSurface: p.textPrimary,
    surfaceContainerLowest: p.bg,
    surfaceContainerLow: p.surface,
    surfaceContainer: p.surfaceLight,
    onSurfaceVariant: p.textSecondary,
    outline: p.border,
    outlineVariant: p.border,
    inverseSurface: p.textPrimary,
    onInverseSurface: p.bg,
    inversePrimary: p.cyan,
    scrim: Colors.black,
    shadow: Colors.black,
  );

  final base = ThemeData(
    useMaterial3: true,
    brightness: brightness,
    colorScheme: scheme,
    scaffoldBackgroundColor: p.bg,
    fontFamily: 'Poppins',
  );

  return base.copyWith(
    extensions: [p],
    appBarTheme: AppBarTheme(
      elevation: 0,
      centerTitle: true,
      backgroundColor: p.surface,
      foregroundColor: p.textPrimary,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: p.surfaceLight,
      hintStyle: TextStyle(color: p.textMuted),
      contentPadding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(color: p.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(color: p.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(color: primary, width: 1.5),
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
      backgroundColor: p.surfaceLight,
      contentTextStyle: TextStyle(color: p.textPrimary),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    ),
    dividerTheme: DividerThemeData(color: p.border),
  );
}