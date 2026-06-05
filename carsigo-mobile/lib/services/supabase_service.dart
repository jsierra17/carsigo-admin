import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class SupabaseService {
  static String get supabaseUrl => dotenv.env['SUPABASE_URL'] ?? '';
  static String get supabaseAnonKey => dotenv.env['SUPABASE_ANON_KEY'] ?? '';

  static Future<void> initialize() async {
    final url = supabaseUrl;
    final key = supabaseAnonKey;

    if (url.isEmpty || key.isEmpty) {
      throw Exception(
        'Faltan las variables de entorno SUPABASE_URL o SUPABASE_ANON_KEY.\n'
        'Asegúrate de crear un archivo .env en carsigo-mobile/ con las credenciales correctas.\n'
        'Usa .env.example como referencia.',
      );
    }

    await Supabase.initialize(
      url: url,
      anonKey: key,
    );
  }

  static SupabaseClient get client => Supabase.instance.client;
}
