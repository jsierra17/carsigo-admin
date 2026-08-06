import 'package:cloud_firestore/cloud_firestore.dart';

enum UserRole { passenger, driver, admin }

class UserProfile {
  final String id;
  final String phone;
  final String? fullName;
  final UserRole role;
  final String? avatarUrl;
  final DateTime createdAt;

  UserProfile({
    required this.id,
    required this.phone,
    this.fullName,
    required this.role,
    this.avatarUrl,
    required this.createdAt,
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
      role: _parseRole(json['role']),
      avatarUrl: json['avatar_url'],
      createdAt: createdAt,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'phone': phone,
      'name': fullName,
      'full_name': fullName,
      'role': role.name,
      'avatar_url': avatarUrl,
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
    UserRole? role,
    String? avatarUrl,
  }) {
    return UserProfile(
      id: id,
      phone: phone,
      fullName: fullName ?? this.fullName,
      role: role ?? this.role,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      createdAt: createdAt,
    );
  }
}
