import 'package:cloud_firestore/cloud_firestore.dart';

enum UserRole { passenger, driver, admin }

class UserProfile {
  final String id;
  final String phone;
  final String? fullName;
  final String? firstName;
  final String? lastName;
  final String? idNumber; // Cédula
  final UserRole role;
  final String? avatarUrl;
  final DateTime createdAt;
  final bool profileCompleted;

  UserProfile({
    required this.id,
    required this.phone,
    this.fullName,
    this.firstName,
    this.lastName,
    this.idNumber,
    required this.role,
    this.avatarUrl,
    required this.createdAt,
    this.profileCompleted = false,
  });

  String get displayName => fullName ?? phone;

  factory UserProfile.fromJson(Map<String, dynamic> json) {
    final createdAtRaw = json['created_at'];
    final createdAt = createdAtRaw is DateTime
        ? createdAtRaw
        : createdAtRaw is Timestamp
            ? createdAtRaw.toDate()
            : DateTime.tryParse(createdAtRaw?.toString() ?? '') ??
                DateTime.now();

    return UserProfile(
      id: json['id'],
      phone: json['phone'] ?? '',
      fullName: json['full_name'] ?? json['name'],
      firstName: json['first_name'],
      lastName: json['last_name'],
      idNumber: json['id_number'],
      role: _parseRole(json['role']),
      avatarUrl: json['avatar_url'],
      createdAt: createdAt,
      profileCompleted: json['profile_completed'] == true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'phone': phone,
      'name': fullName,
      'full_name': fullName,
      'first_name': firstName,
      'last_name': lastName,
      'id_number': idNumber,
      'role': role.name,
      'avatar_url': avatarUrl,
      'profile_completed': profileCompleted,
    };
  }

  static UserRole _parseRole(String? role) {
    switch (role) {
      case 'driver':
        return UserRole.driver;
      case 'admin':
        return UserRole.admin;
      default:
        return UserRole.passenger;
    }
  }

  UserProfile copyWith({
    String? fullName,
    String? firstName,
    String? lastName,
    String? idNumber,
    UserRole? role,
    String? avatarUrl,
    bool? profileCompleted,
  }) {
    return UserProfile(
      id: id,
      phone: phone,
      fullName: fullName ?? this.fullName,
      firstName: firstName ?? this.firstName,
      lastName: lastName ?? this.lastName,
      idNumber: idNumber ?? this.idNumber,
      role: role ?? this.role,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      createdAt: createdAt,
      profileCompleted: profileCompleted ?? this.profileCompleted,
    );
  }
}
