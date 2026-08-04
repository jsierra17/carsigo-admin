enum TripStatus { pending, accepted, inProgress, completed, cancelled }

extension TripStatusX on TripStatus {
  String get apiValue {
    switch (this) {
      case TripStatus.pending: return 'pending';
      case TripStatus.accepted: return 'accepted';
      case TripStatus.inProgress: return 'inProgress';
      case TripStatus.completed: return 'completed';
      case TripStatus.cancelled: return 'cancelled';
    }
  }
  String get label {
    switch (this) {
      case TripStatus.pending: return 'Buscando conductor';
      case TripStatus.accepted: return 'Conductor en camino';
      case TripStatus.inProgress: return 'En viaje';
      case TripStatus.completed: return 'Completado';
      case TripStatus.cancelled: return 'Cancelado';
    }
  }
}

class Trip {
  final String id;
  final String passengerId;
  final String? driverId;
  final TripStatus status;
  final double fareAmount;
  final double commissionAmount;
  final String pickupAddress;
  final String? dropoffAddress;
  final double pickupLat;
  final double pickupLng;
  final double distanceKm;
  final double durationMin;
  final DateTime createdAt;
  final DateTime? acceptedAt;
  final DateTime? startedAt;
  final DateTime? completedAt;

  Trip({
    required this.id,
    required this.passengerId,
    this.driverId,
    required this.status,
    this.fareAmount = 0,
    this.commissionAmount = 0,
    required this.pickupAddress,
    this.dropoffAddress,
    this.pickupLat = 0,
    this.pickupLng = 0,
    this.distanceKm = 0,
    this.durationMin = 0,
    required this.createdAt,
    this.acceptedAt,
    this.startedAt,
    this.completedAt,
  });

  String get statusLabel => status.label;

  factory Trip.fromJson(Map<String, dynamic> json) {
    return Trip(
      id: json['id'],
      passengerId: json['passenger_id'],
      driverId: json['driver_id'],
      status: TripStatus.values.firstWhere(
        (e) => e.apiValue == json['status'],
        orElse: () => TripStatus.pending,
      ),
      fareAmount: (json['fare_amount'] ?? 0).toDouble(),
      commissionAmount: (json['commission_amount'] ?? 0).toDouble(),
      pickupAddress: json['pickup_address'] ?? '',
      dropoffAddress: json['dropoff_address'],
      distanceKm: (json['distance_km'] ?? 0).toDouble(),
      durationMin: (json['duration_min'] ?? 0).toDouble(),
      createdAt: DateTime.parse(json['created_at']),
      acceptedAt: json['accepted_at'] != null ? DateTime.parse(json['accepted_at']) : null,
      startedAt: json['started_at'] != null ? DateTime.parse(json['started_at']) : null,
      completedAt: json['completed_at'] != null ? DateTime.parse(json['completed_at']) : null,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'passenger_id': passengerId,
    'driver_id': driverId,
    'status': status.apiValue,
    'fare_amount': fareAmount,
    'commission_amount': commissionAmount,
    'pickup_address': pickupAddress,
    'dropoff_address': dropoffAddress,
    'pickup_lat': pickupLat,
    'pickup_lng': pickupLng,
    'distance_km': distanceKm,
    'duration_min': durationMin,
  };

  Trip copyWith({String? driverId, TripStatus? status}) {
    return Trip(
      id: id,
      passengerId: passengerId,
      driverId: driverId ?? this.driverId,
      status: status ?? this.status,
      fareAmount: fareAmount,
      commissionAmount: commissionAmount,
      pickupAddress: pickupAddress,
      dropoffAddress: dropoffAddress,
      distanceKm: distanceKm,
      durationMin: durationMin,
      createdAt: createdAt,
    );
  }
}
