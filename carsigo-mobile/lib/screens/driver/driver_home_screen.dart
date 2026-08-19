import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../providers/auth_provider.dart';
import '../../services/trip_service.dart';
import '../../services/location_service.dart';
import '../../services/pricing_engine.dart';
import 'package:geolocator/geolocator.dart';
import '../../models/trip.dart';
import '../profile_screen.dart';
import '../trip_history_screen.dart';
import '../../theme/carsigo_theme.dart';

const _bg = CarSiGoColors.bg;
const _surface = CarSiGoColors.surface;
const _surfaceLight = CarSiGoColors.surfaceLight;
const _border = CarSiGoColors.border;
const _cyan = CarSiGoColors.cyan;
const _textPrimary = CarSiGoColors.textPrimary;
const _textSecondary = CarSiGoColors.textSecondary;
const _textMuted = CarSiGoColors.textMuted;
const _green = CarSiGoColors.green;
const _red = CarSiGoColors.red;

class DriverHomeScreen extends ConsumerStatefulWidget {
  const DriverHomeScreen({super.key});
  @override
  ConsumerState<DriverHomeScreen> createState() => _DriverHomeScreenState();
}

class _DriverHomeScreenState extends ConsumerState<DriverHomeScreen> {
  final _tripService = TripService();
  final _engine = PricingEngine();
  final _mapCtrl = MapController();

  bool _isAvailable = false;
  Trip? _activeTrip;
  List<PendingTripInfo> _tripInfos = [];
  bool _loadingTrips = true;

  LatLng? _currentPos;
  List<LatLng> _routePoints = const [];
  bool _loadingRoute = false;

  StreamSubscription? _pendingSub;
  StreamSubscription? _tripSub;
  StreamSubscription<Position>? _posSub;

  @override
  void initState() {
    super.initState();
    _initLocation();
    _loadInitialState();
  }

  @override
  void dispose() {
    _mapCtrl.dispose();
    _pendingSub?.cancel();
    _tripSub?.cancel();
    _posSub?.cancel();
    super.dispose();
  }

  Future<void> _initLocation() async {
    try {
      final pos = await LocationService.getCurrentPosition();
      if (mounted) {
        setState(() => _currentPos = LatLng(pos.latitude, pos.longitude));
        _mapCtrl.move(LatLng(pos.latitude, pos.longitude), 15);
      }
    } catch (_) {}

    _posSub = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, distanceFilter: 10),
    ).listen((pos) {
      if (mounted) {
        setState(() => _currentPos = LatLng(pos.latitude, pos.longitude));
        if (_activeTrip != null && !_loadingRoute) _loadRouteFor(_activeTrip!);
      }
    });
  }

  Future<void> _loadInitialState() async {
    final user = ref.read(currentUserProvider);
    if (user == null) return;

    final activeTrip = await _tripService.getActiveDriverTrip(user.uid);
    if (mounted) {
      setState(() {
        _activeTrip = activeTrip;
        _isAvailable = activeTrip != null;
      });
      if (activeTrip != null) {
        _subscribeToActiveTrip(activeTrip.id);
        _loadRouteFor(activeTrip);
      }
    }

    await _loadPendingTrips();
    _pendingSub = _tripService.subscribeToPendingTrips().listen((trips) {
      if (mounted) {
      _resolveTripInfos(trips);
      }
    });
  }

  Future<void> _resolveTripInfos(List<Trip> trips) async {
    final infos = <PendingTripInfo>[];
    for (final t in trips) {
      final est = await _estimateFare(t);
      infos.add(PendingTripInfo(trip: t, estimate: est));
    }
    if (mounted) setState(() => _tripInfos = infos);
  }

  Future<PricingBreakdown?> _estimateFare(Trip trip) async {
    if (trip.distanceKm <= 0) return null;
    try {
      final vehicleType = trip.vehicleType == 'car' ? VehicleType.car : VehicleType.moto;
      return await _engine.calculateFare(vehicleType: vehicleType, distanceKm: trip.distanceKm);
    } catch (_) {
      return null;
    }
  }

  Future<void> _loadPendingTrips() async {
    setState(() => _loadingTrips = true);
    final trips = await _tripService.getPendingTrips();
    if (mounted) {
      setState(() => _loadingTrips = false);
      _resolveTripInfos(trips);
    }
  }

  void _subscribeToActiveTrip(String tripId) {
    _tripSub?.cancel();
    _tripSub = _tripService.subscribeToTrip(tripId).listen((trip) {
      if (mounted) {
        setState(() => _activeTrip = trip);
        _loadRouteFor(trip);
        if (trip.status == TripStatus.completed || trip.status == TripStatus.cancelled) {
          setState(() { _activeTrip = null; _isAvailable = false; _routePoints = const []; });
        }
      }
    });
  }

  Future<void> _loadRouteFor(Trip trip) async {
    final origin = _currentPos;
    if (origin == null) return;
    final destLat = trip.status == TripStatus.inProgress
        ? (trip.dropoffLat ?? trip.pickupLat)
        : trip.pickupLat;
    final destLng = trip.status == TripStatus.inProgress
        ? (trip.dropoffLng ?? trip.pickupLng)
        : trip.pickupLng;
    if (destLat == 0 && destLng == 0) return;

    setState(() => _loadingRoute = true);
    try {
      final route = await LocationService.getRoute(
        fromLat: origin.latitude,
        fromLng: origin.longitude,
        toLat: destLat,
        toLng: destLng,
      );
      if (mounted) {
        setState(() => _routePoints = route.points);
        if (route.points.isNotEmpty) {
          final mid = route.points[route.points.length ~/ 2];
          _mapCtrl.move(mid, 14);
        }
      }
    } catch (_) {
      if (mounted) setState(() => _routePoints = const []);
    } finally {
      if (mounted) setState(() => _loadingRoute = false);
    }
  }

  Future<void> _toggleAvailability(bool available) async {
    final user = ref.read(currentUserProvider);
    if (user == null) return;
    setState(() => _isAvailable = available);
    await _tripService.setDriverAvailability(user.uid, available);
    if (available) _loadPendingTrips();
  }

  Future<void> _acceptTrip(Trip trip) async {
    final user = ref.read(currentUserProvider);
    if (user == null) return;
    await _tripService.acceptTrip(trip.id, user.uid);
    setState(() {
      _activeTrip = trip.copyWith(driverId: user.uid, status: TripStatus.accepted);
      _tripInfos = [];
      _routePoints = const [];
    });
    _subscribeToActiveTrip(trip.id);
    _loadRouteFor(trip);
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
    final est = await _estimateFare(_activeTrip!);
    await _tripService.completeTrip(
      _activeTrip!.id,
      fareAmount: est?.finalFare ?? _activeTrip!.fareAmount,
      commissionAmount: est?.commissionAmount,
    );
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
        automaticallyImplyLeading: false,
        actions: [
          IconButton(icon: const Icon(Icons.history), onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const TripHistoryScreen()))),
          IconButton(icon: const Icon(Icons.person), onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const ProfileScreen()))),
        ],
      ),
      body: _activeTrip != null
          ? _buildActiveTripView()
          : _buildMapWithList(),
    );
  }

  Widget _buildMapWithList() {
    final markers = <Marker>[];
    if (_currentPos != null) {
      markers.add(Marker(
        point: _currentPos!,
        child: const Icon(Icons.my_location, color: Colors.blue, size: 24),
      ));
    }
    return Stack(children: [
      FlutterMap(
        mapController: _mapCtrl,
        options: MapOptions(
          initialCenter: _currentPos ?? const LatLng(10.0, -75.0),
          initialZoom: 14,
        ),
        children: [
          TileLayer(
            urlTemplate: 'https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/256/{z}/{x}/{y}@2x?access_token=${LocationService.mapboxToken}',
            userAgentPackageName: 'com.carsigo.app',
          ),
          MarkerLayer(markers: markers),
        ],
      ),
      Positioned(
        left: 0, right: 0, bottom: 0,
        child: _IdleDriverView(
          isAvailable: _isAvailable,
          onToggle: _toggleAvailability,
          pendingTrips: _tripInfos,
          loadingTrips: _loadingTrips,
          onAccept: (t) => _acceptTrip(t.trip),
          onReject: (t) => _rejectTrip(t.trip),
        ),
      ),
    ]);
  }

  Widget _buildActiveTripView() {
    final t = _activeTrip!;
    final markers = <Marker>[];
    if (_currentPos != null) {
      markers.add(Marker(point: _currentPos!, child: const Icon(Icons.my_location, color: Colors.blue, size: 24)));
    }
    final destLat = t.status == TripStatus.inProgress
        ? (t.dropoffLat ?? t.pickupLat)
        : t.pickupLat;
    final destLng = t.status == TripStatus.inProgress
        ? (t.dropoffLng ?? t.pickupLng)
        : t.pickupLng;
    if (destLat != 0 || destLng != 0) {
      markers.add(Marker(
        point: LatLng(destLat, destLng),
        child: Icon(
          t.status == TripStatus.accepted ? Icons.location_on
              : t.status == TripStatus.inProgress ? Icons.flag : Icons.check_circle,
          size: 48, color: _cyan,
        ),
        width: 48,
        height: 48,
      ));
    }

    final canStart = t.status == TripStatus.accepted;
    final canComplete = t.status == TripStatus.inProgress;

    return Stack(children: [
      FlutterMap(
        mapController: _mapCtrl,
        options: MapOptions(
          initialCenter: _currentPos ?? const LatLng(10.0, -75.0),
          initialZoom: 15,
        ),
        children: [
          TileLayer(
            urlTemplate: 'https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/256/{z}/{x}/{y}@2x?access_token=${LocationService.mapboxToken}',
            userAgentPackageName: 'com.carsigo.app',
          ),
          if (_routePoints.length >= 2)
            PolylineLayer(
              polylines: [
                Polyline(
                  points: _routePoints,
                  strokeWidth: 5,
                  color: _cyan,
                ),
              ],
            )
          else if (_currentPos != null && (destLat != 0 || destLng != 0))
            PolylineLayer(
              polylines: [
                Polyline(
                  points: [_currentPos!, LatLng(destLat, destLng)],
                  strokeWidth: 3,
                  color: _cyan.withAlpha(140),
                ),
              ],
            ),
          MarkerLayer(markers: markers),
        ],
      ),
      Positioned(
        left: 0, right: 0, bottom: 0,
        child: Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: _surface,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
            border: Border(top: BorderSide(color: _border)),
          ),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Icon(Icons.directions_car, size: 40, color: _cyan),
            const SizedBox(height: 8),
            Text(t.statusLabel, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: _textPrimary)),
            const SizedBox(height: 10),
            Row(children: [
              const Icon(Icons.location_on, color: _green, size: 18),
              const SizedBox(width: 6),
              Expanded(child: Text(t.pickupAddress, style: const TextStyle(color: _textSecondary, fontSize: 13))),
            ]),
            if (t.dropoffAddress != null) ...[
              const SizedBox(height: 4),
              Row(children: [
                const Icon(Icons.flag, color: _cyan, size: 18),
                const SizedBox(width: 6),
                Expanded(child: Text(t.dropoffAddress!, style: const TextStyle(color: _textSecondary, fontSize: 13))),
              ]),
            ],
            const SizedBox(height: 12),
            if (canStart)
              SizedBox(
                width: double.infinity, height: 52,
                child: ElevatedButton(
                  onPressed: _startTrip,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _cyan, foregroundColor: _bg,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900),
                  ),
                  child: const Text('Iniciar viaje'),
                ),
              ),
            if (canComplete)
              SizedBox(
                width: double.infinity, height: 52,
                child: ElevatedButton(
                  onPressed: _completeTrip,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _green, foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900),
                  ),
                  child: const Text('Completar viaje'),
                ),
              ),
            if (t.status == TripStatus.inProgress && t.fareAmount > 0)
              Padding(
                padding: const EdgeInsets.only(top: 10),
                child: Row(mainAxisAlignment: MainAxisAlignment.spaceAround, children: [
                  _FareItem(label: 'Tarifa', value: '\$${t.fareAmount.toStringAsFixed(0)}'),
                  _FareItem(label: 'Comisión', value: '\$${t.commissionAmount.toStringAsFixed(0)}'),
                  _FareItem(label: 'Ganancia', value: '\$${(t.fareAmount - t.commissionAmount).toStringAsFixed(0)}'),
                ]),
              ),
          ]),
        ),
      ),
    ]);
  }
}

class PendingTripInfo {
  final Trip trip;
  final PricingBreakdown? estimate;
  PendingTripInfo({required this.trip, this.estimate});
}

class _IdleDriverView extends StatelessWidget {
  final bool isAvailable;
  final ValueChanged<bool> onToggle;
  final List<PendingTripInfo> pendingTrips;
  final bool loadingTrips;
  final void Function(PendingTripInfo) onAccept;
  final void Function(PendingTripInfo) onReject;

  const _IdleDriverView({required this.isAvailable, required this.onToggle, required this.pendingTrips, required this.loadingTrips, required this.onAccept, required this.onReject});

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(maxHeight: 420),
      decoration: BoxDecoration(
        color: _surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        border: Border(top: BorderSide(color: _border)),
      ),
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: isAvailable ? _surfaceLight : _surface,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: isAvailable ? _green : _border, width: 2),
            ),
            child: Row(children: [
              Container(
                width: 48, height: 48,
                decoration: BoxDecoration(shape: BoxShape.circle, color: isAvailable ? _green : _textMuted),
                child: const Icon(Icons.directions_car, color: Colors.white, size: 24),
              ),
              const SizedBox(width: 14),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(isAvailable ? 'Disponible' : 'Fuera de línea', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: isAvailable ? _green : _textSecondary)),
                Text(isAvailable ? 'Recibirás solicitudes' : 'Actívalo para recibir viajes', style: const TextStyle(fontSize: 11, color: _textMuted)),
              ])),
              Switch(value: isAvailable, onChanged: onToggle, activeTrackColor: _green, activeThumbColor: Colors.white),
            ]),
          ),
          const SizedBox(height: 12),
          Row(children: [
            const Text('Viajes disponibles', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: _textPrimary)),
            const Spacer(),
            if (isAvailable) Container(width: 8, height: 8, decoration: const BoxDecoration(shape: BoxShape.circle, color: _green)),
          ]),
          const SizedBox(height: 8),
          if (!isAvailable)
            Container(
              padding: const EdgeInsets.all(32),
              decoration: BoxDecoration(color: _surface, borderRadius: BorderRadius.circular(16), border: Border.all(color: _border)),
              child: Column(children: [
                Icon(Icons.power_off, size: 40, color: _textMuted),
                const SizedBox(height: 8),
                const Text('Activa el switch para comenzar', style: TextStyle(color: _textMuted, fontWeight: FontWeight.w600, fontSize: 13)),
              ]),
            )
          else if (loadingTrips)
            const Center(child: Padding(padding: EdgeInsets.all(32), child: CircularProgressIndicator(strokeWidth: 3, color: _cyan)))
          else if (pendingTrips.isEmpty)
            Container(
              padding: const EdgeInsets.all(32),
              decoration: BoxDecoration(color: _surface, borderRadius: BorderRadius.circular(16), border: Border.all(color: _border)),
              child: Column(children: [
                Icon(Icons.search_off, size: 40, color: _textMuted),
                const SizedBox(height: 8),
                const Text('No hay viajes disponibles', style: TextStyle(color: _textMuted, fontWeight: FontWeight.w600, fontSize: 13)),
                const SizedBox(height: 2),
                const Text('Te avisaremos cuando aparezca uno', style: TextStyle(color: _textMuted, fontSize: 11)),
              ]),
            )
          else
            ...pendingTrips.map((info) => _PendingTripCard(info: info, onAccept: () => onAccept(info), onReject: () => onReject(info))),
        ]),
      ),
    );
  }
}

class _PendingTripCard extends StatelessWidget {
  final PendingTripInfo info;
  final VoidCallback onAccept;
  final VoidCallback onReject;
  const _PendingTripCard({required this.info, required this.onAccept, required this.onReject});

  @override
  Widget build(BuildContext context) {
    final t = info.trip;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: _surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _border),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          const Icon(Icons.location_on, color: _cyan, size: 20),
          const SizedBox(width: 6),
          Expanded(child: Text(t.pickupAddress, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: _textPrimary), maxLines: 2, overflow: TextOverflow.ellipsis)),
        ]),
        const SizedBox(height: 4),
        Row(children: [
          Text('Solicitado ${_timeAgo(t.createdAt)}', style: const TextStyle(color: _textMuted, fontSize: 10)),
          const Spacer(),
          if (info.estimate != null)
            Text('\$${info.estimate!.finalFare.toStringAsFixed(0)}', style: const TextStyle(color: _cyan, fontWeight: FontWeight.w900, fontSize: 15)),
        ]),
        const SizedBox(height: 10),
        Row(children: [
          Expanded(
            child: OutlinedButton(
              onPressed: onReject,
              style: OutlinedButton.styleFrom(
                foregroundColor: _red, side: const BorderSide(color: _red),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                padding: const EdgeInsets.symmetric(vertical: 10),
              ),
              child: const Text('Rechazar', style: TextStyle(fontSize: 13)),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            flex: 2,
            child: ElevatedButton(
              onPressed: onAccept,
              style: ElevatedButton.styleFrom(
                backgroundColor: _green,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                textStyle: const TextStyle(fontWeight: FontWeight.w900),
                padding: const EdgeInsets.symmetric(vertical: 10),
              ),
              child: const Text('Aceptar viaje', style: TextStyle(color: Colors.white, fontSize: 13)),
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

class _FareItem extends StatelessWidget {
  final String label;
  final String value;
  const _FareItem({required this.label, required this.value});
  @override
  Widget build(BuildContext context) {
    return Column(children: [
      Text(value, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: _cyan)),
      Text(label, style: const TextStyle(fontSize: 10, color: _textMuted)),
    ]);
  }
}
