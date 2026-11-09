# FCM & Cloud Functions Implementation Plan

## Objetivo
Implementar notificaciones push seguras (FCM) y validación server-side de viajes usando Cloud Functions.

## Reglas de Seguridad (INQUEBRANTABLES)
1. **PROHIBIDO enviar notificaciones FCM desde el cliente (Flutter).** La app solo registra el token FCM y lo guarda en Firestore (`users/{uid}.fcmToken`). El envío es EXCLUSIVO desde Cloud Functions.
2. **Validación server-side obligatoria.** Cloud Function `onDocumentCreated` en `trips` valida geocerca antes de confirmar el viaje.
3. **Un solo listener.** Cloud Function `onDocumentUpdated` en `trips` detecta cambio a `accepted` y notifica al pasajero.

---

## Plan de Implementación (3 Pasos)

### Paso 1: Flutter - Messaging Service (Solo registro de token)
- **Archivo:** `apps/mobile/lib/services/messaging_service.dart`
- **Función:** `initialize()` → inicializa `firebase_messaging`, pide permisos, obtiene token, guarda en `users/{uid}.fcmToken`
- **Inicialización:** En `main.dart` tras `AppCheckService.initialize()`
- **NO enviar notificaciones desde aquí.**

### Paso 2: Cloud Functions - `functions/src/trips.ts`
- **Trigger 1:** `onDocumentCreated` en `trips`
  - Valida que `pickup_location` esté dentro de geocerca activa (`geofences`).
  - Si NO está dentro → actualiza viaje a `cancelled` con mensaje de error.
- **Trigger 2:** `onDocumentUpdated` en `trips`
  - Si `status` cambia a `accepted` → busca `fcmToken` del pasajero en `users/{passengerId}` → envía notificación push via `firebase-admin/messaging`.

### Paso 3: Reglas Firestore
- Permitir a usuarios leer/escribir su propio `fcmToken` en `users/{uid}`.

---

## Checklist de Ejecución

- [ ] **Paso 1.1** Crear `apps/mobile/lib/services/messaging_service.dart`
- [ ] **Paso 1.2** Registrar en `main.dart` tras `AppCheckService.initialize()`
- [ ] **Paso 1.3** Build y test en Android (PEDIR VALIDACIÓN USUARIO)
- [ ] **Paso 2.1** Crear `functions/src/trips.ts` con triggers
- [ ] **Paso 2.2** Compilar TypeScript (`npm run build --prefix functions`)
- [ ] **Paso 2.3** Deploy a Firebase (`npm run deploy:prod:functions`)
- [ ] **Paso 3.1** Actualizar `firebase/firestore.rules` para `fcmToken`
- [ ] **Paso 3.2** Deploy rules (`npm run deploy:rules`)

---

## Validación Requerida
Después del **Paso 1.3**: Pedir al usuario que pruebe en su Android que:
1. La app arranca sin errores
2. Pide permiso de notificaciones
3. Guarda el `fcmToken` en `users/{uid}` en Firestore

**NO continuar al Paso 2 sin confirmación del usuario.**