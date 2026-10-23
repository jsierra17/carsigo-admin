import 'dart:async';
import 'package:flutter/material.dart';
import '../../services/location_service.dart';
import '../../services/recent_destinations.dart';
import '../../services/zone_service.dart';
import '../../theme/carsigo_theme.dart';

/// Resultado del panel expandido: origen (si el usuario lo cambió) y destino
/// (si lo eligió). Cualquiera puede ser nulo.
class PlaceSearchResult {
  final MapSuggestion? pickup;
  final MapSuggestion? dest;

  const PlaceSearchResult({this.pickup, this.dest});
}

/// Panel de búsqueda expandido estilo inDrive: muestra el Origen (autocomple-
/// tado con la ubicación GPS actual, editable) y debajo el campo de Destino.
/// Al elegir un origen el panel permanece abierto y enfoca el destino; al
/// elegir un destino regresa un [PlaceSearchResult].
class PlaceSearchScreen extends StatefulWidget {
  final String initialPickup;
  final String initialDest;
  final List<ZoneInfo> zones;
  final double? userLat;
  final double? userLng;

  const PlaceSearchScreen({
    super.key,
    this.initialPickup = '',
    this.initialDest = '',
    this.zones = const [],
    this.userLat,
    this.userLng,
  });

  @override
  State<PlaceSearchScreen> createState() => _PlaceSearchScreenState();
}

class _PlaceSearchScreenState extends State<PlaceSearchScreen> {
  CarSiGoPalette get p => context.palette;

  late final TextEditingController _pickupCtrl;
  late final TextEditingController _destCtrl;
  final _pickupFocus = FocusNode();
  final _destFocus = FocusNode();

  Timer? _debounce;
  List<MapSuggestion> _results = [];
  List<RecentDestination> _recents = [];
  bool _searching = false;
  bool _locatingPickup = false;
  // Campo activo: true = buscando origen, false = buscando destino.
  bool _activeIsPickup = false;
  // Origen elegido/cambiado dentro del panel (null = conservar el actual).
  MapSuggestion? _pickupSel;
  // Evita que una respuesta vieja sobreescriba resultados de una búsqueda
  // más reciente (race condition).
  int _searchSeq = 0;

  @override
  void initState() {
    super.initState();
    _pickupCtrl = TextEditingController(text: widget.initialPickup);
    _destCtrl = TextEditingController(text: widget.initialDest);
    _loadRecents();
    if (widget.initialDest.length >= 2) _runSearch(widget.initialDest);
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _pickupCtrl.dispose();
    _destCtrl.dispose();
    _pickupFocus.dispose();
    _destFocus.dispose();
    super.dispose();
  }

  Future<void> _loadRecents() async {
    final recents = await RecentDestinations.load();
    if (mounted) setState(() => _recents = recents);
  }

  void _onChanged(String text) {
    _debounce?.cancel();
    if (text.trim().length < 2) {
      setState(() {
        _results = [];
        _searching = false;
      });
      return;
    }
    setState(() => _searching = true);
    _debounce = Timer(const Duration(milliseconds: 350), () => _runSearch(text));
  }

  Future<void> _runSearch(String text) async {
    final mySeq = ++_searchSeq;
    final t = text.trim();
    if (t.length < 2) return;
    final suggestions = await LocationService.searchAddress(
      t.length > 120 ? t.substring(0, 120) : t,
      zones: widget.zones,
      userLat: widget.userLat,
      userLng: widget.userLng,
    );
    if (!mounted || mySeq != _searchSeq) return;
    setState(() {
      _results = suggestions;
      _searching = false;
    });
  }

  void _switchActive(bool pickup) {
    setState(() {
      _activeIsPickup = pickup;
      _results = [];
      _searching = false;
    });
    final ctrl = pickup ? _pickupCtrl : _destCtrl;
    final focus = pickup ? _pickupFocus : _destFocus;
    if (ctrl.text.trim().length >= 2) {
      _runSearch(ctrl.text);
    }
    focus.requestFocus();
  }

  /// Autocompleta el origen con la posición GPS actual y pasa al destino.
  Future<void> _useMyLocation() async {
    if (_locatingPickup) return;
    setState(() => _locatingPickup = true);
    try {
      final pos = await LocationService.getCurrentPosition();
      final address = await LocationService.reverseGeocode(pos.latitude, pos.longitude);
      if (!mounted) return;
      setState(() {
        _pickupSel = MapSuggestion(
          placeName: address,
          lat: pos.latitude,
          lng: pos.longitude,
        );
        _pickupCtrl.text = address.split(',').first;
        _locatingPickup = false;
      });
      _switchActive(false);
    } catch (_) {
      if (!mounted) return;
      setState(() => _locatingPickup = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('No se pudo obtener tu ubicación'),
          backgroundColor: Colors.redAccent,
        ),
      );
    }
  }

  void _selectActive(MapSuggestion s) {
    if (_activeIsPickup) {
      setState(() {
        _pickupSel = s;
        _pickupCtrl.text = s.placeName.split(',').first;
      });
      _switchActive(false);
      return;
    }
    RecentDestinations.add(RecentDestination(
      name: s.placeName,
      lat: s.lat,
      lng: s.lng,
    ));
    Navigator.of(context).pop(PlaceSearchResult(pickup: _pickupSel, dest: s));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: p.bg,
      appBar: AppBar(
        title: Text(
          '¿A dónde vas?',
          style: TextStyle(color: p.textPrimary, fontSize: 16, fontWeight: FontWeight.w700),
        ),
        automaticallyImplyLeading: true,
      ),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
              child: Container(
                decoration: BoxDecoration(
                  color: p.surface,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: p.border),
                ),
                child: Column(children: [
                  // Origen: autocompletado con GPS, editable.
                  _buildField(
                    ctrl: _pickupCtrl,
                    focus: _pickupFocus,
                    hint: 'Origen',
                    icon: Icons.my_location,
                    iconColor: p.green,
                    suffix: _locatingPickup
                        ? Padding(
                            padding: EdgeInsets.all(14),
                            child: SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(strokeWidth: 2, color: p.cyan),
                            ),
                          )
                        : IconButton(
                            icon: Icon(Icons.gps_fixed, color: p.textMuted, size: 20),
                            tooltip: 'Usar mi ubicación',
                            onPressed: _useMyLocation,
                          ),
                    onTap: () => _switchActive(true),
                  ),
                  // Conector vertical entre origen y destino.
                  Padding(
                    padding: const EdgeInsets.only(left: 22.5),
                    child: Container(
                      width: 3,
                      height: 10,
                      color: p.textMuted.withValues(alpha: 0.35),
                    ),
                  ),
                  // Destino.
                  _buildField(
                    ctrl: _destCtrl,
                    focus: _destFocus,
                    hint: '¿A dónde vas?',
                    icon: Icons.search,
                    iconColor: p.cyan,
                    autofocus: widget.initialDest.isEmpty,
                    suffix: _destCtrl.text.isEmpty
                        ? null
                        : IconButton(
                            icon: Icon(Icons.close, color: p.textMuted, size: 20),
                            onPressed: () {
                              _destCtrl.clear();
                              _onChanged('');
                            },
                          ),
                    onTap: () => _switchActive(false),
                  ),
                ]),
              ),
            ),
            Expanded(child: _buildResults()),
          ],
        ),
      ),
    );
  }

  Widget _buildField({
    required TextEditingController ctrl,
    required FocusNode focus,
    required String hint,
    required IconData icon,
    required Color iconColor,
    Widget? suffix,
    VoidCallback? onTap,
    bool autofocus = false,
  }) {
    return TextField(
      controller: ctrl,
      focusNode: focus,
      autofocus: autofocus,
      maxLength: 120,
      onChanged: _onChanged,
      onTap: onTap,
      textInputAction: TextInputAction.search,
      style: TextStyle(
        color: p.textPrimary,
        fontSize: 16,
        fontWeight: FontWeight.w600,
      ),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: TextStyle(
          color: p.textMuted.withValues(alpha: 0.7),
          fontSize: 16,
          fontWeight: FontWeight.w500,
        ),
        counterText: '',
        prefixIcon: Icon(icon, color: iconColor, size: 20),
        suffixIcon: suffix,
        border: InputBorder.none,
        contentPadding: const EdgeInsets.symmetric(vertical: 12),
      ),
    );
  }

  Widget _buildResults() {
    if (_searching) {
      return Center(
        child: CircularProgressIndicator(strokeWidth: 3, color: p.cyan),
      );
    }

    // Origen activo y sin texto: ofrecer la ubicación GPS y el origen actual.
    if (_activeIsPickup && _pickupCtrl.text.trim().isEmpty) {
      return ListView(
        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
        children: [
          ListTile(
            minTileHeight: 56,
            leading: Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: p.surfaceLight,
                shape: BoxShape.circle,
              ),
              child: Icon(Icons.gps_fixed, color: p.green, size: 20),
            ),
            title: Text(
              'Usar mi ubicación',
              style: TextStyle(color: p.textPrimary, fontSize: 14, fontWeight: FontWeight.w600),
            ),
            onTap: _useMyLocation,
          ),
          if (_pickupSel != null)
            ListTile(
              minTileHeight: 56,
              leading: Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: p.surfaceLight,
                  shape: BoxShape.circle,
                ),
                child: Icon(Icons.location_on, color: p.green, size: 20),
              ),
              title: Text(
                _pickupSel!.placeName,
                style: TextStyle(color: p.textPrimary, fontSize: 14, fontWeight: FontWeight.w600),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              subtitle: Text(
                'Ubicación actual',
                style: TextStyle(color: p.textMuted, fontSize: 11),
              ),
              onTap: () => _switchActive(false),
            ),
        ],
      );
    }

    if (!_activeIsPickup && _destCtrl.text.trim().isEmpty && _recents.isNotEmpty) {
      return ListView.builder(
        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
        itemCount: _recents.length + 1,
        itemBuilder: (_, i) {
          if (i == 0) {
            return Padding(
              padding: EdgeInsets.fromLTRB(20, 8, 20, 4),
              child: Text(
                'Recientes',
                style: TextStyle(
                  color: p.textMuted,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.5,
                ),
              ),
            );
          }
          final r = _recents[i - 1];
          return ListTile(
            minTileHeight: 52,
            leading: Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: p.surfaceLight,
                shape: BoxShape.circle,
              ),
              child: Icon(Icons.history, color: p.cyan, size: 20),
            ),
            title: Text(
              r.name.split('·').first.trim(),
              style: TextStyle(color: p.textPrimary, fontSize: 14, fontWeight: FontWeight.w600),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            subtitle: r.name.contains('·')
                ? Text(
                    r.name.split('·').last.trim(),
                    style: TextStyle(color: p.textMuted, fontSize: 11),
                  )
                : null,
            onTap: () => _selectActive(MapSuggestion(placeName: r.name, lat: r.lat, lng: r.lng)),
          );
        },
      );
    }

    final ctrl = _activeIsPickup ? _pickupCtrl : _destCtrl;
    if (_results.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.location_searching, size: 48, color: p.textMuted),
            const SizedBox(height: 12),
            Text(
              ctrl.text.trim().length < 2
                  ? 'Escribe un lugar o dirección'
                  : 'No encontramos resultados en tu zona',
              style: TextStyle(color: p.textSecondary, fontSize: 14),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      );
    }
    return ListView.builder(
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      itemCount: _results.length,
      itemBuilder: (_, i) {
        final s = _results[i];
        return ListTile(
          minTileHeight: 56,
          leading: Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: p.surfaceLight,
              shape: BoxShape.circle,
            ),
            child: Icon(
              _activeIsPickup ? Icons.location_on : Icons.place,
              color: _activeIsPickup ? p.green : p.cyan,
              size: 20,
            ),
          ),
          title: Text(
            s.placeName.split('·').first.trim(),
            style: TextStyle(color: p.textPrimary, fontSize: 14, fontWeight: FontWeight.w600),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
          subtitle: s.distanceKm != null
              ? Text(
                  '${s.distanceKm!.toStringAsFixed(1)} km${s.placeName.contains('·') ? ' · ${s.placeName.split('·').last.trim()}' : ''}',
                  style: TextStyle(color: p.textMuted, fontSize: 11),
                )
              : null,
          onTap: () => _selectActive(s),
        );
      },
    );
  }
}
