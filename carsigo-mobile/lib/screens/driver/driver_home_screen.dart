import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../providers/auth_provider.dart';
import '../../services/trip_service.dart';
import '../../models/trip.dart';
import '../profile_screen.dart';
import '../trip_history_screen.dart';

const _bg = Color(0xFF0a0a0b);
const _surface = Color(0xFF141416);
const _surfaceLight = Color(0xFF1c1c1e);
const _border = Color(0xFF2a2a2c);
const _cyan = Color(0xFF00E5FF);
const _textPrimary = Color(0xFFFFFFFF);
const _textSecondary = Color(0xFF94949E);
const _textMuted = Color(0xFF52525B);
const _green = Color(0xFF22C55E);
const _red = Color(0xFFEF4444);
const _amber = Color(0xFFF59E0B);

class DriverHomeScreen extends ConsumerStatefulWidget {
  const DriverHomeScreen({super.key});
  @override
  ConsumerState<DriverHomeScreen> createState() => _DriverHomeScreenState();
}

class _DriverHomeScreenState extends ConsumerState<DriverHomeScreen> {
  final _tripService = TripService();

  bool _isAvailable = false;
  Trip? _activeTrip;
  List<Trip> _pendingTrips = [];
  bool _loadingTrips = true;

  StreamSubscription? _pendingSub;
  StreamSubscription? _tripSub;

  @override
  void initState() {
    super.initState();
    _loadInitialState();
  }

  @override
  void dispose() {
    _pendingSub?.cancel();
    _tripSub?.cancel();
    super.dispose();
  }

  Future<void> _loadInitialState() async {
    final user = ref.read(currentUserProvider);
    if (user == null) return;

    final activeTrip = await _tripService.getActiveDriverTrip(user.id);
    if (mounted) {
      setState(() {
        _activeTrip = activeTrip;
        _isAvailable = activeTrip != null;
      });
      if (activeTrip != null) _subscribeToActiveTrip(activeTrip.id);
    }

    await _loadPendingTrips();
    _pendingSub = _tripService.subscribeToPendingTrips().listen((trips) {
      if (mounted) setState(() => _pendingTrips = trips);
    });
  }

  Future<void> _loadPendingTrips() async {
    setState(() => _loadingTrips = true);
    final trips = await _tripService.getPendingTrips();
    if (mounted) setState(() { _pendingTrips = trips; _loadingTrips = false; });
  }

  void _subscribeToActiveTrip(String tripId) {
    _tripSub?.cancel();
    _tripSub = _tripService.subscribeToTrip(tripId).listen((trip) {
      if (mounted) {
        setState(() => _activeTrip = trip);
        if (trip.status == TripStatus.completed || trip.status == TripStatus.cancelled) {
          setState(() { _activeTrip = null; _isAvailable = false; });
        }
      }
    });
  }

  Future<void> _toggleAvailability(bool available) async {
    final user = ref.read(currentUserProvider);
    if (user == null) return;
    setState(() => _isAvailable = available);
    await _tripService.setDriverAvailability(user.id, available);
    if (available) _loadPendingTrips();
  }

  Future<void> _acceptTrip(Trip trip) async {
    final user = ref.read(currentUserProvider);
    if (user == null) return;
    await _tripService.acceptTrip(trip.id, user.id);
    setState(() {
      _activeTrip = trip.copyWith(driverId: user.id, status: TripStatus.accepted);
      _pendingTrips = [];
    });
    _subscribeToActiveTrip(trip.id);
  }

  Future<void> _rejectTrip(Trip trip) async {
    await _tripService.rejectTrip(trip.id);
    _loadPendingTrips();
  }

  Future<void> _startTrip() async {
    if (_activeTrip == null) return;
    await _tripService.startTrip(_activeTrip!.id);
  }

  Future<void> _completeTrip() async {
    if (_activeTrip == null) return;
    await _tripService.completeTrip(_activeTrip!.id, fareAmount: 8000, commissionAmount: 960);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _bg,
      appBar: AppBar(
        title: const Text('CarSiGo Conductor', style: TextStyle(fontWeight: FontWeight.w900, color: _textPrimary, fontSize: 16)),
        centerTitle: true,
        backgroundColor: _surface,
        foregroundColor: _textPrimary,
        elevation: 0,
        actions: [
          IconButton(icon: const Icon(Icons.history), tooltip: 'Historial', onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const TripHistoryScreen()))),
          IconButton(icon: const Icon(Icons.person), tooltip: 'Perfil', onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const ProfileScreen()))),
        ],
      ),
      body: _activeTrip != null
          ? _ActiveTripView(trip: _activeTrip!, onStart: _startTrip, onComplete: _completeTrip)
          : _IdleDriverView(isAvailable: _isAvailable, onToggle: _toggleAvailability, pendingTrips: _pendingTrips, loadingTrips: _loadingTrips, onAccept: _acceptTrip, onReject: _rejectTrip),
    );
  }
}

class _IdleDriverView extends StatelessWidget {
  final bool isAvailable;
  final ValueChanged<bool> onToggle;
  final List<Trip> pendingTrips;
  final bool loadingTrips;
  final void Function(Trip) onAccept;
  final void Function(Trip) onReject;

  const _IdleDriverView({required this.isAvailable, required this.onToggle, required this.pendingTrips, required this.loadingTrips, required this.onAccept, required this.onReject});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(children: [
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: isAvailable ? _surfaceLight : _surface,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: isAvailable ? _green : _border, width: 2),
          ),
          child: Row(children: [
            Container(
              width: 56, height: 56,
              decoration: BoxDecoration(shape: BoxShape.circle, color: isAvailable ? _green : _textMuted),
              child: const Icon(Icons.directions_car, color: Colors.white, size: 28),
            ),
            const SizedBox(width: 16),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(isAvailable ? 'Disponible' : 'Fuera de línea', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: isAvailable ? _green : _textSecondary)),
              Text(isAvailable ? 'Recibirás solicitudes de viaje' : 'Actívalo para recibir viajes', style: const TextStyle(fontSize: 12, color: _textMuted)),
            ])),
            Switch(
              value: isAvailable,
              onChanged: onToggle,
              activeTrackColor: _green,
              activeColor: Colors.white,
            ),
          ]),
        ),
        const SizedBox(height: 24),
        Row(children: [
          const Text('Viajes disponibles', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w900, color: _textPrimary)),
          const Spacer(),
          if (isAvailable) Container(
            width: 10, height: 10,
            decoration: const BoxDecoration(shape: BoxShape.circle, color: _green),
          ),
        ]),
        const SizedBox(height: 8),
        if (!isAvailable)
          Container(
            padding: const EdgeInsets.all(40),
            decoration: BoxDecoration(color: _surface, borderRadius: BorderRadius.circular(16), border: Border.all(color: _border)),
            child: Column(children: [
              Icon(Icons.power_off, size: 48, color: _textMuted),
              const SizedBox(height: 12),
              const Text('Activa el switch para comenzar', style: TextStyle(color: _textMuted, fontWeight: FontWeight.w600)),
            ]),
          )
        else if (loadingTrips)
          const Center(child: Padding(padding: EdgeInsets.all(40), child: CircularProgressIndicator(strokeWidth: 3, color: _cyan)))
        else if (pendingTrips.isEmpty)
          Container(
            padding: const EdgeInsets.all(40),
            decoration: BoxDecoration(color: _surface, borderRadius: BorderRadius.circular(16), border: Border.all(color: _border)),
            child: Column(children: [
              Icon(Icons.search_off, size: 48, color: _textMuted),
              const SizedBox(height: 12),
              const Text('No hay viajes disponibles ahora', style: TextStyle(color: _textMuted, fontWeight: FontWeight.w600)),
              const SizedBox(height: 4),
              const Text('Te avisaremos cuando aparezca uno', style: TextStyle(color: _textMuted, fontSize: 12)),
            ]),
          )
        else
          ...pendingTrips.map((trip) => _PendingTripCard(trip: trip, onAccept: () => onAccept(trip), onReject: () => onReject(trip))),
      ]),
    );
  }
}

class _PendingTripCard extends StatelessWidget {
  final Trip trip;
  final VoidCallback onAccept;
  final VoidCallback onReject;
  const _PendingTripCard({required this.trip, required this.onAccept, required this.onReject});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: _surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _border),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          const Icon(Icons.location_on, color: _cyan, size: 22),
          const SizedBox(width: 8),
          Expanded(child: Text(trip.pickupAddress, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: _textPrimary), maxLines: 2, overflow: TextOverflow.ellipsis)),
        ]),
        const SizedBox(height: 6),
        Text('Solicitado ${_timeAgo(trip.createdAt)}', style: const TextStyle(color: _textMuted, fontSize: 11)),
        const SizedBox(height: 14),
        Row(children: [
          Expanded(
            child: OutlinedButton(
              onPressed: onReject,
              style: OutlinedButton.styleFrom(
                foregroundColor: _red,
                side: const BorderSide(color: _red),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: const Text('Rechazar'),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            flex: 2,
            child: ElevatedButton(
              onPressed: onAccept,
              style: ElevatedButton.styleFrom(
                backgroundColor: _green,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                textStyle: const TextStyle(fontWeight: FontWeight.w900),
              ),
              child: const Text('Aceptar viaje', style: TextStyle(color: Colors.white)),
            ),
          ),
        ]),
      ]),
    );
  }

  String _timeAgo(DateTime date) {
    final diff = DateTime.now().difference(date);
    if (diff.inSeconds < 60) return 'ahora';
    if (diff.inMinutes < 60) return 'hace ${diff.inMinutes} min';
    return 'hace ${diff.inHours}h';
  }
}

class _ActiveTripView extends StatelessWidget {
  final Trip trip;
  final VoidCallback onStart;
  final VoidCallback onComplete;
  const _ActiveTripView({required this.trip, required this.onStart, required this.onComplete});

  Color get _statusColor {
    switch (trip.status) {
      case TripStatus.accepted: return _cyan;
      case TripStatus.inProgress: return _green;
      default: return _textMuted;
    }
  }

  @override
  Widget build(BuildContext context) {
    final canStart = trip.status == TripStatus.accepted;
    final canComplete = trip.status == TripStatus.inProgress;

    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(children: [
        Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: _surface,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: _border),
          ),
          child: Column(children: [
            Icon(Icons.directions_car, size: 56, color: _statusColor),
            const SizedBox(height: 12),
            Text(trip.statusLabel, style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: _statusColor)),
            const SizedBox(height: 16),
            Row(children: [
              const Icon(Icons.location_on, color: _green, size: 24),
              const SizedBox(width: 8),
              Expanded(child: Text(trip.pickupAddress, style: const TextStyle(fontSize: 14, color: _textSecondary))),
            ]),
          ]),
        ),
        const SizedBox(height: 20),
        if (canStart)
          SizedBox(
            width: double.infinity, height: 56,
            child: ElevatedButton(
              onPressed: onStart,
              style: ElevatedButton.styleFrom(
                backgroundColor: _cyan,
                foregroundColor: _bg,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900),
              ),
              child: const Text('Iniciar viaje — recogí al pasajero'),
            ),
          ),
        if (canComplete)
          SizedBox(
            width: double.infinity, height: 56,
            child: ElevatedButton(
              onPressed: onComplete,
              style: ElevatedButton.styleFrom(
                backgroundColor: _green,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900),
              ),
              child: const Text('Completar viaje — entregué al pasajero'),
            ),
          ),
        const Spacer(),
        if (trip.status == TripStatus.inProgress)
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(color: _surfaceLight, borderRadius: BorderRadius.circular(12), border: Border.all(color: _border)),
            child: Row(mainAxisAlignment: MainAxisAlignment.spaceAround, children: [
              _TarifaItem(label: 'Tarifa', value: '\$8,000'),
              _TarifaItem(label: 'Comisión (10%)', value: '\$800'),
              _TarifaItem(label: 'Tu ganancia', value: '\$7,200'),
            ]),
          ),
      ]),
    );
  }
}

class _TarifaItem extends StatelessWidget {
  final String label;
  final String value;
  const _TarifaItem({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Column(children: [
      Text(value, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900, color: _cyan)),
      Text(label, style: const TextStyle(fontSize: 10, color: _textMuted)),
    ]);
  }
}
