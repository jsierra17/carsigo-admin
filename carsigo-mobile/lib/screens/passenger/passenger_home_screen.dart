import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import '../../models/trip.dart';
import '../../providers/auth_provider.dart';
import '../../services/trip_service.dart';
import '../../services/location_service.dart';
import '../../services/pricing_engine.dart';
import '../../services/zone_service.dart';
import '../profile_screen.dart';
import '../trip_history_screen.dart';

const _bg = Color(0xFF0a0a0b);
const _surface = Color(0xFF141416);
const _surfaceLight = Color(0xFF1c1c1e);
const _border = Color(0xFF2a2a2c);
const _cyan = Color(0xFF00E5FF);
const _green = Color(0xFF22C55E);
const _textPrimary = Color(0xFFFFFFFF);
const _textSecondary = Color(0xFF94949E);
const _textMuted = Color(0xFF52525B);

class PassengerHomeScreen extends ConsumerStatefulWidget {
  const PassengerHomeScreen({super.key});
  @override
  ConsumerState<PassengerHomeScreen> createState() => _PassengerHomeScreenState();
}

class _PassengerHomeScreenState extends ConsumerState<PassengerHomeScreen> {
  final _tripService = TripService();
  final _engine = PricingEngine();
  final _zoneService = ZoneService();
  final _mapCtrl = MapController();
  final _pickupCtrl = TextEditingController();
  final _destCtrl = TextEditingController();
  final _pickupFocus = FocusNode();
  final _destFocus = FocusNode();

  VehicleType _vehicleType = VehicleType.moto;
  Trip? _activeTrip;
  bool _loading = false;
  bool _loadingLocation = true;
  bool _locatingPickup = false;

  StreamSubscription? _tripSub;
  StreamSubscription<Position>? _posSub;

  LatLng? _currentPos;
  LatLng? _pickupPos;
  LatLng? _destPos;
  String? _pickupAddress;
  String? _destAddress;
  PricingBreakdown? _estimate;

  ZoneInfo? _currentZone;
  List<ZoneInfo> _allowedZones = [];
  bool _checkingZone = true;
  bool _inActiveZone = false;

  List<LatLng>? _routePoints;
  double _routeKm = 0;
  double _routeMin = 0;
  bool _routing = false;

  List<MapSuggestion> _pickupSuggestions = [];
  List<MapSuggestion> _destSuggestions = [];
  Timer? _pickupDebounce;
  Timer? _destDebounce;

  @override
  void initState() {
    super.initState();
    _initLocation();
    _loadActiveTrip();
    _pickupCtrl.addListener(_onPickupChanged);
    _destCtrl.addListener(_onDestChanged);
  }

  @override
  void dispose() {
    _mapCtrl.dispose();
    _pickupCtrl.dispose();
    _destCtrl.dispose();
    _pickupFocus.dispose();
    _destFocus.dispose();
    _tripSub?.cancel();
    _posSub?.cancel();
    _pickupDebounce?.cancel();
    _destDebounce?.cancel();
    super.dispose();
  }

  Future<void> _initLocation() async {
    try {
      final pos = await LocationService.getCurrentPosition();
      if (!mounted) return;
      final latLng = LatLng(pos.latitude, pos.longitude);
      setState(() {
        _currentPos = latLng;
        _loadingLocation = false;
      });
      _mapCtrl.move(latLng, 15);

      await _checkZone(pos.latitude, pos.longitude);

      final address = await LocationService.reverseGeocode(pos.latitude, pos.longitude);
      if (mounted) {
        setState(() {
          _pickupPos = latLng;
          _pickupAddress = address;
          _pickupCtrl.text = address.split(',').first;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _loadingLocation = false;
          _checkingZone = false;
        });
      }
    }

    _posSub = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 10,
      ),
    ).listen((pos) {
      if (!mounted) return;
      setState(() => _currentPos = LatLng(pos.latitude, pos.longitude));
      // Re-evalúa cobertura si aún no hay zona, para no quedar congelado
      // en "Servicio no disponible" por un fix inicial impreciso.
      if (_currentZone == null) {
        _checkZone(pos.latitude, pos.longitude);
      }
    });
  }

  Future<void> _checkZone(double lat, double lng) async {
    try {
      final zones = await _zoneService.findActiveAndAdjacentZones(lat, lng);
      if (mounted) {
        setState(() {
          _allowedZones = zones;
          _currentZone = zones.isNotEmpty ? zones.first : null;
          _inActiveZone = _currentZone != null;
          _checkingZone = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _currentZone = null; _allowedZones = [];
          _inActiveZone = false; _checkingZone = false;
        });
      }
    }
  }

  Future<void> _loadActiveTrip() async {
    final user = ref.read(currentUserProvider);
    if (user == null) return;
    final trip = await _tripService.getActivePassengerTrip(user.uid);
    if (mounted) setState(() => _activeTrip = trip);
    if (trip != null) _subscribeToTrip(trip.id);
  }

  void _subscribeToTrip(String tripId) {
    _tripSub?.cancel();
    _tripSub = _tripService.subscribeToTrip(tripId).listen((trip) {
      if (mounted) setState(() => _activeTrip = trip);
    });
  }

  void _onPickupChanged() {
    _pickupDebounce?.cancel();
    _pickupDebounce = Timer(const Duration(milliseconds: 500), () async {
      if (_pickupCtrl.text.length < 3) return;
      final suggestions = await LocationService.searchAddress(
        _pickupCtrl.text,
        zones: _allowedZones,
        userLat: _currentPos?.latitude,
        userLng: _currentPos?.longitude,
      );
      if (mounted) setState(() => _pickupSuggestions = suggestions);
    });
  }

  void _onDestChanged() {
    _destDebounce?.cancel();
    _destDebounce = Timer(const Duration(milliseconds: 500), () async {
      if (_destCtrl.text.length < 3) return;
      final suggestions = await LocationService.searchAddress(
        _destCtrl.text,
        zones: _allowedZones,
        userLat: _currentPos?.latitude,
        userLng: _currentPos?.longitude,
      );
      if (mounted) setState(() => _destSuggestions = suggestions);
    });
  }

  void _selectPickup(MapSuggestion s) {
    setState(() {
      _pickupPos = LatLng(s.lat, s.lng);
      _pickupAddress = s.placeName;
      _pickupCtrl.text = s.placeName.split(',').first;
      _pickupSuggestions = [];
      _pickupFocus.unfocus();
    });
    _recalculateEstimate();
  }

  void _selectDest(MapSuggestion s) {
    if (_allowedZones.isNotEmpty && !_allowedZones.any((z) => z.contains(s.lat, s.lng))) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('El destino está fuera de la zona de servicio'),
            backgroundColor: Colors.redAccent,
          ),
        );
      }
      return;
    }
    setState(() {
      _destPos = LatLng(s.lat, s.lng);
      _destAddress = s.placeName;
      _destCtrl.text = s.placeName.split(',').first;
      _destSuggestions = [];
      _destFocus.unfocus();
    });
    _recalculateEstimate();
  }

  Future<void> _locatePickup() async {
    if (_currentPos == null) return;
    setState(() => _locatingPickup = true);
    final address = await LocationService.reverseGeocode(_currentPos!.latitude, _currentPos!.longitude);
    if (mounted) {
      setState(() {
        _pickupPos = _currentPos;
        _pickupAddress = address;
        _pickupCtrl.text = address.split(',').first;
        _locatingPickup = false;
      });
      _recalculateEstimate();
    }
  }

  Future<void> _recalculateEstimate() async {
    if (_pickupPos == null || _destPos == null) {
      setState(() { _estimate = null; _routePoints = null; _routeKm = 0; _routeMin = 0; _routing = false; });
      return;
    }

    setState(() => _routing = true);
    final route = await LocationService.getRoute(
      fromLat: _pickupPos!.latitude,
      fromLng: _pickupPos!.longitude,
      toLat: _destPos!.latitude,
      toLng: _destPos!.longitude,
    );
    final distance = route.distanceKm;
    try {
      final est = await _engine.calculateFare(
        vehicleType: _vehicleType,
        distanceKm: distance,
      );
      if (mounted) {
        setState(() {
          _estimate = est;
          _routePoints = route.points;
          _routeKm = route.distanceKm;
          _routeMin = route.durationMin;
          _routing = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() { _estimate = null; _routing = false; });
    }
  }

  double _calculateDistance(LatLng a, LatLng b) {
    const R = 6371;
    final dLat = _deg2rad(b.latitude - a.latitude);
    final dLon = _deg2rad(b.longitude - a.longitude);
    final sinDLat = _dSin(dLat / 2);
    final sinDLon = _dSin(dLon / 2);
    final h = sinDLat * sinDLat +
        sinDLon * sinDLon * _dCos(_deg2rad(a.latitude)) * _dCos(_deg2rad(b.latitude));
    return 2 * R * _dAsin(_dSqrt(h));
  }

  double _deg2rad(double d) => d * 3.141592653589793 / 180;
  double _dSin(double x) => _dApprox(x, (v) => v - v * v * v / 6 + v * v * v * v * v / 120);
  double _dCos(double x) => _dApprox(x, (v) => 1 - v * v / 2 + v * v * v * v / 24);
  double _dAsin(double x) => x <= -1 ? -3.141592653589793 / 2 : x >= 1 ? 3.141592653589793 / 2 : _dApprox(x, (v) => v + v * v * v / 6 + v * v * v * v * v * 3 / 40);
  double _dSqrt(double x) => x <= 0 ? 0 : _dApprox(x, (v) {
        double s = v / 2;
        for (int i = 0; i < 10; i++) {
          s = (s + v / s) / 2;
        }
        return s;
      });
  double _dApprox(double x, double Function(double) fn) => fn(x);

  Future<void> _requestTrip() async {
    final user = ref.read(currentUserProvider);
    if (user == null || _pickupPos == null || _pickupAddress == null) return;

    setState(() => _loading = true);
    try {
      final distance = _routeKm > 0 ? _routeKm
          : (_destPos != null ? _calculateDistance(_pickupPos!, _destPos!) : 0.0);
      final trip = await _tripService.createTrip(
        passengerId: user.uid,
        pickupAddress: _pickupAddress!,
        dropoffAddress: _destAddress,
        pickupLat: _pickupPos!.latitude,
        pickupLng: _pickupPos!.longitude,
        dropoffLat: _destPos?.latitude,
        dropoffLng: _destPos?.longitude,
        distanceKm: distance,
        vehicleType: _vehicleType == VehicleType.car ? 'car' : 'moto',
      );
      setState(() { _activeTrip = trip; _loading = false; });
      _subscribeToTrip(trip.id);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
        );
        setState(() => _loading = false);
      }
    }
  }

  Future<void> _cancelTrip() async {
    if (_activeTrip == null) return;
    await _tripService.cancelTrip(_activeTrip!.id);
    setState(() => _activeTrip = null);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _bg,
      appBar: AppBar(
        title: const Text('CarSiGo', style: TextStyle(fontWeight: FontWeight.w900, color: _textPrimary, fontSize: 18)),
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
      body: _activeTrip != null ? _buildActiveTripView() : _buildMainView(),
    );
  }

  Widget _buildMainView() {
    if (_checkingZone || _loadingLocation) {
      return const Center(child: CircularProgressIndicator(strokeWidth: 3, color: _cyan));
    }

    if (!_inActiveZone) {
      return Stack(children: [
        _buildMap(),
        Positioned(
          left: 0, right: 0, bottom: 0,
          child: Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: _surface,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
              border: Border(top: BorderSide(color: _border)),
            ),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              Icon(Icons.location_off, size: 48, color: Colors.orange),
              const SizedBox(height: 12),
              const Text('Servicio no disponible', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: _textPrimary)),
              const SizedBox(height: 6),
              const Text('Actualmente no tenemos cobertura\nen tu área.', style: TextStyle(color: _textMuted, fontSize: 13), textAlign: TextAlign.center),
              if (_currentPos != null)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text('${_currentPos!.latitude.toStringAsFixed(4)}, ${_currentPos!.longitude.toStringAsFixed(4)}', style: TextStyle(color: _textMuted, fontSize: 10)),
                ),
            ]),
          ),
        ),
      ]);
    }

    return Stack(children: [
      _buildMap(),
      Positioned(
        left: 0, right: 0, bottom: 0,
        child: _buildRequestForm(),
      ),
    ]);
  }

  Widget _buildMap() {
    final markers = <Marker>[];
    if (_currentPos != null) {
      markers.add(Marker(
        point: _currentPos!,
        child: const Icon(Icons.my_location, color: Colors.blue, size: 24),
      ));
    }
    if (_pickupPos != null) {
      markers.add(Marker(
        point: _pickupPos!,
        child: const Icon(Icons.location_on, color: _green, size: 32),
      ));
    }
    if (_destPos != null) {
      markers.add(Marker(
        point: _destPos!,
        child: const Icon(Icons.flag, color: _cyan, size: 32),
      ));
    }

    final lines = <Polyline>[];
    if ((_routePoints?.length ?? 0) >= 2) {
      lines.add(Polyline(
        points: _routePoints!,
        color: _cyan,
        strokeWidth: 4,
      ));
    } else if (_pickupPos != null && _destPos != null) {
      lines.add(Polyline(
        points: [_pickupPos!, _destPos!],
        color: _cyan.withAlpha(128),
        strokeWidth: 2,
      ));
    } else if (_pickupPos != null) {
      lines.add(Polyline(
        points: [_pickupPos!],
        color: _green.withAlpha(160),
        strokeWidth: 2,
      ));
    }

    final polygons = <Polygon>[];
    for (final zone in _allowedZones) {
      for (final polygon in zone.polygons) {
        polygons.add(Polygon(
          points: polygon.map((pt) => LatLng(pt[0], pt[1])).toList(),
          color: _cyan.withAlpha(16),
          borderColor: _cyan.withAlpha(90),
          borderStrokeWidth: 1,
        ));
      }
    }

    return FlutterMap(
      mapController: _mapCtrl,
      options: MapOptions(
        initialCenter: _currentPos ?? const LatLng(10.0, -75.0),
        initialZoom: 15,
        interactionOptions: const InteractionOptions(
          flags: InteractiveFlag.all & ~InteractiveFlag.rotate,
        ),
      ),
      children: [
        TileLayer(
          urlTemplate: 'https://api.mapbox.com/styles/v1/mapbox/navigation-day-v1/tiles/256/{z}/{x}/{y}@2x?access_token=${LocationService.mapboxToken}',
          userAgentPackageName: 'com.carsigo.app',
        ),
        PolygonLayer(polygons: polygons),
        PolylineLayer(polylines: lines),
        MarkerLayer(markers: markers),
      ],
    );
  }

  Widget _buildRequestForm() {
    return Container(
      decoration: BoxDecoration(
        color: _surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        border: Border(top: BorderSide(color: _border)),
      ),
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (_currentZone != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Row(children: [
                  Icon(Icons.radar, size: 16, color: _cyan),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      'Estás en ${_currentZone!.municipalityName}',
                      style: const TextStyle(color: _textSecondary, fontSize: 12, fontWeight: FontWeight.w600),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ]),
              ),
            _buildSuggestionField(
              controller: _pickupCtrl,
              focusNode: _pickupFocus,
              hint: '¿Dónde te recogemos?',
              icon: Icons.location_on,
              iconColor: _green,
              suggestions: _pickupSuggestions,
              onSelect: _selectPickup,
              onLocate: _locatePickup,
              locating: _locatingPickup,
            ),
            const SizedBox(height: 10),
            _buildSuggestionField(
              controller: _destCtrl,
              focusNode: _destFocus,
              hint: '¿A dónde vas?',
              icon: Icons.location_on,
              iconColor: _cyan,
              suggestions: _destSuggestions,
              onSelect: _selectDest,
            ),
            const SizedBox(height: 16),
            Row(children: [
              _VehicleOption(
                icon: Icons.motorcycle, label: 'Moto',
                selected: _vehicleType == VehicleType.moto,
                onTap: () { setState(() => _vehicleType = VehicleType.moto); _recalculateEstimate(); },
              ),
              const SizedBox(width: 12),
              _VehicleOption(
                icon: Icons.directions_car, label: 'Carro',
                selected: _vehicleType == VehicleType.car,
                onTap: () { setState(() => _vehicleType = VehicleType.car); _recalculateEstimate(); },
              ),
            ]),
            if (_estimate != null) _buildEstimateCard(),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity, height: 52,
              child: ElevatedButton(
                onPressed: _loading || _pickupPos == null ? null : _requestTrip,
                style: ElevatedButton.styleFrom(
                  backgroundColor: _cyan, foregroundColor: _bg,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900),
                ),
                child: _loading
                    ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2, color: _bg))
                    : Text(_estimate != null
                        ? 'Solicitar viaje — \$${_estimate!.finalFare.toStringAsFixed(0)}'
                        : 'Solicitar viaje'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSuggestionField({
    required TextEditingController controller,
    required FocusNode focusNode,
    required String hint,
    required IconData icon,
    required Color iconColor,
    required List<MapSuggestion> suggestions,
    required void Function(MapSuggestion) onSelect,
    VoidCallback? onLocate,
    bool locating = false,
  }) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        TextField(
          controller: controller,
          focusNode: focusNode,
          decoration: InputDecoration(
            hintText: hint,
            prefixIcon: Icon(icon, color: iconColor),
            suffixIcon: onLocate != null
                ? (locating
                    ? const Padding(padding: EdgeInsets.all(12), child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: _cyan)))
                    : IconButton(icon: const Icon(Icons.my_location, size: 20), color: _textMuted, onPressed: onLocate))
                : null,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
            filled: true,
            fillColor: _surfaceLight,
            hintStyle: const TextStyle(color: _textMuted),
            contentPadding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
          ),
          style: const TextStyle(color: _textPrimary, fontSize: 14),
        ),
        if (suggestions.isNotEmpty)
          Container(
            decoration: BoxDecoration(
              color: _surfaceLight,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: _border),
            ),
            constraints: const BoxConstraints(maxHeight: 180),
            child: ListView.builder(
              shrinkWrap: true,
              itemCount: suggestions.length,
              itemBuilder: (_, i) {
                final s = suggestions[i];
                return ListTile(
                  dense: true,
                  leading: Icon(Icons.location_on, color: _textMuted, size: 18),
                  title: Text(s.placeName, style: const TextStyle(color: _textPrimary, fontSize: 13), maxLines: 2, overflow: TextOverflow.ellipsis),
                  onTap: () => onSelect(s),
                );
              },
            ),
          ),
      ],
    );
  }

  Widget _buildEstimateCard() {
    final e = _estimate!;
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(top: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: _surfaceLight,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _border),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Text('Tarifa estimada', style: TextStyle(color: _textSecondary, fontSize: 13)),
          Text('\$${e.finalFare.toStringAsFixed(0)}', style: const TextStyle(color: _cyan, fontSize: 22, fontWeight: FontWeight.w900)),
        ]),
        const SizedBox(height: 6),
        Text(
          _routing
              ? 'Calculando ruta…'
              : '${_routeKm.toStringAsFixed(1)} km • ${_routeMin.round()} min${e.distanceKm > e.includedKm ? ' • ${(e.distanceKm - e.includedKm).toStringAsFixed(1)} km extra' : ''}',
          style: TextStyle(color: _textMuted, fontSize: 11)),
        if (e.dynamicRuleName != null)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(color: Colors.orange.withAlpha(30), borderRadius: BorderRadius.circular(4), border: Border.all(color: Colors.orange.withAlpha(80))),
              child: Text('×${e.dynamicMultiplier.toStringAsFixed(2)} • ${e.dynamicRuleName}', style: const TextStyle(color: Colors.orange, fontSize: 10)),
            ),
          ),
      ]),
    );
  }

  Widget _buildActiveTripView() {
    final t = _activeTrip!;
    final markers = <Marker>[];
    if (_currentPos != null) {
      markers.add(Marker(point: _currentPos!, child: const Icon(Icons.my_location, color: Colors.blue, size: 24)));
    }

    return Stack(children: [
      FlutterMap(
        mapController: _mapCtrl,
        options: MapOptions(
          initialCenter: _currentPos ?? const LatLng(10.0, -75.0),
          initialZoom: 15,
        ),
        children: [
          TileLayer(
            urlTemplate: 'https://api.mapbox.com/styles/v1/mapbox/navigation-day-v1/tiles/256/{z}/{x}/{y}@2x?access_token=${LocationService.mapboxToken}',
            userAgentPackageName: 'com.carsigo.app',
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
            Icon(
              t.status == TripStatus.pending ? Icons.hourglass_bottom
                  : t.status == TripStatus.accepted ? Icons.directions_car
                  : t.status == TripStatus.inProgress ? Icons.navigation
                  : Icons.check_circle,
              size: 40, color: _cyan,
            ),
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
                const Icon(Icons.location_on, color: _cyan, size: 18),
                const SizedBox(width: 6),
                Expanded(child: Text(t.dropoffAddress!, style: const TextStyle(color: _textSecondary, fontSize: 13))),
              ]),
            ],
            if (t.fareAmount > 0) ...[
              const SizedBox(height: 8),
              Text('\$${t.fareAmount.toStringAsFixed(0)}', style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w900, color: _cyan)),
            ],
            const SizedBox(height: 12),
            if (t.status == TripStatus.pending || t.status == TripStatus.accepted)
              SizedBox(
                width: double.infinity, height: 48,
                child: OutlinedButton(
                  onPressed: _cancelTrip,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.redAccent,
                    side: const BorderSide(color: Colors.redAccent),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: const Text('Cancelar viaje', style: TextStyle(fontWeight: FontWeight.w700)),
                ),
              ),
          ]),
        ),
      ),
    ]);
  }
}

class _VehicleOption extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;
  const _VehicleOption({required this.icon, required this.label, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 14),
          decoration: BoxDecoration(
            color: selected ? _surfaceLight : _surface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: selected ? _cyan : _border, width: selected ? 2 : 1),
          ),
          child: Column(children: [
            Icon(icon, size: 28, color: selected ? _cyan : _textMuted),
            const SizedBox(height: 4),
            Text(label, style: TextStyle(color: selected ? _cyan : _textMuted, fontWeight: FontWeight.w700, fontSize: 13)),
          ]),
        ),
      ),
    );
  }
}
