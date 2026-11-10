# TODO: Fare Negotiation Feature (inDrive-style) + Driver UI Updates

## Completed

### 1. Modelo de datos (Flutter) - `apps/mobile/lib/models/trip.dart`
- [x] `TripStatus` enum: agregado `negotiating`
- [x] Campos nuevos: `fareCalculated`, `fareOffered`, `fareCounterOffer`, `fareAmount`
- [x] `fromJson`/`toJson` actualizados con snake_case
- [x] `apiValue` incluye `'negotiating'`

### 2. Servicio de viajes - `apps/mobile/lib/services/trip_service.dart`
- [x] `createTrip(..., fareCalculated, fareOffered)`: valida `fareOffered >= fareCalculated`
- [x] `subscribeToPendingTrips(zoneId?)`: escucha `pending` y `negotiating`
- [x] `sendCounterOffer(tripId, driverId, counterOffer)`: conductor contrapropone, estado → `negotiating`
- [x] `acceptTrip(tripId, driverId)`: conductor acepta oferta pasajero
- [x] `acceptDriverCounterOffer(tripId)`: pasajero acepta contraoferta del conductor
- [x] Validaciones: nadie puede bajar de `fareCalculated`

### 3. Reglas Firestore - `firebase/firestore.rules`
- [x] `create` (pasajero): `fare_offered >= fare_calculated` y `fare_amount == fare_offered`
- [x] `update` conductor (contraoferta): `pending` → `negotiating` + `fare_counter_offer >= fare_calculated`
- [x] `update` pasajero (acepta contraoferta): `negotiating` → `accepted` + `fare_amount == fare_counter_offer`
- [x] `update` conductor (acepta oferta): `pending`/`negotiating` → `accepted`
- [x] Protección `fare_calculated` inmutable via helper `tripImmutableFieldsUnchanged`

### 4. UI Conductor - `apps/mobile/lib/screens/driver/driver_home_screen.dart`
- [x] Feed muestra viajes `pending` y `negotiating`
- [x] Card muestra badge "NEGOCIANDO" en ámbar
- [x] Muestra oferta del pasajero, contraoferta actual, tarifa base mínima
- [x] Campo de texto para contraoferta con validación mínima (`>= fareCalculated`)
- [x] Botón "Enviar contraoferta" (ámbar) + botón "Aceptar oferta del pasajero" (ámbar en negociación)
- [x] Botón "Rechazar" siempre visible

### 5. UI Pasajero - `apps/mobile/lib/screens/passenger/passenger_home_screen.dart`
- [x] Adaptado a nueva firma `createTrip(fareCalculated, fareOffered)`

### 6. Historial - `apps/mobile/lib/screens/trip_history_screen.dart`
- [x] Color ámbar para estado `negotiating`

### 7. Validaciones
- [x] `flutter analyze`: solo warning menor (operador `?.` innecesario en línea 656)
- [x] `npm run build` (admin-web): ✅ Built in 4.33s

---

## Para probar en dos teléfonos Android

### Requisitos previos
1. Dos usuarios en Firebase Auth con roles:
   - Usuario A: `role: "passenger"` (teléfono 1)
   - Usuario B: `role: "driver"` + `driver_profiles` con `status: "active"` + `vehicle_type` (teléfono 2)
2. Ambos teléfonos con la app instalada (`flutter run --release` o `flutter build apk --release`)

### Pasos de prueba
1. **Teléfono 1 (Pasajero)**: Abre app → busca destino → ve tarifa calculada → sube la oferta (slider) → "SOLICITAR VIAJE"
2. **Teléfono 2 (Conductor)**: Activa switch "Disponible" → aparece card del viaje con badge "NEGOCIANDO" si el pasajero ofreció más que la base
   - Ve: "Oferta del pasajero: $X", "Tarifa base (mínimo): $Y"
   - Escribe contraoferta ≥ tarifa base → "Enviar contraoferta"
3. **Teléfono 1 (Pasajero)**: Recibe notificación (pendiente FCM) o ve en app → botón "Aceptar precio del conductor" → estado `accepted`
4. **Teléfono 2 (Conductor)**: Ve viaje aceptado → "Iniciar viaje" → "Completar viaje"

### Verificación en Firestore
- Colección `trips` → documento del viaje:
  - `fare_calculated`: tarifa base del motor
  - `fare_offered`: oferta inicial del pasajero
  - `fare_counter_offer`: contraoferta del conductor
  - `fare_amount`: precio final acordado
  - `status`: `pending` → `negotiating` → `accepted` → `inProgress` → `completed`

---

## Próximos pasos (Roadmap)

| Paso | Descripción | Archivos |
|------|-------------|----------|
| **1. Cloud Function FCM** | `onCreate trip` → busca conductores activos en zona → push a topic `zone:{zoneId}:drivers` | `functions/src/trip-triggers.ts` (nuevo) |
| **2. MessagingService Flutter** | `requestPermission()`, `getToken()` → guarda en `users/{uid}.fcm_token`, suscribe a topic | `lib/services/messaging_service.dart` (completar) |
| **3. Panel Web Viajes** | `ViajesView.vue` con `onSnapshot` real-time + filtros | `apps/admin-web/src/views/ViajesView.vue` |
| **4. API trips pública** | Endpoints no-admin para que app móvil cree/acepte sin Admin SDK | `apps/admin-api/src/routes/trips.js` (adaptar) |