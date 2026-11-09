import 'dart:math' as math;

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';

enum VehicleType { moto, car }
enum DayType { weekday, weekend, special }
enum ShiftLabel { morning, evening }

class PricingBreakdown {
  final String vehicleType;
  final String dayType;
  final String shiftLabel;
  final String shiftStart;
  final String shiftEnd;
  final double baseFeeAtShiftStart;
  final double hoursSinceShiftStart;
  final double hourlyIncreasePercent;
  final double currentBaseFee;
  final double includedKm;
  final double distanceKm;
  final double extraKm;
  final double extraKmPercent;
  final double extraKmCharge;
  final double subtotal;
  final double dynamicMultiplier;
  final String? dynamicRuleName;
  final double finalFare;
  final double minimumFare;
  final double commissionPercent;
  final double commissionAmount;
  final double driverEarnings;
  final double timeSurcharge;
  final bool specialZoneApplied;

  PricingBreakdown({
    required this.vehicleType,
    required this.dayType,
    required this.shiftLabel,
    required this.shiftStart,
    required this.shiftEnd,
    required this.baseFeeAtShiftStart,
    required this.hoursSinceShiftStart,
    required this.hourlyIncreasePercent,
    required this.currentBaseFee,
    required this.includedKm,
    required this.distanceKm,
    required this.extraKm,
    required this.extraKmPercent,
    required this.extraKmCharge,
    required this.subtotal,
    required this.dynamicMultiplier,
    this.dynamicRuleName,
    required this.finalFare,
    required this.minimumFare,
    required this.commissionPercent,
    required this.commissionAmount,
    required this.driverEarnings,
    this.timeSurcharge = 0,
    this.specialZoneApplied = false,
  });
}

/// Fin de semana = Viernes, Sábado, Domingo. Entre semana = Lunes a Jueves.
DayType _getDayType(DateTime date) {
  final day = date.weekday;
  if (day >= DateTime.friday) return DayType.weekend;
  return DayType.weekday;
}

String _currentTimeStr(DateTime dt) =>
    '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';

bool _inWindow(String time, String start, String end) {
  if (end.compareTo(start) <= 0) {
    return time.compareTo(start) >= 0 || time.compareTo(end) < 0;
  }
  return time.compareTo(start) >= 0 && time.compareTo(end) < 0;
}

/// Horas transcurridas desde el inicio del turno (soporta turnos que cruzan
/// la medianoche: ej. 18:30 -> 04:59).
double _getHoursSince(String from, String to, DateTime current) {
  final fromParts = from.split(':');
  final toParts = to.split(':');
  final fromMin = int.parse(fromParts[0]) * 60 + int.parse(fromParts[1]);
  final toMin = int.parse(toParts[0]) * 60 + int.parse(toParts[1]);
  final currentMin = current.hour * 60 + current.minute;

  if (toMin <= fromMin) {
    if (currentMin >= fromMin) {
      return (currentMin - fromMin) / 60;
    }
    return ((24 * 60 - fromMin) + currentMin) / 60;
  }
  if (currentMin >= fromMin && currentMin < toMin) {
    return (currentMin - fromMin) / 60;
  }
  return 0;
}

double _round100(double v) => (v / 100).round() * 100.0;

class PricingEngine {
  final _firestore = FirebaseFirestore.instance;

  Future<List<Map<String, dynamic>>> _fetchSchedules(
    String? zoneId,
    String vehicleStr,
    String dayStr,
  ) async {
    final base = _firestore
        .collection('rate_schedules')
        .where('vehicle_type', isEqualTo: vehicleStr)
        .where('day_type', isEqualTo: dayStr)
        .where('is_active', isEqualTo: true);
    if (zoneId != null) {
      final zoneSnap = await base.where('zone_id', isEqualTo: zoneId).get();
      if (zoneSnap.docs.isNotEmpty) {
        return zoneSnap.docs.map((d) => d.data()).toList();
      }
    }
    final snap = await base.get();
    return snap.docs.map((d) => d.data()).toList();
  }

  Future<List<Map<String, dynamic>>> _fetchCards(String? zoneId, String vehicleStr) async {
    final base = _firestore
        .collection('rate_cards')
        .where('vehicle_type', isEqualTo: vehicleStr)
        .where('is_active', isEqualTo: true)
        .limit(1);
    if (zoneId != null) {
      final zoneSnap = await base.where('zone_id', isEqualTo: zoneId).get();
      if (zoneSnap.docs.isNotEmpty) {
        return zoneSnap.docs.map((d) => d.data()).toList();
      }
    }
    final snap = await base.get();
    return snap.docs.map((d) => d.data()).toList();
  }

  Future<List<Map<String, dynamic>>> _fetchRules(String? zoneId) async {
    // Reglas de la zona; si la zona no tiene, se usan las globales (zone_id
    // explícitamente null). NO se usa whereIn con null: aunque el servidor lo
    // acepta, algunos SDK lo rechazan; dos consultas son equivalentes.
    if (zoneId != null) {
      final zoneSnap = await _firestore
          .collection('dynamic_pricing_rules')
          .where('zone_id', isEqualTo: zoneId)
          .where('is_active', isEqualTo: true)
          .orderBy('priority', descending: true)
          .get();
      if (zoneSnap.docs.isNotEmpty) {
        return zoneSnap.docs.map((d) => d.data()).toList();
      }
    }
    final globalSnap = await _firestore
        .collection('dynamic_pricing_rules')
        .where('zone_id', isEqualTo: null)
        .where('is_active', isEqualTo: true)
        .orderBy('priority', descending: true)
        .get();
    return globalSnap.docs.map((d) => d.data()).toList();
  }

  /// Costo por distancia extra más allá de los 1.5km incluidos:
  /// tramo 1.6-4.0km a tier1, 4.1km+ a tier2 (se mantiene más allá de 8km).
  double _extraKmCost(double km, Map<String, dynamic> card) {
    final tier1Max = (card['tier1_max_km'] as num?)?.toDouble() ?? 4.0;
    final tier1Rate = (card['tier1_rate_per_km'] as num?)?.toDouble() ?? 0;
    final tier2Rate = (card['tier2_rate_per_km'] as num?)?.toDouble() ?? 0;
    if (km <= 1.5) return 0;
    final t1 = math.max(0.0, math.min(km, tier1Max) - 1.5);
    final t2 = math.max(0.0, km - tier1Max);
    return t1 * tier1Rate + t2 * tier2Rate;
  }

  Future<PricingBreakdown> calculateFare({
    required VehicleType vehicleType,
    required double distanceKm,
    double durationMin = 0,
    DateTime? datetime,
    String? zoneId,
    double? fromLat,
    double? fromLng,
    double? toLat,
    double? toLng,
  }) async {
    final dt = datetime ?? DateTime.now();
    final dayType = _getDayType(dt);
    final currentTime = _currentTimeStr(dt);
    final vehicleStr = vehicleType == VehicleType.moto ? 'moto' : 'car';
    final dayStr = dayType == DayType.weekday
        ? 'weekday'
        : dayType == DayType.weekend
            ? 'weekend'
            : 'special';

    // Resolución de zona: el zone_id de precios es el slug del municipio
    // (ej. 'el-carmen-de-bolivar'), independiente del id interno del geofence.
    // FIX: consultar por campo 'slug' porque el doc ID no es el slug.
    Map<String, dynamic>? zoneGeo;
    if (zoneId != null) {
      try {
        final zoneSnap = await _firestore
            .collection('geofences')
            .where('slug', isEqualTo: zoneId)
            .limit(1)
            .get();
        zoneGeo = zoneSnap.docs.isNotEmpty ? zoneSnap.docs.first.data() : null;
      } catch (e) {
        debugPrint('geofence fetch error: $e');
      }
    }
    final pricingZoneId =
        (zoneGeo?['slug'] as String?)?.isNotEmpty == true
            ? zoneGeo!['slug'] as String
            : zoneId;

    final schedules = await _fetchSchedules(pricingZoneId, vehicleStr, dayStr);

    Map<String, dynamic>? schedule;
    for (final s in schedules) {
      final start = (s['start_time'] as String?) ?? (s['shift_start'] as String?);
      final end = (s['end_time'] as String?) ?? (s['shift_end'] as String?);
      if (start != null && end != null && _inWindow(currentTime, start, end)) {
        schedule = s;
        break;
      }
    }
    schedule ??= schedules.isNotEmpty ? schedules[0] : null;

    final cards = await _fetchCards(pricingZoneId, vehicleStr);
    final card = cards.isNotEmpty ? cards[0] : null;

    final minimumFare = (card?['minimum_fare'] as num?)?.toDouble() ?? 5000;
    final shiftStart = schedule != null
        ? ((schedule['start_time'] as String?) ?? (schedule['shift_start'] as String?))
        : null;
    final shiftEnd = schedule != null
        ? ((schedule['end_time'] as String?) ?? (schedule['shift_end'] as String?))
        : null;
    final base = (schedule?['base_fee'] as num?)?.toDouble() ?? minimumFare;
    final hourlyPct = (schedule?['hourly_increase_percent'] as num?)?.toDouble() ?? 0;
    final hoursElapsed = (shiftStart != null && shiftEnd != null)
        ? _getHoursSince(shiftStart, shiftEnd, dt)
        : 0.0;

    // Base_Ajustada = Base * (1 + (pct/100) * hours_elapsed).
    // Excepción: viajes cortos (< 1.5 km) en turno DIURNO quedan fijos y
    // planos en la tarifa mínima base, SIN incremento por horas transcurridas.
    // El turno nocturno/madrugada y las fechas especiales sí aplican recargo.
    final isDayTurn = schedule?['window_label'] == 'day' ||
        (schedule?['window_label'] == null && schedule?['shift_label'] == 'day');
    final shortDayTrip = distanceKm < 1.5 && isDayTurn;

    final baseAdjusted = shortDayTrip
        ? minimumFare
        : base * (1 + (hourlyPct / 100) * hoursElapsed);
    final extraCost = card != null ? _extraKmCost(distanceKm, card) : 0.0;
    final subtotal = baseAdjusted + extraCost;

    final rules = (await _fetchRules(pricingZoneId))
        .where((r) => r['vehicle_type'] == null || r['vehicle_type'] == vehicleStr)
        .toList();

    double dynamicMultiplier = 1.0;
    String? dynamicRuleName;

    for (final r in rules) {
      bool matches = false;
      try {
        final ruleType = r['rule_type'] as String?;

        if (ruleType == 'specific_date' && (r['is_recurring'] as bool? ?? true)) {
          final ruleDate = DateTime.parse(r['specific_date'] as String);
          if (dt.month == ruleDate.month && dt.day == ruleDate.day) {
            matches = true;
          }
        } else if (ruleType == 'date_range') {
          final from = r['date_from'] != null ? DateTime.parse(r['date_from'] as String) : null;
          final to = r['date_to'] != null ? DateTime.parse(r['date_to'] as String) : null;
          if (from != null &&
              to != null &&
              dt.isAfter(from.subtract(const Duration(days: 1))) &&
              dt.isBefore(to.add(const Duration(days: 1)))) {
            matches = true;
          }
        } else if (ruleType == 'day_of_week') {
          final days = (r['days_of_week'] as List?)?.cast<int>() ?? [];
          final dayNum = dt.weekday;
          if (days.contains(dayNum)) matches = true;
        } else if (ruleType == 'time_range') {
          final days = (r['days_of_week'] as List?)?.cast<int>() ?? [];
          final dayNum = dt.weekday;
          if (!days.contains(dayNum)) continue;
          final startTime = (r['start_time'] as String).substring(0, 5);
          final endTime = (r['end_time'] as String).substring(0, 5);
          if (currentTime.compareTo(startTime) >= 0 &&
              currentTime.compareTo(endTime) < 0) {
            matches = true;
          }
        }
      } catch (_) {
        // Regla mal formada: se ignora sin romper la estimación.
        continue;
      }

      if (matches) {
        dynamicMultiplier = (r['multiplier'] as num?)?.toDouble() ?? 1.0;
        dynamicRuleName = r['name'] as String?;
        break;
      }
    }

    // Techos por distancia (anillos) de la geofence: el subtotal se topa en
    // el máximo del anillo que alcanza la distancia, ANTES de aplicar las
    // reglas dinámicas de fecha (en festivos se paga por encima del techo).
    var fare = subtotal;
    final rings = (zoneGeo?['rings'] as List?) ?? const [];
    if (rings.isNotEmpty) {
      for (final r in rings) {
        if (r is! Map) continue;
        final maxKm = (r['max_km'] as num?)?.toDouble() ?? 0;
        if (distanceKm <= maxKm) {
          final cap = vehicleType == VehicleType.moto
              ? (r['moto'] as num?)?.toDouble() ?? 0
              : (r['car'] as num?)?.toDouble() ?? 0;
          if (cap > 0) fare = math.min(fare, cap);
          break;
        }
      }
    }
    fare = fare * dynamicMultiplier;
    final specialZoneApplied = false;

    // Tarifa mínima según vehículo y turno, y redondeo a la centena.
    // En el caso de viaje corto diurno el piso es la propia mínima (tarifa plana).
    final floor = shortDayTrip ? minimumFare : math.max(minimumFare, base);
    final finalAmount = _round100(math.max(fare, floor));
    final commissionPct = (card?['commission_percent'] as num?)?.toDouble() ?? 12;
    final commissionAmount = finalAmount * (commissionPct / 100);
    final driverEarnings = finalAmount - commissionAmount;

    final includedKm = 1.5;
    final extraKm = math.max(0.0, distanceKm - includedKm);
    final tier1Rate = (card?['tier1_rate_per_km'] as num?)?.toDouble() ?? 600;

    return PricingBreakdown(
      vehicleType: vehicleStr,
      dayType: dayStr,
      shiftLabel: schedule != null
          ? (schedule['window_label'] as String? ??
              schedule['shift_label'] as String? ??
              'day')
          : 'day',
      shiftStart: shiftStart ?? '05:00',
      shiftEnd: shiftEnd ?? '18:29',
      baseFeeAtShiftStart: base,
      hoursSinceShiftStart: _roundTo(hoursElapsed, 2),
      hourlyIncreasePercent: hourlyPct,
      currentBaseFee: baseAdjusted.roundToDouble(),
      includedKm: includedKm,
      distanceKm: distanceKm,
      extraKm: extraKm,
      extraKmPercent: tier1Rate,
      extraKmCharge: extraCost.roundToDouble(),
      subtotal: subtotal.roundToDouble(),
      dynamicMultiplier: dynamicMultiplier,
      dynamicRuleName: dynamicRuleName,
      finalFare: finalAmount,
      minimumFare: floor,
      commissionPercent: commissionPct,
      commissionAmount: commissionAmount.roundToDouble(),
      driverEarnings: driverEarnings.roundToDouble(),
      timeSurcharge: 0,
      specialZoneApplied: specialZoneApplied,
    );
  }

  double _roundTo(double value, int places) {
    final mod = math.pow(10, places).toDouble();
    return (value * mod).roundToDouble() / mod;
  }
}