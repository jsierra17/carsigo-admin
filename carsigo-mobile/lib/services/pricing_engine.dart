import 'package:cloud_firestore/cloud_firestore.dart';

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
  });
}

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

DayType _getDayType(DateTime date) {
  final day = date.weekday;
  if (day == DateTime.saturday || day == DateTime.sunday) return DayType.weekend;
  return DayType.weekday;
}

String _currentTimeStr(DateTime dt) =>
    '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';

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
      final zoneSnap = await base
          .where('zone_id', isEqualTo: zoneId)
          .get();
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
      final zoneSnap = await base
          .where('zone_id', isEqualTo: zoneId)
          .get();
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

  Future<PricingBreakdown> calculateFare({
    required VehicleType vehicleType,
    required double distanceKm,
    double durationMin = 0,
    DateTime? datetime,
    String? zoneId,
  }) async {
    final dt = datetime ?? DateTime.now();
    final dayType = _getDayType(dt);
    // Con segundos para comparar correctamente contra horarios "HH:MM:SS".
    final currentTime = _currentTimeStr(dt) + ':00';
    final vehicleStr = vehicleType == VehicleType.moto ? 'moto' : 'car';
    final dayStr = dayType == DayType.weekday
        ? 'weekday'
        : dayType == DayType.weekend
            ? 'weekend'
            : 'special';

    final schedules = await _fetchSchedules(zoneId, vehicleStr, dayStr);

    Map<String, dynamic>? schedule;
    for (final s in schedules) {
      final start = s['shift_start'] as String;
      final end = s['shift_end'] as String;
      if (end.compareTo(start) <= 0) {
        if (currentTime.compareTo(start) >= 0 || currentTime.compareTo(end) < 0) {
          schedule = s;
          break;
        }
      } else {
        if (currentTime.compareTo(start) >= 0 && currentTime.compareTo(end) < 0) {
          schedule = s;
          break;
        }
      }
    }
    schedule ??= schedules.isNotEmpty ? schedules[0] : null;

    final cards = await _fetchCards(zoneId, vehicleStr);
    final card = cards.isNotEmpty ? cards[0] : null;

    final hoursSince = schedule != null
        ? _getHoursSince(
            schedule['shift_start'] as String,
            schedule['shift_end'] as String,
            dt,
          )
        : 0.0;
    final hourlyPct = (schedule?['hourly_increase_percent'] as num?)?.toDouble() ?? 0;
    final baseFee = (schedule?['base_fee'] as num?)?.toDouble() ?? (card?['base_fee'] as num?)?.toDouble() ?? 0;
    final currentBaseFee = baseFee * _pow(1 + hourlyPct / 100, hoursSince);

    final includedKm = (card?['included_km'] as num?)?.toDouble() ?? 2;
    final extraKmPct = (card?['extra_km_percent'] as num?)?.toDouble() ?? 50;
    final extraKm = _max(0, distanceKm - includedKm);
    final extraKmCharge = extraKm * (currentBaseFee * extraKmPct / 100);

    double subtotal = currentBaseFee + extraKmCharge;

    final rules = (await _fetchRules(zoneId))
        .where((r) =>
            r['vehicle_type'] == null ||
            r['vehicle_type'] == vehicleStr)
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
          if (from != null && to != null && dt.isAfter(from.subtract(const Duration(days: 1))) && dt.isBefore(to.add(const Duration(days: 1)))) {
            matches = true;
          }
        } else if (ruleType == 'day_of_week') {
          final days = (r['days_of_week'] as List?)?.cast<int>() ?? [];
          final dayNum = dt.weekday == 7 ? 7 : dt.weekday;
          if (days.contains(dayNum)) matches = true;
        } else if (ruleType == 'time_range') {
          final days = (r['days_of_week'] as List?)?.cast<int>() ?? [];
          final dayNum = dt.weekday == 7 ? 7 : dt.weekday;
          if (!days.contains(dayNum)) continue;
          final startTime = (r['start_time'] as String).substring(0, 5);
          final endTime = (r['end_time'] as String).substring(0, 5);
          if (currentTime.compareTo(startTime) >= 0 && currentTime.compareTo(endTime) < 0) {
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

    final finalFare = subtotal * dynamicMultiplier;
    final minimumFare = (card?['minimum_fare'] as num?)?.toDouble() ?? 5000;
    final commissionPct = (card?['commission_percent'] as num?)?.toDouble() ?? 10;
    final finalAmount = _max(finalFare, minimumFare);
    final commissionAmount = finalAmount * (commissionPct / 100);
    final driverEarnings = finalAmount - commissionAmount;

    return PricingBreakdown(
      vehicleType: vehicleStr,
      dayType: dayStr,
      shiftLabel: schedule != null ? (schedule['shift_label'] as String? ?? 'morning') : 'morning',
      shiftStart: schedule?['shift_start'] ?? '04:30',
      shiftEnd: schedule?['shift_end'] ?? '16:29',
      baseFeeAtShiftStart: baseFee,
      hoursSinceShiftStart: _roundTo(hoursSince, 2),
      hourlyIncreasePercent: hourlyPct,
      currentBaseFee: currentBaseFee.roundToDouble(),
      includedKm: includedKm,
      distanceKm: distanceKm,
      extraKm: extraKm,
      extraKmPercent: extraKmPct,
      extraKmCharge: extraKmCharge.roundToDouble(),
      subtotal: subtotal.roundToDouble(),
      dynamicMultiplier: dynamicMultiplier,
      dynamicRuleName: dynamicRuleName,
      finalFare: finalAmount.roundToDouble(),
      minimumFare: minimumFare,
      commissionPercent: commissionPct,
      commissionAmount: commissionAmount.roundToDouble(),
      driverEarnings: driverEarnings.roundToDouble(),
    );
  }

  double _pow(double base, double exp) {
    if (exp == 0) return 1;
    double result = 1;
    for (int i = 0; i < exp.floor(); i++) {
      result *= base;
    }
    final frac = exp - exp.floor();
    if (frac > 0) {
      result *= _exp(frac * _ln(base));
    }
    return result;
  }

  double _ln(double x) {
    if (x <= 0) return double.nan;
    double y = (x - 1) / (x + 1);
    double sum = 0;
    for (int i = 1; i <= 100; i += 2) {
      double term = _pow(y, i.toDouble()) / i;
      sum += term;
    }
    return 2 * sum;
  }

  double _exp(double x) {
    double sum = 1;
    double term = 1;
    for (int i = 1; i <= 50; i++) {
      term *= x / i;
      sum += term;
      if (term.abs() < 1e-10) break;
    }
    return sum;
  }

  double _max(double a, double b) => a > b ? a : b;
  double _roundTo(double value, int places) {
    final mod = _pow(10, places.toDouble());
    return (value * mod).roundToDouble() / mod;
  }
}
