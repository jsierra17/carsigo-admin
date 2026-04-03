📱 CarSiGo Mobile - Flutter Workspace

🤖 AVISO PARA EL AGENTE DE IA (GEMINI / STUDIO BOT / CASCADE)

Si eres una Inteligencia Artificial leyendo este archivo, este es tu manual operativo estricto para la Aplicación Móvil de CarSiGo.

Contexto: Estás dentro de la carpeta /carsigo-mobile. Este proyecto es 100% FLUTTER y DART.

Backend: Nuestro backend y base de datos ya están creados en Supabase (PostgreSQL + PostGIS). Usa el paquete oficial supabase_flutter.

Mapas: Usa mapbox_maps_flutter para la renderización de mapas.

Reglas de Negocio: CarSiGo es una app de transporte hiperlocal (estilo inDrive). Comisión del 12%, saldo mínimo de billetera requerido para conductores, negociación de tarifas.

🛠️ Stack Tecnológico Móvil

Framework: Flutter

Lenguaje: Dart

Gestor de Estado (Sugerido): flutter_riverpod (o el que indique el desarrollador).

Base de Datos & Auth: supabase_flutter

Mapas & GPS: mapbox_maps_flutter, geolocator

📂 Estructura de Carpetas Propuesta (lib/)

Deberás seguir esta arquitectura limpia al crear archivos:

/lib
 ├── /screens        # Pantallas completas (UI)
 │    ├── /auth      # Login, Registro, Validación OTP
 │    ├── /passenger # Flujo del pasajero (Pedir viaje, mapa)
 │    └── /driver    # Flujo del conductor (Ofertas, billetera)
 ├── /widgets        # Componentes UI reutilizables (Botones, Tarjetas)
 ├── /services       # Conexión externa (Supabase, Mapbox, API Registraduría)
 ├── /models         # Clases de datos (Usuario, Viaje, Geocerca)
 ├── /providers      # Gestión del estado global (Riverpod)
 └── main.dart       # Punto de entrada de la app


🚀 ROADMAP DE EJECUCIÓN MÓVIL (Paso a Paso)

🚧 Fase 3: Base de la App y Autenticación

Objetivo: Levantar el cascarón de la app y permitir el acceso de usuarios.

[ ] Limpiar el main.dart por defecto.

[ ] Configurar supabase_flutter en el main() con la URL y la Anon Key.

[ ] Crear el sistema de rutas (Navegación) para separar flujos: Pantalla de Pasajeros vs Pantalla de Conductores.

[ ] Crear la UI de Login (Registro con Teléfono OTP y/o Google).

[ ] Crear la UI de "Postulación a Conductor" (Subir fotos de Cédula y Licencia a Supabase Storage).

🚧 Fase 4: Mapas y Motor de Viajes (Tiempo Real)

Objetivo: Flujo hiperlocal tipo inDrive (Oferta/Contraoferta).

[ ] Integrar mapbox_maps_flutter en la pantalla principal.

[ ] Obtener ubicación GPS real del usuario (geolocator).

[ ] Regla Backend: Validar si el origen del usuario choca contra un polígono de la tabla Geofences (PostGIS) antes de permitirle pedir un viaje.

[ ] Implementar Supabase Realtime (WebSockets en Dart) para emitir solicitudes de viaje a conductores cercanos.

[ ] UI de ofertas: El pasajero ve tarjetas de conductores ofertando y elige uno.

[ ] Pantalla de ingreso del PIN de 4 dígitos para iniciar viaje.

🚧 Fase 5: Motor Financiero (La Billetera Móvil)

Objetivo: Gestión de saldos desde la app del conductor.

[ ] Leer el balance de la tabla Wallets en Supabase.

[ ] Lógica de bloqueo UI: Si Wallet.balance < 5000, mostrar pantalla de "Saldo Insuficiente" y detener escucha de nuevos viajes vía WebSockets.

[ ] Ejecutar penalidad: Notificar al backend si el conductor cancela el viaje estando a menos de 800m del destino.

🚧 Fase 6: Seguridad Anti-Fraude

Objetivo: Proteger a los pasajeros y conductores.

[ ] Integrar cámara nativa de Flutter para tomar Selfies obligatorias de biometría.

[ ] UI del Botón de Pánico Inteligente (Opción A: Policía, Opción B: Ambulancia).