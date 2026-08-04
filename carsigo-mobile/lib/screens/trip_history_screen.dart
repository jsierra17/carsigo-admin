import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../providers/auth_provider.dart';
import '../models/trip.dart';

const _bg = Color(0xFF0a0a0b);
const _surface = Color(0xFF141416);
const _border = Color(0xFF2a2a2c);
const _cyan = Color(0xFF00E5FF);
const _green = Color(0xFF22C55E);
const _textPrimary = Color(0xFFFFFFFF);
const _textMuted = Color(0xFF52525B);

class TripHistoryScreen extends ConsumerStatefulWidget {
  const TripHistoryScreen({super.key});
  @override
  ConsumerState<TripHistoryScreen> createState() => _TripHistoryScreenState();
}

class _TripHistoryScreenState extends ConsumerState<TripHistoryScreen> {
  final _supabase = Supabase.instance.client;
  List<Trip> _trips = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadTrips();
  }

  Future<void> _loadTrips() async {
    final user = ref.read(currentUserProvider);
    if (user == null) { if (mounted) setState(() => _loading = false); return; }

    try {
      final data = await _supabase
          .from('trips')
          .select()
          .or('passenger_id.eq.${user.id},driver_id.eq.${user.id}')
          .order('created_at', ascending: false)
          .limit(50);

      if (mounted) {
        setState(() {
          _trips = (data as List).map((j) => Trip.fromJson(j)).toList();
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Color _statusColor(TripStatus s) {
    switch (s) {
      case TripStatus.completed: return _green;
      case TripStatus.cancelled: return _textMuted;
      case TripStatus.inProgress: return _cyan;
      case TripStatus.accepted: return _cyan;
      case TripStatus.pending: return Colors.orange;
    }
  }

  String _fromNow(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inMinutes < 1) return 'ahora';
    if (diff.inHours < 1) return 'hace ${diff.inMinutes} min';
    if (diff.inDays < 1) return 'hace ${diff.inHours}h';
    if (diff.inDays < 30) return 'hace ${diff.inDays}d';
    return '${dt.day}/${dt.month}/${dt.year}';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _bg,
      appBar: AppBar(
        title: const Text('Historial de viajes', style: TextStyle(fontWeight: FontWeight.w900, color: _textPrimary, fontSize: 16)),
        centerTitle: true,
        backgroundColor: _surface,
        foregroundColor: _textPrimary,
        elevation: 0,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(strokeWidth: 3, color: _cyan))
          : _trips.isEmpty
              ? Center(
                  child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                    Icon(Icons.history, size: 64, color: _textMuted),
                    const SizedBox(height: 16),
                    const Text('No hay viajes aún', style: TextStyle(color: _textMuted, fontWeight: FontWeight.w700, fontSize: 18)),
                    const SizedBox(height: 8),
                    const Text('Tus viajes aparecerán aquí\ndespués de tu primer solicitud.', style: TextStyle(color: _textMuted, fontSize: 13), textAlign: TextAlign.center),
                  ]),
                )
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: _trips.length,
                  itemBuilder: (_, i) {
                    final t = _trips[i];
                    final color = _statusColor(t.status);
                    return Container(
                      margin: const EdgeInsets.only(bottom: 10),
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: _surface,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: _border),
                      ),
                      child: Row(children: [
                        Container(
                          width: 44, height: 44,
                          decoration: BoxDecoration(shape: BoxShape.circle, color: color.withAlpha(30)),
                          child: Icon(
                            t.status == TripStatus.completed ? Icons.check_circle
                                : t.status == TripStatus.cancelled ? Icons.cancel
                                : Icons.directions_car,
                            color: color, size: 22,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(t.pickupAddress, style: const TextStyle(color: _textPrimary, fontWeight: FontWeight.w700, fontSize: 13), maxLines: 1, overflow: TextOverflow.ellipsis),
                          if (t.dropoffAddress != null)
                            Text(t.dropoffAddress!, style: const TextStyle(color: _textMuted, fontSize: 11), maxLines: 1, overflow: TextOverflow.ellipsis),
                          Text(_fromNow(t.createdAt), style: const TextStyle(color: _textMuted, fontSize: 10)),
                        ])),
                        if (t.fareAmount > 0)
                          Text('\$${t.fareAmount.toStringAsFixed(0)}', style: const TextStyle(color: _cyan, fontWeight: FontWeight.w900, fontSize: 15)),
                      ]),
                    );
                  },
                ),
    );
  }
}
