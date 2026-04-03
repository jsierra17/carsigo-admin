🚗 CarSiGo - Master Workspace & AI Agent Guide

🤖 AVISO PARA EL AGENTE DE IA (WINDSURF / CASCADE /VISUAL STUDIO CODE O SIMILAR)

Si eres una Inteligencia Artificial leyendo este archivo, este es tu manual operativo estricto. La arquitectura ha evolucionado: el panel admin es web (Next.js) y la aplicación móvil es 100% FLUTTER.

NO asumas ni inventes tecnologías: Apégate al Stack Tecnológico definido aquí. NO uses React Native para la app móvil.

Contexto de Lenguajes: Para la carpeta /app y /admin usa TypeScript/React. Para la carpeta /carsigo-mobile usa exclusívamente DART y el framework FLUTTER.

Revisa siempre el PRD: Para dudas sobre reglas de negocio (tarifas, comisiones, seguridad), lee obligatoriamente el archivo DOCUMENTACION.md.

Sigue el Roadmap: No te adelantes a construir características de Fases futuras a menos que el desarrollador (Jose) te lo indique explícitamente.

🛠️ Stack Tecnológico

Web Admin: Next.js 16 (App Router, Turbopack), React 19, Tailwind CSS.

App Móvil: Flutter (Lenguaje Dart) para compilación nativa en iOS y Android.

Base de Datos & Auth: Supabase (PostgreSQL). SDKs: @supabase/supabase-js (Web) y supabase_flutter (Móvil).

Geolocalización: PostGIS (Backend), Mapbox GL JS (Web) y mapbox_maps_flutter (Móvil).

📂 Estructura del Proyecto

/carsigo-admin (Raíz)
 ├── /app                  # Frontend Web (Next.js App Router)
 │    ├── /admin           # Panel Administrativo (Dashboard, Conductores, Zonas, Finanzas)
 │    └── /login           # Autenticación Web
 ├── /components           # Componentes reutilizables de React (UI)
 ├── /lib                  # Utilidades core web (supabase.ts, types, etc.)
 ├── /carsigo-mobile       # Sub-proyecto: Aplicación Móvil (FLUTTER / DART)
 │    ├── /lib             # Código fuente de Flutter (main.dart, screens, widgets)
 │    └── pubspec.yaml     # Dependencias de Flutter
 ├── .env.local            # Variables de entorno Web
 ├── DOCUMENTACION.md      # Reglas de negocio y PRD (¡Lectura obligatoria!)
 └── README.md             # Este archivo


🚀 ROADMAP DE EJECUCIÓN (Paso a Paso)

✅ Fase 1: Arquitectura de Base de Datos

[x] Crear proyecto en Supabase.

[x] Habilitar extensión PostGIS.

[x] Crear tablas core (Users, Driver_Profiles, Geofences, Wallets).

[x] Configurar llaves y apagar RLS temporalmente para desarrollo.

✅ Fase 2: Panel Administrativo Web (COMPLETADA)

[x] UI del Dashboard, Conductores, Zonas y Finanzas.

[x] Middleware y Rutas Protegidas.

[x] CRUD de Zonas (Búsqueda por municipio + guardado de polígonos).

[x] Mejoras del Motor Financiero (Reportes PDF, filtros, toasts).

[x] Dashboard en Tiempo Real y Tabla de Viajes.

🚧 Fase 3: App Móvil Base (FLUTTER) - ESTADO ACTUAL

Objetivo: Levantar el entorno móvil nativo para Pasajeros y Conductores.

[ ] Inicializar proyecto de Flutter en el directorio /carsigo-mobile.

[ ] Configurar el archivo pubspec.yaml con dependencias clave (supabase_flutter, flutter_riverpod o provider para estado, go_router para navegación).

[ ] Configurar variables de entorno en Flutter para las llaves de Supabase.

[ ] Crear estructura de carpetas dentro de carsigo-mobile/lib (screens, widgets, services).

[ ] Integrar Supabase Auth (Pantallas de Login/Registro para Pasajero y Conductor).

🚧 Fase 4: Motor de Viajes en Flutter (Tiempo Real)

Objetivo: Flujo tipo inDrive (Oferta/Contraoferta) en la App.

[ ] Integrar mapbox_maps_flutter para renderizar el mapa interactivo.

[ ] Validar ubicación del usuario (GPS del dispositivo) contra la tabla Geofences (PostGIS).

[ ] Implementar Supabase Realtime en Dart para emitir y escuchar solicitudes de viaje.

[ ] UI de contraofertas y selección de conductores.

[ ] Pantalla de ingreso del PIN de 4 dígitos.

🚧 Fase 5: Motor Financiero (La Billetera Móvil)

Objetivo: Gestión de saldos desde la app del conductor.

[ ] Lógica de bloqueo en la UI: Ocultar viajes si Wallet.balance < 5000.

[ ] Pantalla de recargas e integración de pasarelas (Nequi, Daviplata, PSE).

[ ] Ejecutar penalidad del 24% por cancelación a menos de 800m.

🚧 Fase 6: Seguridad y Escalabilidad Avanzada

Objetivo: Blindar la plataforma.

[ ] Integrar validación de antecedentes (Registraduría).

[ ] Biometría Facial nativa (Cámara en Flutter) al inicio de sesión.

[ ] Botón de Pánico Inteligente.

[ ] Encender reglas RLS en Supabase.