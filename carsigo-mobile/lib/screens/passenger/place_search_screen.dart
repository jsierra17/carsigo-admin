import 'dart:async';
import 'package:flutter/material.dart';
import '../../services/location_service.dart';
import '../../services/zone_service.dart';
import '../../theme/carsigo_theme.dart';

/// Pantalla de búsqueda a pantalla completa, estilo Uber/InDrive.
/// Al abrirse no tapa el panel de solicitar viaje: ocupa su propia ruta en el
/// navegador (con botón atrás), y al elegir un lugar regresa el [MapSuggestion]
/// seleccionado.
class PlaceSearchScreen extends StatefulWidget {
  final String hint;
  final String initialText;
  final List<ZoneInfo> zones;
  final double? userLat;
  final double? userLng;

  const PlaceSearchScreen({
    super.key,
    this.hint = 'Buscar lugar…',
    this.initialText = '',
    this.zones = const [],
    this.userLat,
    this.userLng,
  });

  @override
  State<PlaceSearchScreen> createState() => _PlaceSearchScreenState();
}

class _PlaceSearchScreenState extends State<PlaceSearchScreen> {
  late final TextEditingController _controller;
  Timer? _debounce;
  List<MapSuggestion> _results = [];
  bool _searching = false;
  // Evita que una respuesta vieja sobreescriba resultados de una búsqueda
  // más reciente (race condition).
  int _searchSeq = 0;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.initialText);
    if (widget.initialText.length >= 2) _runSearch(widget.initialText);
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: CarSiGoColors.bg,
      appBar: AppBar(
        title: Text(
          _controller.text.trim().isEmpty ? widget.hint : 'Buscar destino',
          style: const TextStyle(color: CarSiGoColors.textPrimary, fontSize: 16, fontWeight: FontWeight.w700),
        ),
        automaticallyImplyLeading: true,
      ),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
              child: TextField(
                controller: _controller,
                autofocus: true,
                maxLength: 120,
                onChanged: _onChanged,
                textInputAction: TextInputAction.search,
                decoration: InputDecoration(
                  hintText: widget.hint,
                  counterText: '',
                  prefixIcon: const Icon(Icons.search, color: CarSiGoColors.cyan, size: 22),
                  suffixIcon: _controller.text.isEmpty
                      ? null
                      : IconButton(
                          icon: const Icon(Icons.close, color: CarSiGoColors.textMuted, size: 20),
                          onPressed: () {
                            _controller.clear();
                            _onChanged('');
                          },
                        ),
                ),
              ),
            ),
            Expanded(
              child: _buildResults(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildResults() {
    if (_searching) {
      return const Center(
        child: CircularProgressIndicator(strokeWidth: 3, color: CarSiGoColors.cyan),
      );
    }
    if (_results.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.location_searching, size: 48, color: CarSiGoColors.textMuted),
            const SizedBox(height: 12),
            Text(
              _controller.text.trim().length < 2
                  ? 'Escribe un lugar o dirección'
                  : 'No encontramos resultados en tu zona',
              style: const TextStyle(color: CarSiGoColors.textSecondary, fontSize: 14),
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
            decoration: const BoxDecoration(
              color: CarSiGoColors.surfaceLight,
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.location_on, color: CarSiGoColors.cyan, size: 20),
          ),
          title: Text(
            s.placeName.split('·').first.trim(),
            style: const TextStyle(color: CarSiGoColors.textPrimary, fontSize: 14, fontWeight: FontWeight.w600),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
          subtitle: s.distanceKm != null
              ? Text(
                  '${s.distanceKm!.toStringAsFixed(1)} km${s.placeName.contains('·') ? ' · ${s.placeName.split('·').last.trim()}' : ''}',
                  style: const TextStyle(color: CarSiGoColors.textMuted, fontSize: 11),
                )
              : null,
          onTap: () => Navigator.of(context).pop(s),
        );
      },
    );
  }
}