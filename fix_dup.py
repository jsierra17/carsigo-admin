with open(r"C:\projects\carsigo-admin\apps\mobile\lib\screens\driver\driver_home_screen.dart", "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

# Fix duplicate method declarations
content = content.replace(
    "  Widget _buildNegotiatingWidgets(CarSiGoPalette p, Trip t, Future<void> Function(double)? onCounterOffer) {\n  Widget _buildNegotiatingWidgets(CarSiGoPalette p, Trip t, Future<void> Function(double)? onCounterOffer) {",
    "  Widget _buildNegotiatingWidgets(CarSiGoPalette p, Trip t, Future<void> Function(double)? onCounterOffer) {"
)

with open(r"C:\projects\carsigo-admin\apps\mobile\lib\screens\driver\driver_home_screen.dart", "w", encoding="utf-8") as f:
    f.write(content)

print("Done")