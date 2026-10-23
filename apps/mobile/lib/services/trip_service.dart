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

  Stream<List<Trip>> subscribeToPendingTrips() {
    return _trips
        .where('status', isEqualTo: 'pending')
        .where('driver_id', isNull: true)
        .orderBy('created_at', descending: true)
        .limit(20)
        .snapshots()
        .map((snap) => snap.docs.map((d) => Trip.fromJson(d.data())).toList());
  }

  Stream<Trip> subscribeToTrip(String tripId) {
    return _trips
        .doc(tripId)
        .snapshots()
        .where((doc) => doc.exists)
        .map((doc) => Trip.fromJson(doc.data()!));
  }

  Future<void> acceptTrip(String tripId, String driverId) async {
    await _trips.doc(tripId).update({
      'driver_id': driverId,
      'status': 'accepted',
      'accepted_at': Timestamp.now(),
    });
  }

  Future<void> rejectTrip(String tripId) async {
    await _trips.doc(tripId).update({
      'status': 'pending',
      'driver_id': null,
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
        .where('status', whereIn: ['pending', 'accepted', 'inProgress'])
        .limit(1)
        .get();
    if (snap.docs.isEmpty) return null;
    return Trip.fromJson(snap.docs.first.data());
  }

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
    double? fareAmount,
  }) async {
    final docRef = _trips.doc();
    final data = <String, dynamic>{
      'id': docRef.id,
      'passenger_id': passengerId,
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
      'fare_amount': fareAmount ?? 0,
      'created_at': Timestamp.now(),
    };
    await docRef.set(data);
    return Trip.fromJson({...data, 'id': docRef.id});
  }

  Future<void> cancelTrip(String tripId) async {
    await _trips.doc(tripId).update({'status': 'cancelled'});
  }
}
