import re

with open(r"C:\projects\carsigo-admin\apps\mobile\lib\screens\driver\driver_home_screen.dart", "r", encoding="utf-8") as f:
    content = f.read()

old_method = r"""List<Widget> _buildNegotiatingWidgets\(CarSiGoPalette p, Trip t, bool isNegotiating, Future<void> Function\(double\)\? onCounterOffer\) \{
    if \(!isNegotiating\) return \[\];
    return \[
      Row\(children: \[
        Expanded\(
          child: _CounterOfferField\(onSubmit: onCounterOffer!, minFare: t\.fareCalculated\),
        \),
        const SizedBox\(width: 10\),
        Expanded\(
          child: ElevatedButton\(
            onPressed: \(\) => onCounterOffer\?\.call\(t\.fareCounterOffer \?\? t\.fareOffered\),
            style: ElevatedButton\.styleFrom\(
              backgroundColor: p\.orange,
              foregroundColor: p\.bg,
              shape: RoundedRectangleBorder\(borderRadius: BorderRadius\.circular\(12\)\),
              textStyle: const TextStyle\(fontWeight: FontWeight\.w900\),
              padding: const EdgeInsets\.symmetric\(vertical: 10\),
            \),
            child: const Text\('Enviar contraoferta', style: TextStyle\(fontSize: 13\)\),
          \),
        \),
      \),
      SizedBox\(height: 8\),
    \];
  \}
\}"""

new_method = """Widget _buildNegotiatingWidgets(CarSiGoPalette p, Trip t, Future<void> Function(double)? onCounterOffer) {
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

content = re.sub(old_method, new_method, content, flags=re.DOTALL)

with open(r"C:\projects\carsigo-admin\apps\mobile\lib\screens\driver\driver_home_screen.dart", "w", encoding="utf-8") as f:
    f.write(content)

print("Done")