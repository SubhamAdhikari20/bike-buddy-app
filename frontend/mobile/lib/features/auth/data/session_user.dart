/// The signed-in user as returned by the backend: the base account plus
/// the role profile (renter or owner).
class SessionUser {
  final String id;
  final String email;
  final String role;
  final bool isVerified;
  final String? profileId;
  final String fullName;
  final String? phoneNumber;
  final String? profilePictureUrl;
  final String? bio;
  final String kycStatus;

  const SessionUser({
    required this.id,
    required this.email,
    required this.role,
    required this.isVerified,
    this.profileId,
    required this.fullName,
    this.phoneNumber,
    this.profilePictureUrl,
    this.bio,
    this.kycStatus = 'unverified',
  });

  bool get isRenter => role == 'renter';
  bool get isOwner => role == 'owner';
  bool get isKycApproved => kycStatus == 'approved';
  bool get isKycPending => kycStatus == 'pending';

  factory SessionUser.fromSession(Map<String, dynamic> json) {
    final user = (json['user'] as Map).cast<String, dynamic>();
    final profile = (json['profile'] as Map?)?.cast<String, dynamic>() ?? {};
    return SessionUser(
      id: (user['id'] ?? user['_id'] ?? '').toString(),
      email: user['email'] as String? ?? '',
      role: user['role'] as String? ?? 'renter',
      isVerified: user['isVerified'] as bool? ?? false,
      profileId: (profile['_id'] ?? profile['id'])?.toString(),
      fullName: profile['fullName'] as String? ?? '',
      phoneNumber: profile['phoneNumber'] as String?,
      profilePictureUrl: profile['profilePictureUrl'] as String?,
      bio: profile['bio'] as String?,
      kycStatus: profile['kycStatus'] as String? ?? 'unverified',
    );
  }

  Map<String, dynamic> toJson() => {
        'user': {
          'id': id,
          'email': email,
          'role': role,
          'isVerified': isVerified,
        },
        'profile': {
          '_id': profileId,
          'fullName': fullName,
          'phoneNumber': phoneNumber,
          'profilePictureUrl': profilePictureUrl,
          'bio': bio,
          'kycStatus': kycStatus,
        },
      };
}
