import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app/app.dart';
import 'core/services/local_store.dart';

const _localStoreStartupTimeout = Duration(seconds: 8);

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(
    ProviderScope(
      child: BikeBuddyBootstrap(initialization: initializeLocalStore()),
    ),
  );
}

/// Initializes non-sensitive preferences without holding the native launch
/// screen indefinitely. If the platform store is unavailable, the app keeps
/// working with an in-memory store for the rest of this process.
@visibleForTesting
Future<void> initializeLocalStore({
  Future<void> Function()? initialize,
  Duration timeout = _localStoreStartupTimeout,
}) async {
  try {
    await (initialize ?? LocalStore.init).call().timeout(timeout);
  } catch (error) {
    LocalStore.useInMemoryFallback();
    debugPrint(
      'Local preferences are unavailable (${error.runtimeType}); '
      'using in-memory preferences.',
    );
  }
}

/// Replaces the native splash immediately with a small Flutter-owned startup
/// view, then reveals the application once preference initialization has
/// either succeeded or safely fallen back.
class BikeBuddyBootstrap extends StatelessWidget {
  final Future<void> initialization;
  final Widget app;

  const BikeBuddyBootstrap({
    super.key,
    required this.initialization,
    this.app = const BikeBuddyApp(),
  });

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<void>(
      future: initialization,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.done) return app;

        return const MaterialApp(
          debugShowCheckedModeBanner: false,
          home: Scaffold(
            body: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Image(
                    image: AssetImage('assets/images/bike-buddy-logo.png'),
                    width: 112,
                    semanticLabel: 'Bike Buddy',
                  ),
                  SizedBox(height: 20),
                  CircularProgressIndicator(),
                  SizedBox(height: 16),
                  Text('Preparing Bike Buddy...'),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}
