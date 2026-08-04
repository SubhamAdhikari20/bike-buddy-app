import 'dart:convert';

/// One server-sent event after UTF-8 decoding and SSE field folding.
class SseEvent {
  final String event;
  final String data;
  final String? id;
  final Duration? retry;

  const SseEvent({
    required this.event,
    required this.data,
    this.id,
    this.retry,
  });
}

/// Incremental SSE parser.
///
/// UTF-8 decoding is deliberately performed with Dart's chunked decoder so a
/// multi-byte character may be split across arbitrary network chunks. The
/// text parser then supports LF, CRLF and CR line endings, comments, named
/// events, persistent IDs and multiline `data:` fields.
class SseParser {
  const SseParser();

  Stream<SseEvent> bind(Stream<List<int>> bytes) async* {
    final parser = _SseTextParser();
    await for (final text in bytes.transform(utf8.decoder)) {
      for (final event in parser.add(text)) {
        yield event;
      }
    }
    for (final event in parser.close()) {
      yield event;
    }
  }
}

class _SseTextParser {
  String _buffer = '';
  final List<String> _dataLines = [];
  String _eventName = '';
  String? _lastEventId;
  Duration? _retry;
  bool _firstLine = true;

  List<SseEvent> add(String text) {
    _buffer += text;
    return _drainLines(allowTrailingCr: false);
  }

  List<SseEvent> close() {
    final events = _drainLines(allowTrailingCr: true);
    if (_buffer.isNotEmpty) {
      _processLine(_buffer, events);
      _buffer = '';
    }

    // A clean server normally terminates every event with a blank line. If a
    // connection closes immediately after data, retain that complete logical
    // event instead of dropping a user-visible notification.
    _dispatch(events);
    return events;
  }

  List<SseEvent> _drainLines({required bool allowTrailingCr}) {
    final events = <SseEvent>[];
    var start = 0;

    for (var index = 0; index < _buffer.length; index += 1) {
      final code = _buffer.codeUnitAt(index);
      if (code != 10 && code != 13) continue;

      if (code == 13 && index + 1 == _buffer.length && !allowTrailingCr) {
        break;
      }

      _processLine(_buffer.substring(start, index), events);
      if (code == 13 &&
          index + 1 < _buffer.length &&
          _buffer.codeUnitAt(index + 1) == 10) {
        index += 1;
      }
      start = index + 1;
    }

    if (start > 0) {
      _buffer = _buffer.substring(start);
    }
    return events;
  }

  void _processLine(String rawLine, List<SseEvent> events) {
    var line = rawLine;
    if (_firstLine) {
      _firstLine = false;
      if (line.startsWith('\uFEFF')) line = line.substring(1);
    }

    if (line.isEmpty) {
      _dispatch(events);
      return;
    }
    if (line.startsWith(':')) return;

    final colon = line.indexOf(':');
    final field = colon < 0 ? line : line.substring(0, colon);
    var value = colon < 0 ? '' : line.substring(colon + 1);
    if (value.startsWith(' ')) value = value.substring(1);

    switch (field) {
      case 'event':
        _eventName = value;
      case 'data':
        _dataLines.add(value);
      case 'id':
        if (!value.contains('\u0000')) _lastEventId = value;
      case 'retry':
        final milliseconds = int.tryParse(value);
        if (milliseconds != null && milliseconds >= 0) {
          _retry = Duration(milliseconds: milliseconds);
        }
    }
  }

  void _dispatch(List<SseEvent> events) {
    if (_dataLines.isNotEmpty) {
      events.add(
        SseEvent(
          event: _eventName.isEmpty ? 'message' : _eventName,
          data: _dataLines.join('\n'),
          id: _lastEventId,
          retry: _retry,
        ),
      );
    }
    _dataLines.clear();
    _eventName = '';
    _retry = null;
  }
}
