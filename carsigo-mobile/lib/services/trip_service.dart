import 'dart:async';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/trip.dart';

class TripService {
  final SupabaseClient _supabase = Supabase.instance.client;

  Future<List<Trip>> getPendingTrips() async {
    final data = await _supabase
        .from('trips')
        .select()
        .eq('status', 'pending')
        .isFilter('driver_id', null)
        .order('created_at', ascending: false)
        .limit(20);
    return (data as List).map((j) => Trip.fromJson(j)).toList();
  }

  Future<Trip?> getActiveDriverTrip(String userId) async {
    final data = await _supabase
        .from('trips')
        .select()
        .eq('driver_id', userId)
        .inFilter('status', ['accepted', 'inProgress'])
        .maybeSingle();
    if (data == null) return null;
    return Trip.fromJson(data);
  }

  Stream<List<Trip>> subscribeToPendingTrips() {
    final controller = StreamController<List<Trip>>.broadcast();
    _loadAndListen(controller);
    return controller.stream;
  }

  void _loadAndListen(StreamController<List<Trip>> controller) async {
    controller.add(await getPendingTrips());
    _supabase
        .channel('pending-trips')
        .onPostgresChanges(
          event: PostgresChangeEvent.insert,
          table: 'trips',
          schema: 'public',
          callback: (_) async {
            if (!controller.isClosed) controller.add(await getPendingTrips());
          },
        )
        .onPostgresChanges(
          event: PostgresChangeEvent.update,
          table: 'trips',
          schema: 'public',
          callback: (_) async {
            if (!controller.isClosed) controller.add(await getPendingTrips());
          },
        )
        .subscribe();
  }

  Stream<Trip> subscribeToTrip(String tripId) {
    final controller = StreamController<Trip>.broadcast();
    _supabase
        .channel('trip-$tripId')
        .onPostgresChanges(
          event: PostgresChangeEvent.update,
          table: 'trips',
          schema: 'public',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'id',
            value: tripId,
          ),
          callback: (change) {
            if (!controller.isClosed) controller.add(Trip.fromJson(change.newRecord));
          },
        )
        .subscribe();
    return controller.stream;
  }

  Future<void> acceptTrip(String tripId, String driverId) async {
    await _supabase.from('trips').update({
      'driver_id': driverId,
      'status': 'accepted',
      'accepted_at': DateTime.now().toUtc().toIso8601String(),
    }).eq('id', tripId);
  }

  Future<void> rejectTrip(String tripId) async {
    await _supabase.from('trips').update({
      'status': 'pending',
      'driver_id': null,
    }).eq('id', tripId);
  }

  Future<void> startTrip(String tripId) async {
    await _supabase.from('trips').update({
      'status': 'inProgress',
      'started_at': DateTime.now().toUtc().toIso8601String(),
    }).eq('id', tripId);
  }

  Future<void> completeTrip(String tripId, {double? fareAmount, double? commissionAmount}) async {
    final updates = <String, dynamic>{
      'status': 'completed',
      'completed_at': DateTime.now().toUtc().toIso8601String(),
    };
    if (fareAmount != null) updates['fare_amount'] = fareAmount;
    if (commissionAmount != null) updates['commission_amount'] = commissionAmount;
    await _supabase.from('trips').update(updates).eq('id', tripId);
  }

  Future<void> setDriverAvailability(String userId, bool available) async {
    await _supabase.rpc('set_driver_availability', params: {'p_available': available});
  }

  Future<Trip?> getActivePassengerTrip(String userId) async {
    final data = await _supabase
        .from('trips')
        .select()
        .eq('passenger_id', userId)
        .inFilter('status', ['pending', 'accepted', 'inProgress'])
        .maybeSingle();
    if (data == null) return null;
    return Trip.fromJson(data);
  }

  Future<Trip> createTrip({
    required String passengerId,
    required String pickupAddress,
    String? dropoffAddress,
    double pickupLat = 0,
    double pickupLng = 0,
    double? distanceKm,
    double? durationMin,
  }) async {
    final response = await _supabase
        .from('trips')
        .insert({
          'passenger_id': passengerId,
          'status': 'pending',
          'pickup_address': pickupAddress,
          'dropoff_address': dropoffAddress,
          'pickup_lat': pickupLat,
          'pickup_lng': pickupLng,
          'distance_km': distanceKm ?? 0,
          'duration_min': durationMin ?? 0,
        })
        .select()
        .single();
    return Trip.fromJson(response);
  }

  Future<void> cancelTrip(String tripId) async {
    await _supabase.from('trips').update({ 'status': 'cancelled' }).eq('id', tripId);
  }
}
