#!/usr/bin/env bash
# =============================================================================
# hardening-firebase.sh — Blindaje de coste del proyecto Firebase carsigo-9e508
# =============================================================================
#
# QUÉ HACE
#   1. Restringe las API Keys del proyecto según su uso real.
#   2. Crea/actualiza el presupuesto de alerta (20 USD equivalentes) con
#      umbrales 50% / 90% / 100%.
#   3. Deshabilita las APIs sin uso (BigQuery, Cloud SQL, Pub/Sub...).
#   4. Baja las cuotas duras de Cloud Run y Cloud Build.
#   5. Imprime los pasos que NO se pueden automatizar (spend cap real,
#      App Check en modo Enforce) con las URLs exactas de la consola.
#
# SEGURIDAD
#   - Cada comando se IMPRIME antes de ejecutarse.
#   - Pide confirmación (read -p) antes de cada operación.
#   - Dry-run por defecto: NADA se modifica salvo que pases --apply.
#
# USO
#   bash scripts/hardening-firebase.sh            # simulación (no cambia nada)
#   bash scripts/hardening-firebase.sh --apply    # aplica los cambios
#   bash scripts/hardening-firebase.sh --apply --yes   # sin confirmaciones
#
# REQUISITOS
#   - gcloud CLI autenticado con una cuenta OWNER / BILLING ADMIN del proyecto.
#     Si `gcloud auth list` muestra firebase-adminsdk-fbsvc@..., este script
#     NO tiene permisos de billing ni de API Keys. Usa:
#         gcloud auth login
#         gcloud config set account TU_USUARIO@gmail.com
#
# CONTEXTO VERIFICADO (auditoría 2026-11-05/06)
#   - Proyecto: carsigo-9e508 / número 621288515186
#   - Billing: 01C068-04B52A-074CB9  →  MONEDA: COP (no USD)
#   - Presupuesto actual: "CarSiGo" = 50000 COP (≈ 15,41 USD)
#   - 8 API Keys. `client_restrictions` es un ONEOF: por clave sólo puede
#     existir browser | android | ios | server. Por eso "Web Services" tiene
#     DOS claves (una Android y otra iOS).
#   - firebaseappcheck.googleapis.com DEBE estar en la allowlist de las claves
#     del SDK de Firebase; si falta, el intercambio de token de App Check
#     devuelve 403 y App Check no funciona.
# =============================================================================

set -uo pipefail

PROJECT="${PROJECT:-carsigo-9e508}"
PROJECT_NUMBER="${PROJECT_NUMBER:-621288515186}"
BILLING_ACCOUNT="${BILLING_ACCOUNT:-01C068-04B52A-074CB9}"

# La cuenta de facturación está en COP y gcloud exige la moneda de la cuenta.
# 20 USD ≈ 20 x 3245 = 64.900 COP.
BUDGET_AMOUNT="${BUDGET_AMOUNT:-64900COP}"
BUDGET_NAME="${BUDGET_NAME:-CarSiGo}"

ANDROID_PACKAGE="com.carsigo.app"
ANDROID_SHA1="2bd8d3c51561addaa36f3a0f1d2da6a325f20463"
IOS_BUNDLE="com.example.carsigoMobile"

# ── UIDs de las claves (el keyString sólo se devuelve al crearlas) ──────────
KEY_LOCALHOST="b1a036e6-df6e-473d-91dd-1a9ddaec56f1"   # Localhost Dev
KEY_WEB_PROD="28fe03c4-b25a-472c-b21c-a1a39de704bb"    # Web Panel (produccion)
KEY_WS_ANDROID="b95164c1-a07f-49ff-8cfc-b3da2e36b66a" # Web Services (Android)
KEY_WS_IOS="57452010-f4cc-4374-94a4-58cd8365175f"     # Web Services (iOS)
KEY_MAPS_ANDROID="10ea8e09-5057-4331-8bfc-f08a375948c7"
KEY_IOS="1721d8f5-1838-4fe7-a7a6-06c999bc7133"
KEY_ANDROID="1f41f77a-d11f-41c8-93a3-738bf10a03ea"
KEY_BROWSER="68363fd6-0dfc-4e45-b7a2-abf0a87f8232"

# ── Flags de ejecución ───────────────────────────────────────────────────────
APPLY=0
ASSUME_YES=0
for arg in "$@"; do
  case "$arg" in
    --apply) APPLY=1 ;;
    --yes|-y) ASSUME_YES=1 ;;
    --help|-h) sed -n '2,42p' "$0"; exit 0 ;;
    *) echo "Opción desconocida: $arg" >&2; exit 1 ;;
  esac
done

C_RESET=$'\033[0m'; C_BOLD=$'\033[1m'; C_RED=$'\033[31m'
C_GREEN=$'\033[32m'; C_YELLOW=$'\033[33m'; C_BLUE=$'\033[34m'; C_CYAN=$'\033[36m'

banner() { printf '\n%s══ %s %s\n' "$C_BOLD$C_BLUE" "$1" "$C_RESET"; }
info()   { printf '%s   %s%s\n' "$C_CYAN" "$1" "$C_RESET"; }
warn()   { printf '%s   ! %s%s\n' "$C_YELLOW" "$1" "$C_RESET"; }
err()    { printf '%s   x %s%s\n' "$C_RED" "$1" "$C_RESET"; }
ok()     { printf '%s   + %s%s\n' "$C_GREEN" "$1" "$C_RESET"; }
note()   { printf '\n%s%s%s\n' "$C_BOLD" "$1" "$C_RESET"; }

# ── Ejecutor único: imprime, confirma y SÓLO THENO ejecuta ────────────────
# Uso: exec_cmd "<descripción>" <comando...>
exec_cmd() {
  local desc="$1"; shift
  note "$desc"
  printf '%s   $ %s%s\n' "$C_CYAN" "$*" "$C_RESET"

  if [[ "$APPLY" -eq 0 ]]; then
    printf '%s   [dry-run] no se ejecuta%s\n' "$C_YELLOW" "$C_RESET"
    return 0
  fi

  if [[ "$ASSUME_YES" -eq 0 ]]; then
    local answer
    read -r -p "$(printf '%s   ¿Ejecutar? [s/N] %s' "$C_BOLD" "$C_RESET")" answer
    case "$answer" in
      s|S|y|Y) ;;
      *) info "Omitido por el usuario."; return 1 ;;
    esac
  fi

  "$@"
  local code=$?
  if [[ $code -eq 0 ]]; then ok "OK"; else err "Falló (exit $code)"; fi
  return $code
}

# ── Preflight ────────────────────────────────────────────────────────────────
banner "PREFLIGHT"

if ! command -v gcloud >/dev/null 2>&1; then
  for candidate in \
    "/c/Users/todoo/gcloud/google-cloud-sdk/bin" \
    "$HOME/gcloud/google-cloud-sdk/bin" \
    "/usr/local/google-cloud-sdk/bin"; do
    if [[ -x "$candidate/gcloud" ]]; then
      export PATH="$candidate:$PATH"
      break
    fi
  done
fi

if ! command -v gcloud >/dev/null 2>&1; then
  err "gcloud no está en el PATH."
  err "  export PATH=\"\$HOME/gcloud/google-cloud-sdk/bin:\$PATH\""
  exit 1
fi
info "gcloud: $(command -v gcloud)"

ACTIVE_ACCOUNT="$(gcloud config get-value account 2>/dev/null || echo '')"
info "Cuenta activa: ${ACTIVE_ACCOUNT:-<ninguna>}"

GCLOUD_EXTRA=()
TOKEN_FILE="${GCLOUD_ACCESS_TOKEN_FILE:-}"
if [[ -n "$TOKEN_FILE" && -f "$TOKEN_FILE" ]]; then
  GCLOUD_EXTRA+=(--access-token-file="$TOKEN_FILE")
  info "Usando token OAuth desde $TOKEN_FILE"
elif [[ "$ACTIVE_ACCOUNT" == *"firebase-adminsdk"* ]]; then
  err "La cuenta activa es una SERVICE ACCOUNT (sin permisos de billing ni API Keys)."
  err "  gcloud auth login && gcloud config set account TU_USUARIO@gmail.com"
  err "  o: export GCLOUD_ACCESS_TOKEN_FILE=/ruta/al/token.txt"
  exit 1
fi

if [[ "$APPLY" -eq 0 ]]; then
  warn "MODO SIMULACIÓN (dry-run): no se modifica nada. Usa --apply para aplicar."
else
  warn "MODO APLICAR: se harán cambios REALES en el proyecto."
fi

# Cloud Quotas exige el proyecto como consumer de cuota.
g() { gcloud "${GCLOUD_EXTRA[@]}" --project="$PROJECT" --billing-project="$PROJECT" "$@"; }
gb() { gcloud "${GCLOUD_EXTRA[@]}" billing "$@"; }

# =============================================================================
banner "PASO 1 — Restricción de API Keys"
# =============================================================================
info "Regla: cada clave queda anclada a su plataforma (referrer / app / bundle)"
info "Y con api-targets acotados, para que una clave robada no pueda llamar"
info "a APIs de pago (Maps, Directions, Places, IA)."

# 1.1 Localhost Dev — Maps JS en desarrollo
exec_cmd "1.1 Localhost Dev: referrers localhost + Maps/Places" \
  g services api-keys update "$KEY_LOCALHOST" \
    --allowed-referrers="http://localhost:5173/*,http://127.0.0.1:5173/*,http://localhost:4173/*" \
    --api-target=service=maps-backend.googleapis.com \
    --api-target=service=places.googleapis.com

# 1.2 Web Panel producción — Maps JS en el panel
exec_cmd "1.2 Web Panel prod: referrers Firebase + Maps/Places" \
  g services api-keys update "$KEY_WEB_PROD" \
    --allowed-referrers="https://carsigo-9e508.web.app/*,https://carsigo-9e508.firebaseapp.com/*" \
    --api-target=service=maps-backend.googleapis.com \
    --api-target=service=places.googleapis.com

# 1.3 Web Services (Android)
exec_cmd "1.3 Web Services Android: app + SHA-1 + Directions/Geocoding/Places" \
  g services api-keys update "$KEY_WS_ANDROID" \
    --allowed-application="package_name=$ANDROID_PACKAGE,sha1_fingerprint=$ANDROID_SHA1" \
    --api-target=service=directions-backend.googleapis.com \
    --api-target=service=geocoding-backend.googleapis.com \
    --api-target=service=places.googleapis.com \
    --api-target=service=maps-backend.googleapis.com

# 1.4 Web Services (iOS) — clave separada: client_restrictions es un oneof
exec_cmd "1.4 Web Services iOS: bundle id + Directions/Geocoding/Places" \
  g services api-keys update "$KEY_WS_IOS" \
    --allowed-bundle-ids="$IOS_BUNDLE" \
    --api-target=service=directions-backend.googleapis.com \
    --api-target=service=geocoding-backend.googleapis.com \
    --api-target=service=places.googleapis.com \
    --api-target=service=maps-backend.googleapis.com

# 1.5 Maps Android — SDK de Maps
exec_cmd "1.5 Maps Android: app + SHA-1 + APIs de Maps" \
  g services api-keys update "$KEY_MAPS_ANDROID" \
    --allowed-application="package_name=$ANDROID_PACKAGE,sha1_fingerprint=$ANDROID_SHA1" \
    --api-target=service=maps-android-backend.googleapis.com \
    --api-target=service=maps-backend.googleapis.com \
    --api-target=service=places.googleapis.com \
    --api-target=service=geocoding-backend.googleapis.com \
    --api-target=service=directions-backend.googleapis.com

# 1.6-1.8 Claves del SDK de Firebase (auto-created).
# La allowlist debe incluir TODAS las APIs de Firebase que el SDK pueda usar
# (ver doc "required APIs for restricted Firebase API key"). firebaseappcheck
# es OBLIGATORIA: sin ella App Check devuelve 403.
FIREBASE_TARGETS=(
  service=firebase.googleapis.com
  service=logging.googleapis.com
  service=firebaseinstallations.googleapis.com
  service=firebaseappcheck.googleapis.com
  service=identitytoolkit.googleapis.com
  service=securetoken.googleapis.com
  service=firebaserules.googleapis.com
  service=datastore.googleapis.com
  service=firestore.googleapis.com
  service=fcm.googleapis.com
  service=fcmregistrations.googleapis.com
  service=firebasestorage.googleapis.com
  service=firebasehosting.googleapis.com
  service=firebaseml.googleapis.com
  service=mobilecrashreporting.googleapis.com
  service=play.googleapis.com
  service=firebaseremoteconfig.googleapis.com
  service=firebaseremoteconfigrealtime.googleapis.com
  service=cloudconfig.googleapis.com
  service=firebasedatabase.googleapis.com
)

exec_cmd "1.6 iOS key (auto): bundle id + allowlist Firebase completa" \
  g services api-keys update "$KEY_IOS" \
    --allowed-bundle-ids="$IOS_BUNDLE" \
    "${FIREBASE_TARGETS[@]/#/--api-target=}"

exec_cmd "1.7 Android key (auto): app + SHA-1 + allowlist Firebase completa" \
  g services api-keys update "$KEY_ANDROID" \
    --allowed-application="package_name=$ANDROID_PACKAGE,sha1_fingerprint=$ANDROID_SHA1" \
    "${FIREBASE_TARGETS[@]/#/--api-target=}"

exec_cmd "1.8 Browser key (auto): referrers + allowlist Firebase completa" \
  g services api-keys update "$KEY_BROWSER" \
    --allowed-referrers="https://carsigo-9e508.web.app/*,https://carsigo-9e508.firebaseapp.com/*,http://localhost:5173/*,http://127.0.0.1:5173/*,http://localhost:4173/*,http://127.0.0.1:4173/*" \
    "${FIREBASE_TARGETS[@]/#/--api-target=}"

# =============================================================================
banner "PASO 2 — Presupuesto de alertas"
# =============================================================================
info "Cuenta de facturación en COP: el importe debe ir en COP."
info "Objetivo: ${BUDGET_AMOUNT} (≈ 20 USD). Umbrales 50/90/100%."

EXISTING_BUDGET_ID="$(gb budgets list \
  --billing-account="$BILLING_ACCOUNT" \
  --billing-project="$PROJECT" \
  --filter="displayName=$BUDGET_NAME" \
  --format="value(name)" 2>/dev/null | head -n1)"

if [[ -n "$EXISTING_BUDGET_ID" ]]; then
  info "Presupuesto existente: $EXISTING_BUDGET_ID"
  CURRENT_UNITS="$(gb budgets describe "$EXISTING_BUDGET_ID" \
    --billing-account="$BILLING_ACCOUNT" --billing-project="$PROJECT" \
    --format="value(amount.specifiedAmount.units)" 2>/dev/null)"
  CURRENT_CUR="$(gb budgets describe "$EXISTING_BUDGET_ID" \
    --billing-account="$BILLING_ACCOUNT" --billing-project="$PROJECT" \
    --format="value(amount.specifiedAmount.currencyCode)" 2>/dev/null)"
  TARGET_UNITS="${BUDGET_AMOUNT%COP}"
  info "Actual: ${CURRENT_UNITS:-?} ${CURRENT_CUR:-?} | Objetivo: ${TARGET_UNITS} COP"

  if [[ "$CURRENT_CUR" == "COP" && -n "$CURRENT_UNITS" && "$CURRENT_UNITS" -ge "$TARGET_UNITS" ]]; then
    ok "El importe ya es suficiente (≥ objetivo). No se toca el importe."
  else
    exec_cmd "Actualizar importe y umbrales del presupuesto" \
      gb budgets update "$EXISTING_BUDGET_ID" \
        --billing-account="$BILLING_ACCOUNT" \
        --billing-project="$PROJECT" \
        --budget-amount="$BUDGET_AMOUNT" \
        --clear-threshold-rules \
        --add-threshold-rule=percent=0.5 \
        --add-threshold-rule=percent=0.9 \
        --add-threshold-rule=percent=1.0 \
        --add-threshold-rule=percent=0.9,basis=forecasted-spend
  fi
else
  exec_cmd "Crear presupuesto ${BUDGET_NAME}" \
    gb budgets create \
      --billing-account="$BILLING_ACCOUNT" \
      --billing-project="$PROJECT" \
      --display-name="$BUDGET_NAME" \
      --budget-amount="$BUDGET_AMOUNT" \
      --calendar-period=MONTH \
      --threshold-rule=percent=0.5 \
      --threshold-rule=percent=0.9 \
      --threshold-rule=percent=1.0 \
      --threshold-rule=percent=0.9,basis=forecasted-spend
fi

# =============================================================================
banner "PASO 3 — APIs sin uso"
# =============================================================================
info "La auditoría no encontró recursos vivos en BigQuery, Cloud SQL, Pub/Sub,"
info "Artifact Registry, Eventarc, App Engine ni Datastore."
info "Las APIs de IA (Gemini / Vertex / Veo) YA están deshabilitadas."

UNUSED_APIS=(
  "bigquery.googleapis.com"
  "bigqueryconnection.googleapis.com"
  "bigquerydatapolicy.googleapis.com"
  "bigquerydatatransfer.googleapis.com"
  "bigquerymigration.googleapis.com"
  "bigqueryreservation.googleapis.com"
  "bigquerystorage.googleapis.com"
  "dataform.googleapis.com"
  "dataplex.googleapis.com"
  "datastore.googleapis.com"
  "sql-component.googleapis.com"
  "pubsub.googleapis.com"
  "artifactregistry.googleapis.com"
  "eventarc.googleapis.com"
  "appengine.googleapis.com"
  "analyticshub.googleapis.com"
)

if [[ "$APPLY" -eq 0 ]]; then
  for api in "${UNUSED_APIS[@]}"; do
    printf '%s   [dry-run]%s gcloud services disable %s --project=%s\n' "$C_YELLOW" "$C_RESET" "$api" "$PROJECT"
  done
else
  printf '\n%s   Se deshabilitarán %d APIs.%s ¿Continuar? [s/N] ' "$C_BOLD" "${#UNUSED_APIS[@]}" "$C_RESET"
  read -r answer
  if [[ "$answer" =~ ^[sSyY]$ ]]; then
    for api in "${UNUSED_APIS[@]}"; do
      printf '%s   $ gcloud services disable %s%s\n' "$C_CYAN" "$api" "$C_RESET"
      if gcloud "${GCLOUD_EXTRA[@]}" services disable "$api" --project="$PROJECT" >/dev/null 2>&1; then
        ok "$api deshabilitada"
      else
        warn "$api: no se pudo deshabilitar"
      fi
    done
  else
    info "Omitido."
  fi
fi

# =============================================================================
banner "PASO 4 — Cuotas duras (lo que SÍ corta el gasto)"
# =============================================================================
info "Firestore ya está en los topes del free tier (fijos, no ajustables):"
info "  50.000 lecturas/día · 20.000 escrituras/día · 50.000 read units/día"
info "Cloud Run: 100 instancias/región y 1.000 ejecuciones simultáneas."
info "Cloud Build: 50 builds/min y 300 requests/min."
info "Aquí se bajan a valores de dev."

set_quota() {
  local service="$1" quota_id="$2" value="$3" dims="${4:-}"
  local cmd=(gcloud "${GCLOUD_EXTRA[@]}" quotas preferences create
    --service="$service" --project="$PROJECT"
    --quota-id="$quota_id" --preferred-value="$value"
    --preference-id="carsigo_${quota_id}"
    --email="todoobraparabien1998@gmail.com"
    --justification="CarSiGo local/dev: tope duro para garantizar coste 0")
  [[ -n "$dims" ]] && cmd+=(--dimensions="$dims")
  exec_cmd "Cuota ${service}/${quota_id} = ${value}${dims:+ ($dims)}" "${cmd[@]}"
}

set_quota "run.googleapis.com" "instances" "3" "region=us-central1"
set_quota "run.googleapis.com" "running_executions" "10" "region=us-central1"
set_quota "run.googleapis.com" "instances" "3" "region=southamerica-east1"
set_quota "run.googleapis.com" "running_executions" "10" "region=southamerica-east1"
set_quota "cloudbuild.googleapis.com" "create_requests" "2"
set_quota "cloudbuild.googleapis.com" "all_else_requests" "60"

# =============================================================================
banner "PASO 5 — PASOS MANUALES (consola web)"
# =============================================================================
cat <<'EOF'
  Estos NO se pueden automatizar con gcloud. Hazlos tú en la consola.

  ┌─ A) SPEND CAP REAL (tope duro, sólo consola) ──────────────────────────┐
  │  URL:                                                               │
  │  https://console.cloud.google.com/billing/budgets?project=carsigo-9e508
  │                                                                     │
  │  "Create budget" → tipo "Spend cap enforcement" (NO "Alerts only").   │
  │  Scope: un solo proyecto + un solo servicio. Elegibles:              │
  │     Cloud Run            (run.googleapis.com)                         │
  │     Cloud Run functions  (cloudfunctions.googleapis.com)              │
  │     Gemini API / Vertex AI  (ya deshabilitados → no aplica)          │
  │  Target: 20 USD (o 64900 COP). Al superarse, Google PAUSA el         │
  │  servicio hasta el mes siguiente. Eso SÍ corta la factura.            │
  │                                                                     │
  │  Importante: un presupuesto "Alerts only" NO frena nada. El spend cap │
  │  es un objeto distinto; no se puede convertir un alerts-only.         │
  └─────────────────────────────────────────────────────────────────────┘

  ┌─ B) APP CHECK: registrar las apps (API ya habilitada) ───────────────┐
  │  URL:                                                               │
  │  https://console.firebase.google.com/project/carsigo-9e508/appcheck  │
  │                                                                     │
  │  1. Pestaña "Web" → registra carsigo-9e508 → reCAPTCHA v3.          │
  │     Copia la SITE KEY y ponla en VITE_RECAPTCHA_SITE_KEY             │
  │     (ver .env.production / .env.local.example).                      │
  │  2. Pestaña "Android" → Play Integrity → SHA-1:                      │
  │       2bd8d3c51561addaa36f3a0f1d2da6a325f20463                       │
  │  3. Pestaña "iOS" → DeviceCheck → bundle id:                        │
  │       com.example.carsigoMobile                                      │
  │  4. IMPORTANTE: deja TODO en modo "Monitor" (NO "Enforce") hasta     │
  │     verificar que las apps funcionan. Luego cambia a "Enforce".       │
  │                                                                     │
  │  Sin App Check, cualquiera que copie tu API Key puede gastar tu     │
  │  cuota. Con App Check, Google sólo emite tokens a apps legítimas.    │
  └─────────────────────────────────────────────────────────────────────┘

  ┌─ C) CLAVES DE WEB SERVICES EN EL MÓVIL ──────────────────────────────┐
  │  Las API keys de Google sólo admiten UNA familia de restricción de   │
  │  cliente por clave (browser | android | ios | server). Por eso hay   │
  │  DOS claves de Web Services. Añade la de iOS a apps/mobile/.env:     │
  │      GOOGLE_WEB_SERVICES_KEY_IOS=AIzaSyC775YVZ77wH9IUTpHFzIIPxed0jKdheuc
  │  (la de Android ya está en GOOGLE_WEB_SERVICES_KEY).                 │
  └─────────────────────────────────────────────────────────────────────┘

  ┌─ D) STORAGE BUCKET (opcional) ───────────────────────────────────────┐
  │  https://console.firebase.google.com/project/carsigo-9e508/storage    │
  │  Storage está DESHABILITADO hoy (0 coste). Crearlo cobra por GB.     │
  │  Si no lo necesitas, NO lo crees.                                    │
  └─────────────────────────────────────────────────────────────────────┘

  ┌─ E) LEVANTAR UN SPEND CAP SI SE ACTIVÓ ──────────────────────────────┐
  │  https://console.cloud.google.com/billing/budgets?project=carsigo-9e508
  │  (Editar presupuesto → "Lift spend cap")                             │
  └─────────────────────────────────────────────────────────────────────┘
EOF

# =============================================================================
banner "FIN DEL SCRIPT"
# =============================================================================
if [[ "$APPLY" -eq 1 ]]; then
  info "Modo: APLICAR. Se hicieron cambios reales."
else
  info "Modo: SIMULACIÓN. No se modificó nada."
fi
info "Verifica el estado final con: bash scripts/check-costs.sh"
