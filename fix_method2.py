with open(r"C:\projects\carsigo-admin\apps\mobile\lib\screens\driver\driver_home_screen.dart", "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

old = """  Widget _buildNegotiatingWidgets(CarSiGoPalette p, Trip t, Future<void> Function(double)? onCounterOffer) {
    return [
      Row(children: [
        Expanded(
          child: _CounterOfferField(onSubmit: onCounterOffer!, minFare: t.fareCalculated),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: ElevatedButton(
            onPressed: () => onCounterOffer?.call(t.fareCounterOffer ?? t.fareOffered),
            style: ElevatedButton.styleFrom(
              backgroundColor: p.orange,
              foregroundColor: p.bg,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              textStyle: const TextStyle(fontWeight: FontWeight.w900),
              padding: const EdgeInsets.symmetric(vertical: 10),
            ),
            child: const Text('Enviar contraoferta', style: TextStyle(fontSize: 13)),
          ),
        ),
      ],
      SizedBox(height: 8),
    ];
  }
}"""

new = """  Widget _buildNegotiatingWidgets(CarSiGoPalette p, Trip t, Future<void> Function(double)? onCounterOffer) {
    return Row(children: [
      Expanded(
        child: _CounterOfferField(onSubmit: onCounterOffer!, minFare: t.fareCalculated),
      ),
      const SizedBox(width: 10),
      Expanded(
        child: ElevatedButton(
          onPressed: () => onCounterOffer?.call(t.fareCounterOffer ?? t.fareOffered),
          style: ElevatedButton.styleFrom(
            backgroundColor: p.orange,
            foregroundColor: p.bg,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            textStyle: const TextStyle(fontWeight: FontWeight.w900),
            padding: const EdgeInsets.symmetric(vertical: 10),
          ),
          child: const Text('Enviar contraoferta', style: TextStyle(fontSize: 13)),
        ),
      ),
    ]);
  }
}"""

with open(r"C:\projects\carsigo-admin\apps\mobile\lib\screens\driver\driver_home_screen.dart", "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

content = content.replace(old, new)

with open(r"C:\projects\carsigo-admin\apps\mobile\lib\screens\driver\driver_home_screen.dart", "w", encoding="utf-8") as f:
    f.write(content)

print("Done")