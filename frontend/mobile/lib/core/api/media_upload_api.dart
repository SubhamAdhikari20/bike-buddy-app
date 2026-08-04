import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'api_client.dart';

enum UploadKind { profile, kyc, evidence, bike }

final mediaUploadApiProvider = Provider<MediaUploadApi>(
  (ref) => MediaUploadApi(ref.watch(apiClientProvider)),
);

class MediaUploadApi {
  final ApiClient _client;

  MediaUploadApi(this._client);

  Future<String> uploadOne(UploadKind kind, String filePath) async {
    if (kind == UploadKind.evidence || kind == UploadKind.bike) {
      throw ArgumentError('$kind requires uploadMany');
    }
    final formData = FormData.fromMap({
      'file': await MultipartFile.fromFile(filePath),
    });
    final res = await _client.upload('/uploads/${kind.name}', formData);
    final data = (res['data'] as Map).cast<String, dynamic>();
    return data['url'] as String;
  }

  Future<List<String>> uploadMany(
    UploadKind kind,
    List<String> filePaths,
  ) async {
    if (kind != UploadKind.evidence && kind != UploadKind.bike) {
      throw ArgumentError('$kind requires uploadOne');
    }
    final files = <MultipartFile>[];
    for (final path in filePaths) {
      files.add(await MultipartFile.fromFile(path));
    }
    final formData = FormData.fromMap({'files': files});
    final res = await _client.upload('/uploads/${kind.name}', formData);
    final data = (res['data'] as Map).cast<String, dynamic>();
    final stored = data['files'] as List? ?? const [];
    return stored
        .map((item) => ((item as Map).cast<String, dynamic>())['url'] as String)
        .toList(growable: false);
  }
}
