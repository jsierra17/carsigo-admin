import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../services/preferences_service.dart';

/// Estado global del modo de tema. El modo claro es el predeterminado
/// (se guarda la elección en SharedPreferences).
final themeModeProvider =
    StateNotifierProvider<ThemeModeController, ThemeMode>((ref) {
  return ThemeModeController(ThemeMode.light);
});

class ThemeModeController extends StateNotifier<ThemeMode> {
  ThemeModeController(super.initial);

  /// Alterna entre claro y oscuro y persiste la elección.
  Future<void> toggle() async {
    final next =
        state == ThemeMode.dark ? ThemeMode.light : ThemeMode.dark;
    state = next;
    await PreferencesService.setThemeMode(next);
  }
}