import 'package:flutter_test/flutter_test.dart';
import 'package:carsigo_mobile/main.dart';

void main() {
  testWidgets('CarSiGo basic smoke test', (WidgetTester tester) async {
    // Build our app and trigger a frame.
    await tester.pumpWidget(const CarSiGoApp());

    // Verify that we are on the welcome screen.
    expect(find.text('CarSiGo'), findsOneWidget);
    expect(find.text('Comenzar'), findsOneWidget);
  });
}
