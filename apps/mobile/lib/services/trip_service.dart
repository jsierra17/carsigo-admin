import 'dart:async';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../models/trip.dart';

class TripService {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;

  CollectionReference<Map<String, dynamic>> get _trips =>
      _firestore.collection('trips');

  Future<List<Trip>> getPendingTrips() async {
    final snap = await _trips
        .where('status', isEqualTo: 'pending')
        .where('driver_id', isNull: true)
        .orderBy('created_at', descending: true)
        .limit(20)
        .get();
    return snap.docs.map((d) => Trip.fromJson(d.data())).toList();
  }

  Future<Trip?> getActiveDriverTrip(String userId) async {
    final snap = await _trips
        .where('driver_id', isEqualTo: userId)
        .where('status', whereIn: ['accepted', 'inProgress'])
        .limit(1)
        .get();
    if (snap.docs.isEmpty) return null;
    return Trip.fromJson(snap.docs.first.data());
  }

  /// Stream de viajes pendientes o en negociación para el feed del conductor.
  /// Opcionalmente filtra por zona (zone_id) si se proporciona.
  Stream<List<Trip>> subscribeToPendingTrips({String? zoneId}) {
    var query = _trips
        .where('status', whereIn: ['pending', 'negotiating'])
        .where('driver_id', isNull: true)
        .orderBy('created_at', descending: true)
        .limit(20);
    if (zoneId != null) {
      query = query.where('zone_id', isEqualTo: zoneId);
    }
    return query.snapshots().map(
        (snap) => snap.docs.map((d) => Trip.fromJson(d.data())).toList());
  }

  Stream<Trip> subscribeToTrip(String tripId) {
    return _trips
        .doc(tripId)
        .snapshots()
        .where((doc) => doc.exists)
        .map((doc) => Trip.fromJson(doc.data()!));
  }

  /// El conductor acepta la oferta del pasajero (o su propia contraoferta).
  /// Cambia estado a 'accepted' y asigna driver_id.
  Future<void> acceptTrip(String tripId, String driverId) async {
    await _trips.doc(tripId).update({
      'driver_id': driverId,
      'status': 'accepted',
      'accepted_at': Timestamp.now(),
    });
  }

  /// El conductor hace una contraoferta. Debe ser >= fare_calculated.
  /// Cambia estado a 'negotiating'.
  Future<void> sendCounterOffer(
      String tripId, String driverId, double counterOffer) async {
    final tripRef = _trips.doc(tripId);
    final snap = await tripRef.get();
    if (!snap.exists) throw Exception('Viaje no encontrado');

    final trip = Trip.fromJson(snap.data()!);
    final minFare = trip.fareCalculated;

    if (counterOffer < minFare) {
      throw ArgumentError(
          'La contraoferta no puede ser menor a la tarifa calculada (\$${minFare.toStringAsFixed(0)})');
    }

    await tripRef.update({
      'driver_id': driverId,
      'status': 'negotiating',
      'fare_counter_offer': counterOffer,
      'fare_amount': counterOffer, // El precio final se actualiza a la contraoferta
    });
  }

  /// El pasajero acepta la contraoferta del conductor.
  /// Cambia estado de 'negotiating' a 'accepted'.
  Future<void> acceptDriverCounterOffer(String tripId) async {
    final tripRef = _trips.doc(tripId);
    final snap = await tripRef.get();
    if (!snap.exists) throw Exception('Viaje no encontrado');

    final data = snap.data()!;
    if (data['status'] != 'negotiating') {
      throw StateError('El viaje no está en estado de negociación');
    }

    await tripRef.update({
      'status': 'accepted',
      'accepted_at': Timestamp.now(),
      // fare_amount ya tiene el valor de la contraoferta
    });
  }

  Future<void> rejectTrip(String tripId) async {
    await _trips.doc(tripId).update({
      'status': 'pending',
      'driver_id': null,
      'fare_counter_offer': null,
    });
  }

  Future<void> startTrip(String tripId) async {
    await _trips.doc(tripId).update({
      'status': 'inProgress',
      'started_at': Timestamp.now(),
    });
  }

  Future<void> completeTrip(
    String tripId, {
    double? fareAmount,
    double? commissionAmount,
  }) async {
    final updates = <String, dynamic>{
      'status': 'completed',
      'completed_at': Timestamp.now(),
    };
    if (fareAmount != null) updates['fare_amount'] = fareAmount;
    if (commissionAmount != null) {
      updates['commission_amount'] = commissionAmount;
    }
    await _trips.doc(tripId).update(updates);
  }

  Future<void> setDriverAvailability(String userId, bool available) async {
    await _firestore
        .collection('driver_profiles')
        .doc(userId)
        .set({'is_available': available}, SetOptions(merge: true));
  }

  Future<Trip?> getActivePassengerTrip(String userId) async {
    final snap = await _trips
        .where('passenger_id', isEqualTo: userId)
        .where('status', whereIn: ['pending', 'negotiating', 'accepted', 'inProgress'])
        .limit(1)
        .get();
    if (snap.docs.isEmpty) return null;
    return Trip.fromJson(snap.docs.first.data());
  }

  /// Crea un viaje con oferta del pasajero.
  /// Valida que fare_offered >= fare_calculated.
  /// fare_calculated se calcula en el cliente usando PricingEngine (o se pasa desde la UI).
  Future<Trip> createTrip({
    required String passengerId,
    required String pickupAddress,
    String? dropoffAddress,
    double pickupLat = 0,
    double pickupLng = 0,
    double? dropoffLat,
    double? dropoffLng,
    double? distanceKm,
    double? durationMin,
    String? vehicleType,
    required double fareCalculated,
    required double fareOffered,
    String? zoneId,
    String? passengerName,
  }) async {
    if (fareOffered < fareCalculated) {
      throw ArgumentError(
          'La oferta no puede ser menor a la tarifa calculada (\$${fareCalculated.toStringAsFixed(0)})');
    }

    final docRef = _trips.doc();
    final data = <String, dynamic>{
      'id': docRef.id,
      'passenger_id': passengerId,
      'passenger_name': passengerName,
      'status': 'pending',
      'pickup_address': pickupAddress,
      'dropoff_address': dropoffAddress,
      'pickup_lat': pickupLat,
      'pickup_lng': pickupLng,
      'dropoff_lat': dropoffLat,
      'dropoff_lng': dropoffLng,
      'pickup_location': GeoPoint(pickupLat, pickupLng),
      'distance_km': distanceKm ?? 0,
      'duration_min': durationMin ?? 0,
      'vehicle_type': vehicleType ?? 'moto',
      'fare_calculated': fareCalculated,
      'fare_offered': fareOffered,
      'fare_amount': fareOffered, // El precio final inicial es la oferta del pasajero
      'created_at': Timestamp.now(),
    };
    if (zoneId != null) data['zone_id'] = zoneId;
    await docRef.set(data);
    return Trip.fromJson({...data, 'id': docRef.id});
  }

  Future<void> cancelTrip(String tripId) async {
    await _trips.doc(tripId).update({'status': 'cancelled'});
  }
}
