import 'package:supabase_flutter/supabase_flutter.dart';

class SupabaseService {
  static const String supabaseUrl = 'https://gyfbazbvrgmwtwkkswdy.supabase.co';
  static const String supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5ZmJhemJ2cmdtd3R3a2tzd2R5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1MzI3NzIsImV4cCI6MjA4OTEwODc3Mn0.81poGBC7v6Ijrh3ezZUbR-0o-LG2nvQIM_Zp9eC7y24';

  static Future<void> initialize() async {
    await Supabase.initialize(
      url: supabaseUrl,
      anonKey: supabaseAnonKey,
    );
  }

  static SupabaseClient get client => Supabase.instance.client;
}
