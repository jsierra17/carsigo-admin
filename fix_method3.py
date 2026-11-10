with open(r"C:\projects\carsigo-admin\apps\mobile\lib\screens\driver\driver_home_screen.dart", "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

# Find and replace the method
lines = content.split('\n')
in_method = False
new_lines = []
i = 0
while i < len(lines):
    line = lines[i]
    if "Widget _buildNegotiatingWidgets(CarSiGoPalette p, Trip t, Future<void> Function(double)? onCounterOffer) {" in line:
        in_method = True
        new_lines.append(line)
        # Skip until we find the end of the method
        i += 1
        # Skip until we find the closing brace of the method
        brace_count = 1
        while i < len(lines) and brace_count > 0:
            l = lines[i]
            for ch in l:
                if ch == '{':
                    brace_count += 1
                elif ch == '}':
                    brace_count -= 1
                    if brace_count == 0:
                        break
            i += 1
        # Add the new method body
        new_lines.extend([
            "  Widget _buildNegotiatingWidgets(CarSiGoPalette p, Trip t, Future<void> Function(double)? onCounterOffer) {",
            "    return Row(children: [",
            "      Expanded(",
            "        child: _CounterOfferField(onSubmit: onCounterOffer!, minFare: t.fareCalculated),",
            "      ),",
            "      const SizedBox(width: 10),",
            "      Expanded(",
            "        child: ElevatedButton(",
            "          onPressed: () => onCounterOffer?.call(t.fareCounterOffer ?? t.fareOffered),",
            "          style: ElevatedButton.styleFrom(",
            "            backgroundColor: p.orange,",
            "            foregroundColor: p.bg,",
            "            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),",
            "            textStyle: const TextStyle(fontWeight: FontWeight.w900),",
            "            padding: const EdgeInsets.symmetric(vertical: 10),",
            "          ),",
            "          child: const Text('Enviar contraoferta', style: TextStyle(fontSize: 13)),",
            "        ),",
            "      ),",
            "    ]);",
            "  }",
            "}"
        ])
    else:
        new_lines.append(line)
        i += 1

content = '\n'.join(new_lines)

with open(r"C:\projects\carsigo-admin\apps\mobile\lib\screens\driver\driver_home_screen.dart", "w", encoding="utf-8") as f:
    f.write(content)

print("Done")