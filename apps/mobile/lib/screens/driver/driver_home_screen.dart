import 'dart:async';
import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../providers/auth_provider.dart';
import '../../services/trip_service.dart';
import '../../services/location_service.dart';
import '../../services/map_markers.dart';
import '../../services/pricing_engine.dart';
import '../../services/zone_service.dart';
import 'package:geolocator/geolocator.dart';
import '../../models/trip.dart';
import '../profile_screen.dart';
import '../trip_history_screen.dart';
import '../../theme/carsigo_theme.dart';
import '../../data/carsigo_urban_polygon.dart';

class DriverHomeScreen extends ConsumerStatefulWidget {
  const DriverHomeScreen({super.key});
  @override
  ConsumerState<DriverHomeScreen> createState() => _DriverHomeScreenState();
}

class _DriverHomeScreenState extends ConsumerState<DriverHomeScreen> {
  CarSiGoPalette get p => context.palette;

  final _tripService = TripService();
  final _engine = PricingEngine();
  GoogleMapController? _mapCtrl;
  BitmapDescriptor? _destIcon;

  bool _isAvailable = false;
  Trip? _activeTrip;
  List<PendingTripInfo> _tripInfos = [];
  bool _loadingTrips = true;

  /// Cache de estimaciones por viaje y de zona por celda (~110 m): evita
  /// repetir lookups a Firestore y recalculos de tarifa en cada snapshot
  /// del feed o en cada fix de GPS.
  final Map<String, PricingBreakdown?> _estimateCache = {};
  final Map<String, String?> _zoneCache = {};

  /// Descarta respuestas obsoletas si llega otro snapshot mientras se resuelve.
  int _resolveSeq = 0;

  /// Clave de la ultima ruta calculada y su marca de tiempo (throttle de
  /// Directions: no se pide una ruta nueva por cada 10 m de movimiento).
  String? _routeKey;
  DateTime _lastRouteAt = DateTime.fromMillisecondsSinceEpoch(0);

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
    _loadIcons();
  }

  Future<void> _loadIcons() async {
    _destIcon = await pinBitmap(const Color(0xFF00E5FF), Icons.flag, scale: 0.6);
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _mapCtrl?.dispose();
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
        _mapCtrl?.animateCamera(
          CameraUpdate.newLatLngZoom(LatLng(pos.latitude, pos.longitude), 15),
        );
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
      }
    }

    await _loadPendingTrips();
    _pendingSub = _tripService.subscribeToPendingTrips().listen((trips) {
      if (mounted) {
        _resolveTripInfos(trips);
      }
    }, onError: (Object e) {
      debugPrint('pending trips stream error: $e');
    });
  }

  Future<void> _resolveTripInfos(List<Trip> trips) async {
    final seq = ++_resolveSeq;
    // En paralelo: antes cada viaje esperaba el lookup de zona + tarifa en
    // serie, lo que multiplicaba la latencia del feed por N.
    final infos = await Future.wait(
      trips.map((t) async =>
          PendingTripInfo(trip: t, estimate: await _estimateFare(t))),
    );
    if (!mounted || seq != _resolveSeq) return;
    setState(() => _tripInfos = infos);
  }

  Future<PricingBreakdown?> _estimateFare(Trip trip) async {
    if (trip.distanceKm <= 0) return null;
    if (_estimateCache.containsKey(trip.id)) return _estimateCache[trip.id];
    try {
      final vehicleType =
          trip.vehicleType == 'car' ? VehicleType.car : VehicleType.moto;
      String? zoneId;
      if (trip.pickupLat != 0 || trip.pickupLng != 0) {
        final zoneKey =
            '${trip.pickupLat.toStringAsFixed(3)},${trip.pickupLng.toStringAsFixed(3)}';
        if (_zoneCache.containsKey(zoneKey)) {
          zoneId = _zoneCache[zoneKey];
        } else {
          final zone =
              await ZoneService().findActiveZone(trip.pickupLat, trip.pickupLng);
          zoneId = zone?.id;
          _zoneCache[zoneKey] = zoneId;
        }
      }
      final est = await _engine.calculateFare(
        vehicleType: vehicleType,
        distanceKm: trip.distanceKm,
        zoneId: zoneId,
        fromLat: trip.pickupLat,
        fromLng: trip.pickupLng,
        toLat: trip.dropoffLat,
        toLng: trip.dropoffLng,
      );
      _estimateCache[trip.id] = est;
      return est;
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
      if (!mounted) return;
      setState(() => _activeTrip = trip);
      if (trip.status == TripStatus.completed ||
          trip.status == TripStatus.cancelled) {
        setState(() {
          _activeTrip = null;
          _isAvailable = false;
          _routePoints = const [];
        });
        _routeKey = null;
        return;
      }
      // Solo se recalcula la ruta cuando cambia el estado o los puntos:
      // el snapshot se emite tambien por cambios de tarifa o driver_id.
      final key = '${trip.status.name}:${trip.pickupLat},${trip.pickupLng},'
          '${trip.dropoffLat},${trip.dropoffLng}';
      if (key != _routeKey) {
        _routeKey = key;
        _loadRouteFor(trip, force: true);
      }
    }, onError: (Object e) {
      debugPrint('active trip stream error: $e');
    });
  }

  Future<void> _loadRouteFor(Trip trip, {bool force = false}) async {
    final origin = _currentPos;
    if (origin == null) return;
    if (_loadingRoute) return;
    if (!force &&
        DateTime.now().difference(_lastRouteAt) < const Duration(seconds: 25)) {
      return;
    }
    final destLat = trip.status == TripStatus.inProgress
        ? (trip.dropoffLat ?? trip.pickupLat)
        : trip.pickupLat;
    final destLng = trip.status == TripStatus.inProgress
        ? (trip.dropoffLng ?? trip.pickupLng)
        : trip.pickupLng;
    if (destLat == 0 && destLng == 0) return;

    _lastRouteAt = DateTime.now();
    setState(() => _loadingRoute = true);
    try {
      final route = await LocationService.getRoute(
        fromLat: origin.latitude,
        fromLng: origin.longitude,
        toLat: destLat,
        toLng: destLng,
      );
      if (mounted) {
        setState(() => _routePoints = route.points
            .map((pt) => LatLng(pt.latitude, pt.longitude))
            .toList());
        if (route.points.isNotEmpty) {
          final mid = route.points[route.points.length ~/ 2];
          _mapCtrl?.animateCamera(
            CameraUpdate.newLatLngZoom(
              LatLng(mid.latitude, mid.longitude),
              14,
            ),
          );
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
    _loadRouteFor(trip, force: true);
  }

  Future<void> _rejectTrip(Trip trip) async {
    await _tripService.rejectTrip(trip.id);
    _loadPendingTrips();
  }

  /// Ignorar un viaje: solo lo quita de la vista local, NO modifica Firestore.
  /// El conductor no recibe penalización.
  void _ignoreTrip(Trip trip) {
    setState(() {
      _tripInfos.removeWhere((i) => i.trip.id == trip.id);
    });
  }

  Future<void> _sendCounterOffer(Trip trip, double counterOffer) async {
    final user = ref.read(currentUserProvider);
    if (user == null) return;
    try {
      await _tripService.sendCounterOffer(trip.id, user.uid, counterOffer);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Contraoferta enviada: \$${counterOffer.toStringAsFixed(0)}'), backgroundColor: Colors.amber),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
        );
      }
    }
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
      backgroundColor: p.bg,
      appBar: AppBar(
        title: Text('CarSiGo Conductor', style: TextStyle(fontWeight: FontWeight.w900, color: p.textPrimary, fontSize: 16)),
        centerTitle: true,
        backgroundColor: p.surface,
        foregroundColor: p.textPrimary,
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
    return Stack(children: [
      GoogleMap(
        onMapCreated: (c) => _mapCtrl = c,
        initialCameraPosition: CameraPosition(
          target: _currentPos ?? const LatLng(10.0, -75.0),
          zoom: 14,
        ),
        myLocationEnabled: true,
        myLocationButtonEnabled: false,
        zoomControlsEnabled: false,
        rotateGesturesEnabled: false,
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
          onIgnore: (t) => _ignoreTrip(t),
          onCounterOffer: (info, val) => _sendCounterOffer(info.trip, val),
          currentPos: _currentPos,
        ),
      ),
    ]);
  }

  Widget _buildActiveTripView() {
    final t = _activeTrip!;
    final markers = <Marker>{};
    final destLat = t.status == TripStatus.inProgress
        ? (t.dropoffLat ?? t.pickupLat)
        : t.pickupLat;
    final destLng = t.status == TripStatus.inProgress
        ? (t.dropoffLng ?? t.pickupLng)
        : t.pickupLng;
    if (destLat != 0 || destLng != 0) {
      markers.add(Marker(
        markerId: const MarkerId('dest'),
        position: LatLng(destLat, destLng),
        icon: _destIcon ??
            BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueCyan),
      ));
    }

    final canStart = t.status == TripStatus.accepted;
    final canComplete = t.status == TripStatus.inProgress;

    final lines = <Polyline>{};
    if (_routePoints.length >= 2) {
      lines.add(Polyline(
        polylineId: const PolylineId('route'),
        points: _routePoints,
        color: p.cyan,
        width: 5,
      ));
    } else if (_currentPos != null && (destLat != 0 || destLng != 0)) {
      lines.add(Polyline(
        polylineId: const PolylineId('route-fallback'),
        points: [_currentPos!, LatLng(destLat, destLng)],
        color: p.cyan.withAlpha(140),
        width: 3,
      ));
    }

    return Stack(children: [
      GoogleMap(
        onMapCreated: (c) => _mapCtrl = c,
        initialCameraPosition: CameraPosition(
          target: _currentPos ?? const LatLng(10.0, -75.0),
          zoom: 15,
        ),
        myLocationEnabled: true,
        myLocationButtonEnabled: false,
        zoomControlsEnabled: false,
        rotateGesturesEnabled: false,
        markers: markers,
        polylines: lines,
        polygons: {
          Polygon(
            polygonId: const PolygonId('urban-perimeter'),
            points: CarsigoUrbanPolygon.urbanPerimeter,
            fillColor: const Color(0xFF22C55E).withAlpha(30),
            strokeColor: const Color(0xFF22C55E),
            strokeWidth: 2,
          ),
        },
      ),
      Positioned(
        left: 0, right: 0, bottom: 0,
        child: Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: p.surface,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
            border: Border(top: BorderSide(color: p.border)),
          ),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Icon(Icons.directions_car, size: 40, color: p.cyan),
            SizedBox(height: 8),
            Text(t.statusLabel, style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: p.textPrimary)),
            SizedBox(height: 10),
            Row(children: [
              Icon(Icons.location_on, color: p.green, size: 18),
              SizedBox(width: 6),
              Expanded(child: Text(t.pickupAddress, style: TextStyle(color: p.textSecondary, fontSize: 13))),
            ]),
            if (t.dropoffAddress != null) ...[
              SizedBox(height: 4),
              Row(children: [
                Icon(Icons.flag, color: p.cyan, size: 18),
                SizedBox(width: 6),
                Expanded(child: Text(t.dropoffAddress!, style: TextStyle(color: p.textSecondary, fontSize: 13))),
              ]),
            ],
            const SizedBox(height: 12),
            if (canStart)
              SizedBox(
                width: double.infinity, height: 52,
                child: ElevatedButton(
                  onPressed: _startTrip,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: p.cyan, foregroundColor: p.bg,
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
                    backgroundColor: p.green, foregroundColor: Colors.white,
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

  /// Distancia en km entre la posicion actual del conductor y la recogida.
  /// Se calcula en el build de cada tarjeta visible (no en el feed completo).
  double? distanceToPickupKm(LatLng from) {
    if (trip.pickupLat == 0 && trip.pickupLng == 0) return null;
    final meters = Geolocator.distanceBetween(
      from.latitude,
      from.longitude,
      trip.pickupLat,
      trip.pickupLng,
    );
    return meters / 1000;
  }
}

class _IdleDriverView extends StatelessWidget {
  final bool isAvailable;
  final ValueChanged<bool> onToggle;
  final List<PendingTripInfo> pendingTrips;
  final bool loadingTrips;
  final void Function(PendingTripInfo) onAccept;
  final void Function(PendingTripInfo) onReject;
  final void Function(Trip) onIgnore;
  final Future<void> Function(PendingTripInfo, double) onCounterOffer;
  final LatLng? currentPos;

  const _IdleDriverView({
    required this.isAvailable,
    required this.onToggle,
    required this.pendingTrips,
    required this.loadingTrips,
    required this.onAccept,
    required this.onReject,
    required this.onIgnore,
    required this.onCounterOffer,
    this.currentPos,
  });

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Container(
      constraints: const BoxConstraints(maxHeight: 460),
      decoration: BoxDecoration(
        color: p.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        border: Border(top: BorderSide(color: p.border)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _buildAvailabilityCard(p),
            const SizedBox(height: 12),
            Row(children: [
              Text('Viajes disponibles',
                  style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w900,
                      color: p.textPrimary)),
              const Spacer(),
              if (isAvailable)
                Container(
                  width: 8,
                  height: 8,
                  decoration: BoxDecoration(
                      shape: BoxShape.circle, color: p.green),
                ),
            ]),
            const SizedBox(height: 8),
            _buildContent(p),
          ],
        ),
      ),
    );
  }

  Widget _buildAvailabilityCard(CarSiGoPalette p) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isAvailable ? p.surfaceLight : p.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
            color: isAvailable ? p.green : p.border, width: 2),
      ),
      child: Row(children: [
        Container(
          width: 48,
          height: 48,
          decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: isAvailable ? p.green : p.textMuted),
          child: const Icon(Icons.directions_car,
              color: Colors.white, size: 24),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(isAvailable ? 'Disponible' : 'Fuera de línea',
                    style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w900,
                        color: isAvailable ? p.green : p.textSecondary)),
                Text(
                    isAvailable
                        ? 'Recibirás solicitudes'
                        : 'Actívalo para recibir viajes',
                    style: TextStyle(fontSize: 11, color: p.textMuted)),
              ]),
        ),
        Switch(
            value: isAvailable,
            onChanged: onToggle,
            activeTrackColor: p.green,
            activeThumbColor: Colors.white),
      ]),
    );
  }

  Widget _buildContent(CarSiGoPalette p) {
    if (!isAvailable) {
      return _emptyBox(p, Icons.power_off, 'Activa el switch para comenzar');
    }
    if (loadingTrips) {
      return Padding(
        padding: const EdgeInsets.all(32),
        child: Center(
          child: CircularProgressIndicator(strokeWidth: 3, color: p.cyan),
        ),
      );
    }
    if (pendingTrips.isEmpty) {
      return _emptyBox(p, Icons.search_off, 'No hay viajes disponibles',
          subtitle: 'Te avisaremos cuando aparezca uno');
    }

    // Altura acotada + ListView.builder: solo se construyen las tarjetas
    // visibles, no las 20 del feed de golpe.
    final listHeight = (pendingTrips.length * 215.0).clamp(160.0, 280.0);
    return SizedBox(
      height: listHeight,
      child: ListView.builder(
        padding: EdgeInsets.zero,
        itemCount: pendingTrips.length,
        itemBuilder: (context, index) {
          final info = pendingTrips[index];
          return _PendingTripCard(
            info: info,
            onAccept: () => onAccept(info),
            onReject: () => onReject(info),
            onIgnore: () => onIgnore(info.trip),
            onCounterOffer: (val) => onCounterOffer(info, val),
            distanceToPickupKm: currentPos == null
                ? null
                : info.distanceToPickupKm(currentPos!),
          );
        },
      ),
    );
  }

  Widget _emptyBox(CarSiGoPalette p, IconData icon, String title,
      {String? subtitle}) {
    return Container(
      padding: const EdgeInsets.all(32),
      decoration: BoxDecoration(
          color: p.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: p.border)),
      child: Column(children: [
        Icon(icon, size: 40, color: p.textMuted),
        const SizedBox(height: 8),
        Text(title,
            textAlign: TextAlign.center,
            style: TextStyle(
                color: p.textMuted,
                fontWeight: FontWeight.w600,
                fontSize: 13)),
        if (subtitle != null) ...[
          const SizedBox(height: 2),
          Text(subtitle,
              style: TextStyle(color: p.textMuted, fontSize: 11)),
        ],
      ]),
    );
  }
}

class _PendingTripCard extends StatelessWidget {
  final PendingTripInfo info;
  final VoidCallback onAccept;
  final VoidCallback onReject;
  final VoidCallback onIgnore;
  final Future<void> Function(double)? onCounterOffer;
  final double? distanceToPickupKm;
  const _PendingTripCard({required this.info, required this.onAccept, required this.onReject, required this.onIgnore, this.onCounterOffer, this.distanceToPickupKm});

  static String _timeAgo(DateTime date) {
    final diff = DateTime.now().difference(date);
    if (diff.inSeconds < 60) return 'ahora';
    if (diff.inMinutes < 60) return 'hace ${diff.inMinutes} min';
    return 'hace ${diff.inHours}h';
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final t = info.trip;
    final isNegotiating = t.status == TripStatus.negotiating;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isNegotiating ? p.surface.withAlpha(200) : p.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: isNegotiating ? p.orange : p.border, width: isNegotiating ? 2 : 1),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Icon(Icons.location_on, color: isNegotiating ? p.orange : p.cyan, size: 20),
          SizedBox(width: 6),
          Expanded(child: Text(t.pickupAddress, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: p.textPrimary), maxLines: 2, overflow: TextOverflow.ellipsis)),
          if (isNegotiating)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(color: p.orange.withAlpha(30), borderRadius: BorderRadius.circular(8), border: Border.all(color: p.orange)),
              child: Text('NEGOCIANDO', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: p.orange)),
            ),
        ]),
        SizedBox(height: 4),
        Row(children: [
          Text('Solicitado ${_timeAgo(t.createdAt)}', style: TextStyle(color: p.textMuted, fontSize: 10)),
          const Spacer(),
          if (info.estimate != null)
            Text('\$${info.estimate!.finalFare.toStringAsFixed(0)}', style: TextStyle(color: p.cyan, fontWeight: FontWeight.w900, fontSize: 15)),
          if (distanceToPickupKm != null)
            Container(
              margin: const EdgeInsets.only(left: 8),
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(color: p.surfaceLight, borderRadius: BorderRadius.circular(6)),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                Icon(Icons.directions, size: 10, color: p.textMuted),
                const SizedBox(width: 3),
                Text('${distanceToPickupKm!.toStringAsFixed(1)} km', style: TextStyle(color: p.textMuted, fontSize: 10, fontWeight: FontWeight.w600)),
              ]),
            ),
        ]),
        if (isNegotiating) ...[
          SizedBox(height: 6),
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(color: p.orange.withAlpha(20), borderRadius: BorderRadius.circular(10), border: Border.all(color: p.orange.withAlpha(60))),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Oferta del pasajero: \$${t.fareOffered.toStringAsFixed(0)}', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: p.textPrimary)),
              SizedBox(height: 2),
              Text('Tu contraoferta: ${t.fareCounterOffer != null ? '\$${t.fareCounterOffer!.toStringAsFixed(0)}' : '—'}', style: TextStyle(fontSize: 12, color: p.textSecondary)),
              Text('Tarifa base (mínimo): \$${t.fareCalculated.toStringAsFixed(0)}', style: TextStyle(fontSize: 11, color: p.textMuted)),
            ]),
          ),
        ],
        const SizedBox(height: 10),
        if (isNegotiating) _buildNegotiatingWidgets(p, t, onCounterOffer),
        Row(children: [
          Expanded(
            child: OutlinedButton(
              onPressed: onIgnore,
              style: OutlinedButton.styleFrom(
                foregroundColor: p.textMuted, side: BorderSide(color: p.border),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                padding: const EdgeInsets.symmetric(vertical: 10),
              ),
              child: const Text('Ignorar', style: TextStyle(fontSize: 13)),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: OutlinedButton(
              onPressed: onReject,
              style: OutlinedButton.styleFrom(
                foregroundColor: p.red, side: BorderSide(color: p.red),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                padding: const EdgeInsets.symmetric(vertical: 10),
              ),
              child: const Text('Rechazar', style: TextStyle(fontSize: 13)),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            flex: 2,
            child: ElevatedButton(
              onPressed: onAccept,
              style: ElevatedButton.styleFrom(
                backgroundColor: isNegotiating ? p.orange : p.green,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                textStyle: const TextStyle(fontWeight: FontWeight.w900),
                padding: const EdgeInsets.symmetric(vertical: 10),
              ),
              child: Text(isNegotiating ? 'Aceptar oferta del pasajero' : 'Aceptar viaje', style: TextStyle(color: Colors.white, fontSize: 13)),
            ),
          ),
        ]),
      ]),
    );
  }

  Widget _buildNegotiatingWidgets(CarSiGoPalette p, Trip t, Future<void> Function(double)? onCounterOffer) {
    return Row(children: [
      Expanded(
        child: _CounterOfferField(onSubmit: onCounterOffer!, minFare: t.fareCalculated),
      ),
      const SizedBox(width: 10),
      Expanded(
        child: ElevatedButton(
          onPressed: () => onCounterOffer.call(t.fareCounterOffer ?? t.fareOffered),
          style: ElevatedButton.styleFrom(
            backgroundColor: p.orange,
            foregroundColor: p.bg,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            textStyle: const TextStyle(fontWeight: FontWeight.w900),
            padding: const EdgeInsets.symmetric(vertical: 10),
          ),
          child: const Text('Enviar contraoferta', style: TextStyle(fontSize: 13)),
        ),
      ),
    ]);
  }
}

class _CounterOfferField extends StatefulWidget {
  final Future<void> Function(double) onSubmit;
  final double minFare;
  const _CounterOfferField({required this.onSubmit, required this.minFare});

  @override
  State<_CounterOfferField> createState() => _CounterOfferFieldState();
}

class _CounterOfferFieldState extends State<_CounterOfferField> {
  final _controller = TextEditingController();
  String? _error;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _submit() {
    final value = double.tryParse(_controller.text.replaceAll(',', ''));
    if (value == null || value < widget.minFare) {
      setState(() => _error = 'Mínimo \$${widget.minFare.toStringAsFixed(0)}');
      return;
    }
    setState(() => _error = null);
    widget.onSubmit(value);
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return TextField(
      controller: _controller,
      keyboardType: TextInputType.number,
      decoration: InputDecoration(
        labelText: 'Contraoferta (\$)',
        hintText: 'Ej: 3500',
        errorText: _error,
        prefixIcon: Icon(Icons.attach_money, color: p.cyan, size: 20),
        filled: true,
        fillColor: p.surface,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: p.border)),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: p.cyan, width: 2)),
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      ),
      onSubmitted: (_) => _submit(),
    );
  }
}

class _FareItem extends StatelessWidget {
  final String label;
  final String value;
  const _FareItem({required this.label, required this.value});
  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Column(children: [
      Text(value, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: p.cyan)),
      Text(label, style: TextStyle(fontSize: 10, color: p.textMuted)),
    ]);
  }
}