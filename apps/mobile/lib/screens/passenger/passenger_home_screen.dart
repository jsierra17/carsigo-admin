import 'dart:async';
import 'dart:ui' show ImageFilter;
import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:latlong2/latlong.dart' hide LatLng;
import 'package:latlong2/latlong.dart' as l2;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import '../../models/trip.dart';
import '../../providers/auth_provider.dart';
import '../../providers/theme_provider.dart';
import '../../services/trip_service.dart';
import '../../services/location_service.dart';
import '../../services/map_markers.dart';
import '../../services/pricing_engine.dart';
import '../../services/zone_service.dart';
import '../profile_screen.dart';
import '../trip_history_screen.dart';
import 'place_search_screen.dart';
import '../../theme/carsigo_theme.dart';
const _vehicleMotoImg = 'assets/vehicles/Moto.png';
const _vehicleAutoImg = 'assets/vehicles/Carro.png';
/// Estilo nocturno de Google Maps para el modo oscuro (JSON crudo).
const String _googleDarkStyle = '''
[
  {"elementType": "geometry", "stylers": [{"color": "#242f3e"}]},
  {"elementType": "labels.text.stroke", "stylers": [{"color": "#242f3e"}]},
  {"elementType": "labels.text.fill", "stylers": [{"color": "#746855"}]},
  {"featureType": "administrative.locality", "elementType": "labels.text.fill", "stylers": [{"color": "#d59563"}]},
  {"featureType": "poi", "elementType": "labels.text.fill", "stylers": [{"color": "#d59563"}]},
  {"featureType": "poi.park", "elementType": "geometry", "stylers": [{"color": "#263c3f"}]},
  {"featureType": "poi.park", "elementType": "labels.text.fill", "stylers": [{"color": "#6b9a76"}]},
  {"featureType": "road", "elementType": "geometry", "stylers": [{"color": "#38414e"}]},
  {"featureType": "road", "elementType": "geometry.stroke", "stylers": [{"color": "#212a37"}]},
  {"featureType": "road", "elementType": "labels.text.fill", "stylers": [{"color": "#9ca5b3"}]},
  {"featureType": "road.highway", "elementType": "geometry", "stylers": [{"color": "#746855"}]},
  {"featureType": "road.highway", "elementType": "geometry.stroke", "stylers": [{"color": "#1f2835"}]},
  {"featureType": "road.highway", "elementType": "labels.text.fill", "stylers": [{"color": "#f3d19c"}]},
  {"featureType": "transit", "elementType": "geometry", "stylers": [{"color": "#2f3948"}]},
  {"featureType": "transit.station", "elementType": "labels.text.fill", "stylers": [{"color": "#d59563"}]},
  {"featureType": "water", "elementType": "geometry", "stylers": [{"color": "#17263c"}]},
  {"featureType": "water", "elementType": "labels.text.fill", "stylers": [{"color": "#515c6d"}]},
  {"featureType": "water", "elementType": "labels.text.stroke", "stylers": [{"color": "#17263c"}]}
]
''';
class PassengerHomeScreen extends ConsumerStatefulWidget {
  const PassengerHomeScreen({super.key});
  @override
  ConsumerState<PassengerHomeScreen> createState() => _PassengerHomeScreenState();
}
class _PassengerHomeScreenState extends ConsumerState<PassengerHomeScreen> {
  final _tripService = TripService();
  final _engine = PricingEngine();
  final _zoneService = ZoneService();
  GoogleMapController? _mapCtrl;
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
  BitmapDescriptor? _pickupIcon;
  BitmapDescriptor? _destIcon;
  /// Paleta activa del tema (leída en cada build).
  CarSiGoPalette get p => context.palette;
  /// Vidrio translúcido de la tarjeta de búsqueda y botones flotantes.
  Color get _glass => context.isDark
      ? const Color(0xD91E1E1E)
      : const Color(0xEFFFFFFF);
  /// Fondo translúcido del panel inferior.
  Color get _sheetGlass => context.isDark
      ? const Color(0x2E131313)
      : const Color(0xF2FFFFFF);
  /// Texto sobre el CTA neón: teal oscuro en ambos modos (contraste seguro).
  Color get _onPrimaryTeal => const Color(0xFF00363D);
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
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadMarkerIcons());
  }
  Future<void> _loadMarkerIcons() async {
    if (!mounted) return;
    final palette = context.palette;
    _pickupIcon = await pinBitmap(palette.green, Icons.location_on);
    _destIcon = await pinBitmap(palette.cyan, Icons.flag, scale: 0.6);
    if (mounted) setState(() {});
  }
  @override
  void dispose() {
    _posNotifier.dispose();
    _mapCtrl?.dispose();
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
      // El origen se fija INMEDIATO con la posición GPS: el botón de
      // solicitar viaje se activa desde el primer segundo y el panel abre
      // con el origen precargado sin depender de Firestore ni del geocode
      // (que pueden tardar con red lenta).
      setState(() {
        _currentPos = latLng;
        _loadingLocation = false;
        _pickupPos = latLng;
        _pickupAddress = 'Mi ubicación actual';
        _pickupCtrl.text = 'Mi ubicación actual';
      });
      _posNotifier.value = latLng;
      _mapCtrl?.animateCamera(CameraUpdate.newLatLngZoom(latLng, 15));
      // La zona se valida en paralelo: no bloquea el origen ni la ruta.
      unawaited(_checkZone(pos.latitude, pos.longitude));
      // La dirección legible se rellena después (mejor etiqueta, mismos
      // puntos): si el geocode falla se conserva la etiqueta genérica.
      try {
        final address = await LocationService.reverseGeocode(
          pos.latitude,
          pos.longitude,
        );
        if (mounted) {
          setState(() {
            _pickupAddress = address;
            _pickupCtrl.text = address.split(',').first;
          });
        }
} catch (_) {
        // Sin dirección legible: se conserva "Mi ubicación actual".
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
    // Si el destino ya se eligió antes de que terminara la zona, se
    // recalcula con el zone_id correcto.
    if (mounted && _destPos != null) _recalculateEstimate();
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
  void _openPlaceSearch() {
    Navigator.of(context).push<PlaceSearchResult>(
      MaterialPageRoute(
        builder: (_) => PlaceSearchScreen(
          initialPickup: _pickupCtrl.text.trim().isEmpty
              ? 'Mi ubicación actual'
              : _pickupCtrl.text,
          initialDest: _destCtrl.text,
          zones: _allowedZones,
          userLat: _currentPos?.latitude,
          userLng: _currentPos?.longitude,
        ),
      ),
    ).then((r) {
      if (r == null || !mounted) return;
      if (r.pickup != null) _selectPickup(r.pickup!);
      if (r.dest != null) _selectDest(r.dest!);
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
        fromLat: _pickupPos!.latitude,
        fromLng: _pickupPos!.longitude,
        toLat: _destPos!.latitude,
        toLng: _destPos!.longitude,
      );
      if (mounted) {
        setState(() {
          _estimate = est;
          _offerFare = null; // la oferta vuelve a la tarifa base al recalcular
          _routePoints = route.points
              .map((pt) => LatLng(pt.latitude, pt.longitude))
              .toList();
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
    final minLat = _pickupPos!.latitude < _destPos!.latitude
        ? _pickupPos!.latitude
        : _destPos!.latitude;
    final maxLat = _pickupPos!.latitude > _destPos!.latitude
        ? _pickupPos!.latitude
        : _destPos!.latitude;
    final minLng = _pickupPos!.longitude < _destPos!.longitude
        ? _pickupPos!.longitude
        : _destPos!.longitude;
    final maxLng = _pickupPos!.longitude > _destPos!.longitude
        ? _pickupPos!.longitude
        : _destPos!.longitude;
    _mapCtrl?.animateCamera(
      CameraUpdate.newLatLngBounds(
        LatLngBounds(
          southwest: LatLng(minLat, minLng),
          northeast: LatLng(maxLat, maxLng),
        ),
        140,
      ),
    );
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
              ? const Distance().as(
                  LengthUnit.Kilometer,
                  l2.LatLng(_pickupPos!.latitude, _pickupPos!.longitude),
                  l2.LatLng(_destPos!.latitude, _destPos!.longitude),
                )
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
      backgroundColor: p.bg,
      key: _scaffoldKey,
      drawer: _buildDrawer(),
      body: _activeTrip != null ? _buildActiveTripView() : _buildMainView(),
    );
  }
  Widget _buildMainView() {
    if (_checkingZone || _loadingLocation) {
      return Center(child: CircularProgressIndicator(strokeWidth: 3, color: p.cyan));
    }
    if (!_inActiveZone) {
      return Stack(children: [
        _buildMap(),
        Positioned(
          left: 0, right: 0, bottom: 0,
          child: Container(
            padding: EdgeInsets.fromLTRB(24, 24, 24, 24 + MediaQuery.of(context).viewPadding.bottom),
            decoration: BoxDecoration(
              color: p.surface,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
              border: Border(top: BorderSide(color: p.border)),
            ),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              Icon(Icons.location_off, size: 48, color: Colors.orange),
              SizedBox(height: 12),
Text('Servicio no disponible', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: p.textPrimary)),
              SizedBox(height: 6),
Text('Actualmente no tenemos cobertura\nen tu área.', style: TextStyle(color: p.textMuted, fontSize: 13), textAlign: TextAlign.center),
              if (_currentPos != null)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text('${_currentPos!.latitude.toStringAsFixed(4)}, ${_currentPos!.longitude.toStringAsFixed(4)}', style: TextStyle(color: p.textMuted, fontSize: 10)),
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
      shape: CircleBorder(side: BorderSide(color: p.cyan, width: 1.5)),
      elevation: 6,
      shadowColor: p.cyan.withValues(alpha: 0.35),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: () => _scaffoldKey.currentState?.openDrawer(),
        child: SizedBox(
          width: 48, height: 48,
          child: Icon(Icons.menu, size: 24, color: p.cyan),
        ),
      ),
    );
  }
  /// Botón flotante circular con borde neón (centro-derecha): recentra la
  /// cámara sobre la ubicación actual del usuario.
  Widget _buildLocateButton() {
    return Material(
      color: _glass,
      shape: CircleBorder(side: BorderSide(color: p.cyan, width: 1.5)),
      elevation: 6,
      shadowColor: p.cyan.withValues(alpha: 0.35),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: () {
          if (_currentPos != null) {
            _mapCtrl?.animateCamera(
              CameraUpdate.newLatLngZoom(_currentPos!, 15),
            );
          }
        },
        child: SizedBox(
          width: 48, height: 48,
          child: Icon(Icons.near_me, size: 22, color: p.cyan),
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
      backgroundColor: p.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.horizontal(right: Radius.circular(24)),
      ),
      child: SafeArea(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(
                'CarSiGo',
                style: TextStyle(color: p.cyan, fontSize: 22, fontWeight: FontWeight.w900, letterSpacing: 0.5),
              ),
              SizedBox(height: 4),
              Text(
                name,
                style: TextStyle(color: p.textMuted, fontSize: 13, fontWeight: FontWeight.w500),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ]),
          ),
Divider(height: 1, color: p.border),
          ListTile(
            leading: Icon(Icons.person_outline, color: p.cyan),
            title: const Text('Mi perfil', style: TextStyle(fontWeight: FontWeight.w600)),
            onTap: () {
              Navigator.pop(context);
              Navigator.push(context, MaterialPageRoute(builder: (_) => const ProfileScreen()));
            },
          ),
          ListTile(
            leading: Icon(Icons.history_rounded, color: p.cyan),
            title: const Text('Historial de viajes', style: TextStyle(fontWeight: FontWeight.w600)),
            onTap: () {
              Navigator.pop(context);
              Navigator.push(context, MaterialPageRoute(builder: (_) => const TripHistoryScreen()));
            },
          ),
          SwitchListTile(
            secondary: Icon(
              context.isDark ? Icons.dark_mode : Icons.light_mode,
              color: p.cyan,
            ),
            title: Text('Modo oscuro', style: TextStyle(fontWeight: FontWeight.w600)),
            subtitle: Text(
              context.isDark ? 'Tema nocturno' : 'Tema claro (predeterminado)',
              style: TextStyle(color: p.textMuted, fontSize: 12),
            ),
            activeTrackColor: p.cyan.withValues(alpha: 0.35),
            value: context.isDark,
            onChanged: (_) => ref.read(themeModeProvider.notifier).toggle(),
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
    final lines = <Polyline>{};
    // Solo se dibuja la ruta cuando es una ruta real por carretera: una línea
    // recta entre puntos engañaría al usuario (nunca se traza recto).
    if (_routeHasRoad && (_routePoints?.length ?? 0) >= 2) {
      lines.add(Polyline(
        polylineId: const PolylineId('route'),
        points: _routePoints!,
        color: p.cyan,
        width: 4,
      ));
    }
    final polygons = <Polygon>{};
    for (final zone in _allowedZones) {
      for (final polygon in zone.polygons) {
        polygons.add(Polygon(
          polygonId: PolygonId('zone-${zone.id}-${polygons.length}'),
          points: polygon.map((pt) => LatLng(pt[0], pt[1])).toList(),
          fillColor: p.cyan.withAlpha(16),
          strokeColor: p.cyan.withAlpha(90),
          strokeWidth: 1,
        ));
      }
    }
    return ValueListenableBuilder<LatLng?>(
      valueListenable: _posNotifier,
      builder: (_, pos, _) {
        final markers = <Marker>{};
        // El pin de origen solo se muestra cuando el origen es distinto de la
        // posición actual: si es "mi ubicación", el punto azul ya lo indica.
        final pickupIsUser = pos != null &&
            _pickupPos != null &&
            (_pickupPos!.latitude - pos.latitude).abs() < 0.0003 &&
            (_pickupPos!.longitude - pos.longitude).abs() < 0.0003;
        if (_pickupPos != null && !pickupIsUser) {
          markers.add(Marker(
            markerId: const MarkerId('pickup'),
            position: _pickupPos!,
            icon: _pickupIcon ?? BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueGreen),
          ));
        }
        if (_destPos != null) {
          markers.add(Marker(
            markerId: const MarkerId('dest'),
            position: _destPos!,
            icon: _destIcon ?? BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueCyan),
          ));
        }
        return GoogleMap(
          onMapCreated: (c) => _mapCtrl = c,
          initialCameraPosition: CameraPosition(
            target: _currentPos ?? const LatLng(10.0, -75.0),
            zoom: 15,
          ),
          style: context.isDark ? _googleDarkStyle : null,
          myLocationEnabled: true,
          myLocationButtonEnabled: false,
          zoomControlsEnabled: false,
          rotateGesturesEnabled: false,
          mapType: MapType.normal,
          polygons: polygons,
          polylines: lines,
          markers: markers,
        );
      },
    );
  }

  /// Tarjeta de búsqueda flotante compacta (estilo inDrive): un único campo
  /// "¿A dónde vas?" que abre el panel expandido con Origen (GPS) y Destino.
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
          child: _buildSearchRow(
            text: _destCtrl.text,
            hint: '¿A dónde vas?',
            icon: Icons.search,
            iconColor: p.cyan,
            emphasized: true,
            onTap: _openPlaceSearch,
          ),
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
                color: text.isNotEmpty ? p.textPrimary : p.textMuted.withValues(alpha: 0.6),
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
Icon(Icons.chevron_right, size: 20, color: p.textMuted),
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
              SizedBox(height: 10),
              Row(children: [
                Icon(Icons.route, size: 14, color: p.textMuted),
                SizedBox(width: 6),
                Text(
                  '${_routeKm.toStringAsFixed(1)} km · ${_routeMin.round()} min',
                  style: TextStyle(color: p.textSecondary, fontSize: 12, fontWeight: FontWeight.w600),
                ),
                const Spacer(),
                Text(
                  'Tarifa base ${_formatMoney(base!)}',
                  style: TextStyle(color: p.textMuted, fontSize: 11.5, fontWeight: FontWeight.w500),
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
                  backgroundColor: p.cyan,
                  foregroundColor: _onPrimaryTeal,
                  disabledBackgroundColor: p.cyan.withValues(alpha: 0.22),
                  disabledForegroundColor: _onPrimaryTeal.withValues(alpha: 0.75),
                  elevation: 6,
                  shadowColor: p.cyan,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, letterSpacing: 1.2),
                ),
                child: _loading
                    ? SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2, color: _onPrimaryTeal))
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
  /// escribir un valor exacto (ej: $5.205). Rango: base â†’ base Ã— 2.
  Widget _buildFarePill({required double? base, required double? offer}) {
    const step = 500.0;
    final hasFare = base != null && offer != null;
    final min = base ?? 0;
    final max = (base ?? 0) * 2;
    final offerValue = offer ?? 0;
    return Container(
      padding: const EdgeInsets.all(6),
      decoration: BoxDecoration(
        color: p.surfaceHigh.withValues(alpha: 0.85),
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
              Text(
                'OFERTA',
                style: TextStyle(color: p.textMuted, fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 2.5),
              ),
              const SizedBox(height: 2),
              Text(
                hasFare ? _formatMoney(offerValue) : '—',
                style: TextStyle(
                  color: hasFare ? p.cyan : p.textMuted,
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
        backgroundColor: p.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(
          'Tu oferta',
          style: TextStyle(fontWeight: FontWeight.w800, color: p.textPrimary),
        ),
        content: TextField(
          controller: ctrl,
          autofocus: true,
          keyboardType: TextInputType.number,
          style: TextStyle(color: p.textPrimary, fontSize: 18, fontWeight: FontWeight.w700),
          decoration: InputDecoration(
            labelText: 'Valor en pesos (COP)',
            hintText: 'Ej: 5205',
            prefixText: '\$ ',
            helperText: 'Entre ${_formatMoney(min)} y ${_formatMoney(max)}',
            helperStyle: TextStyle(color: p.textMuted, fontSize: 11),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text('Cancelar', style: TextStyle(color: p.textMuted)),
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
        color: p.surface,
        shape: CircleBorder(side: BorderSide(color: Colors.white.withValues(alpha: 0.1))),
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: enabled ? onTap : null,
          child: SizedBox(
            width: 48, height: 48,
            child: Icon(icon, size: 22, color: p.textPrimary),
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
      GoogleMap(
        onMapCreated: (c) => _mapCtrl = c,
        initialCameraPosition: CameraPosition(
          target: _currentPos ?? const LatLng(10.0, -75.0),
          zoom: 15,
        ),
        style: context.isDark ? _googleDarkStyle : null,
        myLocationEnabled: true,
        myLocationButtonEnabled: false,
        zoomControlsEnabled: false,
        rotateGesturesEnabled: false,
      ),
      Positioned(
        left: 0, right: 0, bottom: 0,
        child: Container(
          padding: EdgeInsets.fromLTRB(20, 20, 20, 20 + MediaQuery.of(context).viewPadding.bottom),
          decoration: BoxDecoration(
            color: p.surface,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
            border: Border(top: BorderSide(color: p.border)),
          ),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Icon(
              t.status == TripStatus.pending ? Icons.hourglass_bottom
                  : t.status == TripStatus.accepted ? Icons.directions_car
                  : t.status == TripStatus.inProgress ? Icons.navigation
                  : Icons.check_circle,
              size: 40, color: p.cyan,
            ),
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
Icon(Icons.location_on, color: p.cyan, size: 18),
                SizedBox(width: 6),
                Expanded(child: Text(t.dropoffAddress!, style: TextStyle(color: p.textSecondary, fontSize: 13))),
              ]),
            ],
            if (t.fareAmount > 0) ...[
              SizedBox(height: 8),
              Text('\$${t.fareAmount.toStringAsFixed(0)}', style: TextStyle(fontSize: 28, fontWeight: FontWeight.w900, color: p.cyan)),
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
    final p = context.palette;
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
                        p.cyan.withValues(alpha: 0.22),
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
                color: selected ? p.textPrimary : p.textMuted,
              ),
            ),
            const SizedBox(height: 1),
            Text(
              eta,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: selected ? p.cyan : p.textMuted,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
