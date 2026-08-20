import 'dart:async';
import 'dart:ui' show ImageFilter;
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
import 'place_search_screen.dart';
import '../../theme/carsigo_theme.dart';

const _bg = CarSiGoColors.bg;
const _surface = CarSiGoColors.surface;
const _border = CarSiGoColors.border;
const _cyan = CarSiGoColors.cyan;
const _green = CarSiGoColors.green;
const _textPrimary = CarSiGoColors.textPrimary;
const _textSecondary = CarSiGoColors.textSecondary;
const _textMuted = CarSiGoColors.textMuted;

const _vehicleMotoImg = 'assets/vehicles/Moto.png';
const _vehicleAutoImg = 'assets/vehicles/Carro.png';
const _surfaceHigh = Color(0xFF2A2A2A);
const _glass = Color(0xD91E1E1E);
const _sheetGlass = Color(0x2E131313);
const _onPrimaryTeal = Color(0xFF00363D);

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
  final _scaffoldKey = GlobalKey<ScaffoldState>();
  final _pickupCtrl = TextEditingController();
  final _destCtrl = TextEditingController();
  // Posición en vivo del usuario: solo el marcador se reconstruye con cada
  // fix de GPS (evita rebuilds de toda la pantalla en cada actualización).
  final _posNotifier = ValueNotifier<LatLng?>(null);

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
  double? _offerFare;

  ZoneInfo? _currentZone;
  List<ZoneInfo> _allowedZones = [];
  bool _checkingZone = true;
  bool _inActiveZone = false;
  bool _userInUrban = false;

  List<LatLng>? _routePoints;
  bool _routeHasRoad = false;
  double _routeKm = 0;
  double _routeMin = 0;

  @override
  void initState() {
    super.initState();
    _initLocation();
    _loadActiveTrip();
  }

  @override
  void dispose() {
    _posNotifier.dispose();
    _mapCtrl.dispose();
    _pickupCtrl.dispose();
    _destCtrl.dispose();
    _tripSub?.cancel();
    _posSub?.cancel();
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
      _posNotifier.value = latLng;
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
      _currentPos = LatLng(pos.latitude, pos.longitude);
      // Solo se actualiza el marcador (sin rebuild global de la pantalla).
      _posNotifier.value = _currentPos;
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
          _userInUrban = zones.any((z) => z.containsUrban(lat, lng));
          _checkingZone = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _currentZone = null; _allowedZones = [];
          _inActiveZone = false; _userInUrban = false; _checkingZone = false;
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

  void _openPlaceSearch({required bool pickupTarget}) {
    Navigator.of(context).push<MapSuggestion>(
      MaterialPageRoute(
        builder: (_) => PlaceSearchScreen(
          hint: pickupTarget ? '¿Dónde te recogemos?' : '¿A dónde vas?',
          initialText: pickupTarget ? _pickupCtrl.text : _destCtrl.text,
          zones: _allowedZones,
          userLat: _currentPos?.latitude,
          userLng: _currentPos?.longitude,
        ),
      ),
    ).then((s) {
      if (s == null || !mounted) return;
      if (pickupTarget) {
        _selectPickup(s);
      } else {
        _selectDest(s);
      }
    });
  }

  void _selectPickup(MapSuggestion s) {
    if (!_isInServiceArea(s.lat, s.lng)) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('El punto de recogida está fuera del casco urbano'),
            backgroundColor: Colors.redAccent,
          ),
        );
      }
      return;
    }
    setState(() {
      _pickupPos = LatLng(s.lat, s.lng);
      _pickupAddress = s.placeName;
      _pickupCtrl.text = s.placeName.split(',').first;
    });
    _recalculateEstimate();
    _fitToRoute();
  }

  void _selectDest(MapSuggestion s) {
    if (!_isInServiceArea(s.lat, s.lng)) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('El destino está fuera del casco urbano de servicio'),
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
    });
    _recalculateEstimate();
    _fitToRoute();
  }

  /// El punto debe caer dentro de la zona (polígono) y dentro del radio
  /// urbano de alguna zona activa (casco urbano + alrededores cercanos).
  bool _isInServiceArea(double lat, double lng) {
    if (_allowedZones.isEmpty) return true;
    return _allowedZones.any((z) => z.contains(lat, lng) && z.containsUrban(lat, lng));
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
      setState(() {
        _estimate = null; _routePoints = null; _routeHasRoad = false;
        _routeKm = 0; _routeMin = 0;
      });
      return;
    }

    RouteInfo route;
    try {
      route = await LocationService.getRoute(
        fromLat: _pickupPos!.latitude,
        fromLng: _pickupPos!.longitude,
        toLat: _destPos!.latitude,
        toLng: _destPos!.longitude,
      );
    } catch (e) {
      debugPrint('getRoute error: $e');
      route = LocationService.fallbackRoute(
        _pickupPos!.latitude,
        _pickupPos!.longitude,
        _destPos!.latitude,
        _destPos!.longitude,
      );
    }
    final distance = route.distanceKm;
    try {
      final est = await _engine.calculateFare(
        vehicleType: _vehicleType,
        distanceKm: distance,
        zoneId: _currentZone?.id,
      );
      if (mounted) {
        setState(() {
          _estimate = est;
          _offerFare = null; // la oferta vuelve a la tarifa base al recalcular
          _routePoints = route.points;
          _routeHasRoad = route.hasRoad;
          _routeKm = route.distanceKm;
          _routeMin = route.durationMin;
        });
      }
    } catch (e) {
      debugPrint('calculateFare error: $e');
      if (mounted) setState(() { _estimate = null; });
    }
  }

  void _fitToRoute() {
    if (_pickupPos == null || _destPos == null) return;
    _mapCtrl.fitCamera(CameraFit.bounds(
      bounds: LatLngBounds.fromPoints([_pickupPos!, _destPos!]),
      padding: const EdgeInsets.fromLTRB(120, 140, 120, 260),
    ));
  }

  Future<void> _requestTrip() async {
    final user = ref.read(currentUserProvider);
    if (user == null || _pickupPos == null || _pickupAddress == null) return;
    if (_destPos == null) return;
    if (!_isInServiceArea(_destPos!.latitude, _destPos!.longitude) ||
        !_isInServiceArea(_pickupPos!.latitude, _pickupPos!.longitude)) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Solicitud fuera del casco urbano de servicio'),
            backgroundColor: Colors.redAccent,
          ),
        );
      }
      return;
    }

    setState(() => _loading = true);
    try {
      final distance = _routeKm > 0
          ? _routeKm
          : (_destPos != null
              ? const Distance().as(LengthUnit.Kilometer, _pickupPos!, _destPos!)
              : 0.0);
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
        fareAmount: _offerFare ?? _estimate?.finalFare,
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
      key: _scaffoldKey,
      drawer: _buildDrawer(),
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
            padding: EdgeInsets.fromLTRB(24, 24, 24, 24 + MediaQuery.of(context).viewPadding.bottom),
            decoration: BoxDecoration(
              color: _surface,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
              border: Border(top: BorderSide(color: _border)),
            ),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              const Icon(Icons.location_off, size: 48, color: Colors.orange),
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

    // Estilo del diseño: mapa a pantalla completa, botón de menú arriba a la
    // izquierda, buscador flotante debajo, botón de localización al centro
    // derecho y panel inferior con vehículo + tarifa negociable + CTA.
    // El buscador y el panel SIEMPRE están visibles con zona activa (la
    // validación urbana bloquea solo destinos/recogidas fuera del casco).
    final topInset = MediaQuery.of(context).padding.top + 8;
    return Stack(children: [
      _buildMap(),
      Positioned(
        left: 16,
        right: 16,
        top: topInset,
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          _buildMenuButton(),
          const SizedBox(height: 12),
          _buildSearchCard(),
          if (!_userInUrban) ...[
            const SizedBox(height: 8),
            _buildUrbanWarning(),
          ],
        ]),
      ),
      Positioned(
        right: 16,
        top: MediaQuery.of(context).size.height / 2 - 24,
        child: _buildLocateButton(),
      ),
      Positioned(
        left: 0, right: 0, bottom: 0,
        child: _buildBottomPanel(),
      ),
    ]);
  }

  /// Botón flotante del menú (esquina superior izquierda, estilo del
  /// diseño): abre el drawer lateral con Perfil e Historial.
  Widget _buildMenuButton() {
    return Material(
      color: _glass,
      shape: CircleBorder(side: BorderSide(color: _cyan, width: 1.5)),
      elevation: 6,
      shadowColor: _cyan.withValues(alpha: 0.35),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: () => _scaffoldKey.currentState?.openDrawer(),
        child: const SizedBox(
          width: 48, height: 48,
          child: Icon(Icons.menu, size: 24, color: _cyan),
        ),
      ),
    );
  }

  /// Botón flotante circular con borde neón (centro-derecha): recentra la
  /// cámara sobre la ubicación actual del usuario.
  Widget _buildLocateButton() {
    return Material(
      color: _glass,
      shape: CircleBorder(side: BorderSide(color: _cyan, width: 1.5)),
      elevation: 6,
      shadowColor: _cyan.withValues(alpha: 0.35),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: () {
          if (_currentPos != null) _mapCtrl.move(_currentPos!, 15);
        },
        child: const SizedBox(
          width: 48, height: 48,
          child: Icon(Icons.near_me, size: 22, color: _cyan),
        ),
      ),
    );
  }

  /// Drawer lateral: accesos a Perfil e Historial (sustituye a los botones
  /// flotantes de la esquina superior derecha).
  Widget _buildDrawer() {
    final user = ref.read(currentUserProvider);
    final name = (user?.displayName ?? '').isNotEmpty
        ? user!.displayName!
        : (user?.email ?? 'Pasajero');
    return Drawer(
      backgroundColor: _surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.horizontal(right: Radius.circular(24)),
      ),
      child: SafeArea(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text(
                'CarSiGo',
                style: TextStyle(color: _cyan, fontSize: 22, fontWeight: FontWeight.w900, letterSpacing: 0.5),
              ),
              const SizedBox(height: 4),
              Text(
                name,
                style: const TextStyle(color: _textMuted, fontSize: 13, fontWeight: FontWeight.w500),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ]),
          ),
          const Divider(height: 1, color: _border),
          ListTile(
            leading: const Icon(Icons.person_outline, color: _cyan),
            title: const Text('Mi perfil', style: TextStyle(fontWeight: FontWeight.w600)),
            onTap: () {
              Navigator.pop(context);
              Navigator.push(context, MaterialPageRoute(builder: (_) => const ProfileScreen()));
            },
          ),
          ListTile(
            leading: const Icon(Icons.history_rounded, color: _cyan),
            title: const Text('Historial de viajes', style: TextStyle(fontWeight: FontWeight.w600)),
            onTap: () {
              Navigator.pop(context);
              Navigator.push(context, MaterialPageRoute(builder: (_) => const TripHistoryScreen()));
            },
          ),
        ]),
      ),
    );
  }

  Widget _buildUrbanWarning() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0x1AFFB74D),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0x66FFB74D)),
      ),
      child: const Row(children: [
        Icon(Icons.warning_amber_rounded, size: 18, color: Color(0xFFFFB74D)),
        SizedBox(width: 8),
        Expanded(
          child: Text(
            'Estás fuera del casco urbano: solo puedes pedir viajes con '
            'destino dentro de él',
            style: TextStyle(color: Color(0xFFFFB74D), fontSize: 12, fontWeight: FontWeight.w600, height: 1.3),
          ),
        ),
      ]),
    );
  }

  Widget _buildMap() {
    final lines = <Polyline>[];
    // Solo se dibuja la ruta cuando es una ruta real por carretera: una línea
    // recta entre puntos engañaría al usuario (nunca se traza recto).
    if (_routeHasRoad && (_routePoints?.length ?? 0) >= 2) {
      lines.add(Polyline(
        points: _routePoints!,
        color: _cyan,
        strokeWidth: 4,
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
          urlTemplate: 'https://api.mapbox.com/styles/v1/mapbox/navigation-night-v1/tiles/256/{z}/{x}/{y}@2x?access_token=${LocationService.mapboxToken}',
          userAgentPackageName: 'com.carsigo.app',
        ),
        PolygonLayer(polygons: polygons),
        PolylineLayer(polylines: lines),
        // Solo esta capa se reconstruye con cada fix de GPS.
        ValueListenableBuilder<LatLng?>(
          valueListenable: _posNotifier,
          builder: (_, pos, _) {
            final markers = <Marker>[
              if (_pickupPos != null)
                Marker(point: _pickupPos!, child: _pinMarker(Icons.location_on, _green)),
              if (_destPos != null)
                Marker(point: _destPos!, child: _pinMarker(Icons.flag, _cyan)),
              if (pos != null)
                Marker(point: pos, child: _currentPosMarker()),
            ];
            return MarkerLayer(markers: markers);
          },
        ),
      ],
    );
  }

  /// Marcador de la ubicación actual: personita pequeña (estilo "estás aquí"),
  /// centrada exactamente sobre la posición. Tamaño fijo en pantalla.
  Widget _currentPosMarker() {
    return Container(
      width: 32,
      height: 32,
      decoration: BoxDecoration(
        color: Colors.white,
        shape: BoxShape.circle,
        boxShadow: [
          BoxShadow(color: Colors.black45, blurRadius: 6, offset: const Offset(0, 2)),
        ],
      ),
      child: const Icon(Icons.person, color: Colors.blue, size: 20),
    );
  }

  Widget _pinMarker(IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(7),
      decoration: BoxDecoration(
        color: color,
        shape: BoxShape.circle,
        border: Border.all(color: Colors.white, width: 2.5),
        boxShadow: [
          BoxShadow(color: Colors.black38, blurRadius: 8, offset: const Offset(0, 3)),
        ],
      ),
      child: Icon(icon, color: Colors.white, size: 16),
    );
  }

  /// Tarjeta de búsqueda flotante (estilo del diseño): fila de origen arriba
  /// ("Tu ubicación actual" con icono verde) y destino debajo, más grande.
  Widget _buildSearchCard() {
    return ClipRRect(
      borderRadius: BorderRadius.circular(20),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
        child: Container(
          decoration: BoxDecoration(
            color: _glass,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
          ),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            _buildSearchRow(
              text: _pickupCtrl.text,
              hint: 'Tu ubicación actual',
              icon: Icons.my_location,
              iconColor: _green,
              onTap: () => _openPlaceSearch(pickupTarget: true),
              onLocate: _locatePickup,
              locating: _locatingPickup,
            ),
            Divider(height: 1, thickness: 1, color: Colors.white.withValues(alpha: 0.05)),
            _buildSearchRow(
              text: _destCtrl.text,
              hint: '¿A dónde vas?',
              icon: Icons.search,
              iconColor: _cyan,
              emphasized: true,
              onTap: () => _openPlaceSearch(pickupTarget: false),
            ),
          ]),
        ),
      ),
    );
  }

  Widget _buildSearchRow({
    required String text,
    required String hint,
    required IconData icon,
    required Color iconColor,
    required VoidCallback onTap,
    VoidCallback? onLocate,
    bool locating = false,
    bool emphasized = false,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(20),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        child: Row(children: [
          Icon(icon, size: 22, color: iconColor),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              text.isNotEmpty ? text : hint,
              style: TextStyle(
                color: text.isNotEmpty ? _textPrimary : _textMuted.withValues(alpha: 0.6),
                fontSize: emphasized
                    ? (text.isNotEmpty ? 18 : 22)
                    : 14,
                fontWeight: text.isNotEmpty
                    ? (emphasized ? FontWeight.w800 : FontWeight.w600)
                    : FontWeight.w700,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          if (onLocate != null)
            locating
                ? const Padding(
                    padding: EdgeInsets.all(6),
                    child: SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: _cyan)),
                  )
                : IconButton(
                    icon: const Icon(Icons.gps_fixed, size: 18),
                    color: _textMuted,
                    onPressed: onLocate,
                  )
          else
            const Icon(Icons.chevron_right, size: 20, color: _textMuted),
        ]),
      ),
    );
  }

  /// Bottom sheet flotante (estilo del diseño): asa, selector de vehículos
  /// (iconos sin contenedor, centrados), fila de ruta, píldora de oferta
  /// (-/+/escribible) y CTA "SOLICITAR VIAJE" a ancho completo. El fondo es
  /// translúcido: el mapa se ve a través del panel.
  Widget _buildBottomPanel() {
    final hasDest = _destPos != null;
    final base = _estimate?.finalFare;
    final offer = _offerFare ?? base;
    final showRoute = hasDest && _estimate != null;
    return ClipRRect(
      borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
        child: Container(
          decoration: BoxDecoration(
            color: _sheetGlass,
            border: Border(top: BorderSide(color: Colors.white.withValues(alpha: 0.08))),
            boxShadow: [
              BoxShadow(color: Colors.black.withValues(alpha: 0.35), blurRadius: 28, offset: const Offset(0, -8)),
            ],
          ),
          padding: EdgeInsets.fromLTRB(16, 0, 16, 20 + MediaQuery.of(context).viewPadding.bottom),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            // Asa del bottom sheet.
            Container(
              width: 36, height: 4,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.25),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 14),
            // Iconos de vehículo: solo el dibujo, sin contenedores, centrados.
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                _VehicleOption(
                  imgPath: _vehicleMotoImg,
                  label: 'Moto',
                  eta: '3 min',
                  selected: _vehicleType == VehicleType.moto,
                  onTap: () { setState(() => _vehicleType = VehicleType.moto); _recalculateEstimate(); },
                ),
                const SizedBox(width: 64),
                _VehicleOption(
                  imgPath: _vehicleAutoImg,
                  label: 'Carro',
                  eta: '5 min',
                  selected: _vehicleType == VehicleType.car,
                  onTap: () { setState(() => _vehicleType = VehicleType.car); _recalculateEstimate(); },
                ),
              ],
            ),
            if (showRoute) ...[
              const SizedBox(height: 10),
              Row(children: [
                Icon(Icons.route, size: 14, color: _textMuted),
                const SizedBox(width: 6),
                Text(
                  '${_routeKm.toStringAsFixed(1)} km · ${_routeMin.round()} min',
                  style: const TextStyle(color: _textSecondary, fontSize: 12, fontWeight: FontWeight.w600),
                ),
                const Spacer(),
                Text(
                  'Tarifa base ${_formatMoney(base!)}',
                  style: const TextStyle(color: _textMuted, fontSize: 11.5, fontWeight: FontWeight.w500),
                ),
              ]),
            ],
            const SizedBox(height: 10),
            _buildFarePill(base: base, offer: offer),
            const SizedBox(height: 14),
            SizedBox(
              width: double.infinity, height: 56,
              child: ElevatedButton(
                onPressed: _loading || _pickupPos == null || !hasDest ? null : _requestTrip,
                style: ElevatedButton.styleFrom(
                  backgroundColor: _cyan,
                  foregroundColor: _onPrimaryTeal,
                  disabledBackgroundColor: _cyan.withValues(alpha: 0.22),
                  disabledForegroundColor: _onPrimaryTeal.withValues(alpha: 0.75),
                  elevation: 6,
                  shadowColor: _cyan,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, letterSpacing: 1.2),
                ),
                child: _loading
                    ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2, color: _onPrimaryTeal))
                    : Text(hasDest ? 'SOLICITAR VIAJE' : 'ELIGE UN DESTINO'),
              ),
            ),
          ]),
        ),
      ),
    );
  }

  /// Píldora de oferta (estilo del diseño): botones (-) y (+) en pasos de
  /// $500 alrededor del precio; tocando el monto se abre el teclado para
  /// escribir un valor exacto (ej: $5.205). Rango: base → base × 2.
  Widget _buildFarePill({required double? base, required double? offer}) {
    const step = 500.0;
    final hasFare = base != null && offer != null;
    final min = base ?? 0;
    final max = (base ?? 0) * 2;
    final offerValue = offer ?? 0;
    return Container(
      padding: const EdgeInsets.all(6),
      decoration: BoxDecoration(
        color: _surfaceHigh.withValues(alpha: 0.85),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
      ),
      child: Row(children: [
        _fareBtn(Icons.remove, hasFare && offerValue > min, () {
          setState(() => _offerFare = (offerValue - step).clamp(min, max));
        }),
        Expanded(
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: hasFare
                ? () => _editOffer(min: min, max: max, current: offerValue)
                : null,
            child: Column(children: [
              const Text(
                'OFERTA',
                style: TextStyle(color: _textMuted, fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 2.5),
              ),
              const SizedBox(height: 2),
              Text(
                hasFare ? _formatMoney(offerValue) : '—',
                style: TextStyle(
                  color: hasFare ? _cyan : _textMuted,
                  fontSize: 26,
                  fontWeight: FontWeight.w900,
                  letterSpacing: -0.3,
                ),
              ),
            ]),
          ),
        ),
        _fareBtn(Icons.add, hasFare && offerValue < max, () {
          setState(() => _offerFare = (offerValue + step).clamp(min, max));
        }),
      ]),
    );
  }

  /// Diálogo con teclado numérico para ofertar un valor exacto en pesos.
  Future<void> _editOffer({
    required double min,
    required double max,
    required double current,
  }) async {
    final ctrl = TextEditingController(text: current.round().toString());
    final value = await showDialog<double>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: _surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text(
          'Tu oferta',
          style: TextStyle(fontWeight: FontWeight.w800, color: _textPrimary),
        ),
        content: TextField(
          controller: ctrl,
          autofocus: true,
          keyboardType: TextInputType.number,
          style: const TextStyle(color: _textPrimary, fontSize: 18, fontWeight: FontWeight.w700),
          decoration: InputDecoration(
            labelText: 'Valor en pesos (COP)',
            hintText: 'Ej: 5205',
            prefixText: '\$ ',
            helperText: 'Entre ${_formatMoney(min)} y ${_formatMoney(max)}',
            helperStyle: const TextStyle(color: _textMuted, fontSize: 11),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancelar', style: TextStyle(color: _textMuted)),
          ),
          FilledButton(
            onPressed: () {
              final v = double.tryParse(ctrl.text.replaceAll(RegExp(r'[^\d]'), ''));
              Navigator.pop(ctx, v);
            },
            child: const Text('Aplicar', style: TextStyle(fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );
    if (value == null || !mounted) return;
    final clamped = value.clamp(min, max).roundToDouble();
    setState(() => _offerFare = clamped);
    if (clamped != value) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('La oferta debe estar entre ${_formatMoney(min)} y ${_formatMoney(max)}'),
        ),
      );
    }
  }

  Widget _fareBtn(IconData icon, bool enabled, VoidCallback onTap) {
    return Opacity(
      opacity: enabled ? 1 : 0.35,
      child: Material(
        color: _surface,
        shape: CircleBorder(side: BorderSide(color: Colors.white.withValues(alpha: 0.1))),
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: enabled ? onTap : null,
          child: SizedBox(
            width: 48, height: 48,
            child: Icon(icon, size: 22, color: _textPrimary),
          ),
        ),
      ),
    );
  }

  /// Formatea un monto con separador de miles estilo colombiano.
  String _formatMoney(double v) {
    final s = v.round().toString();
    final buf = StringBuffer();
    for (int i = 0; i < s.length; i++) {
      buf.write(s[i]);
      final remaining = s.length - 1 - i;
      if (remaining > 0 && remaining % 3 == 0) buf.write('.');
    }
    return '\$$buf';
  }

  Widget _buildActiveTripView() {
    final t = _activeTrip!;

    return Stack(children: [
      FlutterMap(
        mapController: _mapCtrl,
        options: MapOptions(
          initialCenter: _currentPos ?? const LatLng(10.0, -75.0),
          initialZoom: 15,
        ),
        children: [
          TileLayer(
            urlTemplate: 'https://api.mapbox.com/styles/v1/mapbox/navigation-night-v1/tiles/256/{z}/{x}/{y}@2x?access_token=${LocationService.mapboxToken}',
            userAgentPackageName: 'com.carsigo.app',
          ),
          ValueListenableBuilder<LatLng?>(
            valueListenable: _posNotifier,
            builder: (_, pos, _) => MarkerLayer(markers: [
              if (pos != null)
                Marker(point: pos, child: _currentPosMarker()),
            ]),
          ),
        ],
      ),
      Positioned(
        left: 0, right: 0, bottom: 0,
        child: Container(
          padding: EdgeInsets.fromLTRB(20, 20, 20, 20 + MediaQuery.of(context).viewPadding.bottom),
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

/// Opción de vehículo SIN contenedores: solo el dibujo del vehículo (PNG)
  /// con un brillo neón sutil detrás si está seleccionado, y debajo la
  /// etiqueta con el tiempo estimado de llegada del conductor.
class _VehicleOption extends StatelessWidget {
  final String imgPath;
  final String label;
  final String eta;
  final bool selected;
  final VoidCallback onTap;
  const _VehicleOption({
    required this.imgPath,
    required this.label,
    required this.eta,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: AnimatedScale(
        scale: selected ? 1.08 : 1.0,
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeOut,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Stack(alignment: Alignment.center, children: [
              // Brillo neón suave detrás del dibujo (sin fondo sólido).
              if (selected)
                Container(
                  width: 122, height: 122,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: RadialGradient(
                      colors: [
                        _cyan.withValues(alpha: 0.22),
                        Colors.transparent,
                      ],
                    ),
                  ),
                ),
              Opacity(
                opacity: selected ? 1 : 0.55,
                child: Image.asset(imgPath, width: 84, height: 84),
              ),
            ]),
            const SizedBox(height: 6),
            Text(
              label,
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w800,
                color: selected ? _textPrimary : _textMuted,
              ),
            ),
            const SizedBox(height: 1),
            Text(
              eta,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: selected ? _cyan : _textMuted,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
