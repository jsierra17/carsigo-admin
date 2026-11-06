#!/usr/bin/env bash
# =============================================================================
# check-costs.sh — Verificación (SOLO LECTURA) del blindaje de coste
# =============================================================================
#
# NO MODIFICA NADA. Solo consulta y resume.
#
# Comprueba:
#   1. Que cada API Key tenga restricción de cliente Y api-targets acotados.
#   2. Que exista un presupuesto con importe útil (> 1000 COP) y umbrales.
#   3. Que las APIs sin uso estén deshabilitadas.
#   4. Que no queden recursos de pago vivos (Functions, Cloud Run, BigQuery...).
#   5. Que las cuotas duras estén lowered.
#
# SALIDA
#   "TODO OK" si no hay pendientes, o la lista de pendientes.
#   Exit 0 = todo OK. Exit 1 = hay pendientes.
#
# USO
#   bash scripts/check-costs.sh
#
# AUTENTICACIÓN
#   gcloud debe usar una cuenta humana (Owner / Billing Admin). Si la cuenta
#   activa es firebase-adminsdk-*, las lecturas de budgets y API Keys fallan
#   con PERMISSION_DENIED. Alternativa: exportar un token OAuth válido en
#       GCLOUD_ACCESS_TOKEN_FILE=/ruta/al/token.txt
# =============================================================================

set -uo pipefail

PROJECT="${PROJECT:-carsigo-9e508}"
BILLING_ACCOUNT="${BILLING_ACCOUNT:-01C068-04B52A-074CB9}"
BUDGET_NAME="${BUDGET_NAME:-CarSiGo}"

C_RESET=$'\033[0m'; C_BOLD=$'\033[1m'; C_RED=$'\033[31m'
C_GREEN=$'\033[32m'; C_YELLOW=$'\033[33m'; C_CYAN=$'\033[36m'

PENDING=0
banner() { printf '\n%s══ %s %s\n' "$C_BOLD$C_CYAN" "$1" "$C_RESET"; }
ok()    { printf '   %s[PASS]%s %s\n' "$C_GREEN" "$C_RESET" "$1"; }
fail()  { printf '   %s[PEND]%s %s\n' "$C_RED" "$C_RESET" "$1"; PENDING=$((PENDING+1)); }
warn()  { printf '   %s[AVISO]%s %s\n' "$C_YELLOW" "$C_RESET" "$1"; }
info()  { printf '   %s%s\n' "$C_CYAN" "$1" "$C_RESET"; }

# ── Localizar gcloud (en Windows suele no estar en el PATH de Git Bash) ──────
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
  echo "gcloud no esta en el PATH. No se puede verificar." >&2
  exit 1
fi

# ── Autenticación ───────────────────────────────────────────────────────────
ACTIVE_ACCOUNT="$(gcloud config get-value account 2>/dev/null || echo '')"
GCLOUD_EXTRA=()
TOKEN_FILE="${GCLOUD_ACCESS_TOKEN_FILE:-}"
if [[ -n "$TOKEN_FILE" && -f "$TOKEN_FILE" ]]; then
  GCLOUD_EXTRA+=(--access-token-file="$TOKEN_FILE")
  info "Usando token OAuth desde $TOKEN_FILE"
elif [[ "$ACTIVE_ACCOUNT" == *"firebase-adminsdk"* ]]; then
  warn "La cuenta activa es una SERVICE ACCOUNT (firebase-adminsdk)."
  warn "No tiene permisos de billing ni de API Keys: las comprobaciones de"
  warn "claves y presupuesto fallaran. Usa 'gcloud auth login' o define"
  warn "GCLOUD_ACCESS_TOKEN_FILE con un token OAuth valido."
fi

# Wrapper: siempre con el proyecto correcto como quota project.
g() { gcloud "${GCLOUD_EXTRA[@]}" --project="$PROJECT" --billing-project="$PROJECT" "$@"; }

# Cuenta líneas no vacías de una salida (evita el clásico "0\n0" de grep -c).
count_lines() {
  local out
  out="$(cat 2>/dev/null | grep -c '[^[:space:]]' 2>/dev/null)"
  [[ -z "$out" ]] && out=0
  printf '%s' "$out"
}

# ¿La clave tiene al menos un tipo de restricción de cliente?
has_client_restriction() {
  local restrictions="$1"
  [[ "$restrictions" == *"browserKeyRestrictions"*   ||
     "$restrictions" == *"androidKeyRestrictions"*   ||
     "$restrictions" == *"iosKeyRestrictions"*       ||
     "$restrictions" == *"serverKeyRestrictions"* ]]
}

# ¿La clave tiene api-targets (y por tanto no puede llamar a cualquier API)?
has_api_targets() {
  [[ "$1" == *"apiTargets"* ]]
}

# =============================================================================
banner "1. RESTRICCIONES DE API KEYS"
# =============================================================================

KEYS_JSON="$(g services api-keys list --format=json 2>/dev/null)"

if [[ -z "$KEYS_JSON" || "$KEYS_JSON" == *"PERMISSION_DENIED"* || "$KEYS_JSON" == *"not enabled"* ]]; then
  fail "No se pudieron leer las API Keys. Revisa la cuenta gcloud activa (gcloud auth list)."
else
  while IFS='|' read -r display_name restrictions; do
    [[ -z "$display_name" ]] && continue
    if ! has_client_restriction "$restrictions"; then
      fail "$display_name → SIN restricción de cliente (referrer/app/bundle/IP)"
    elif ! has_api_targets "$restrictions"; then
      fail "$display_name → sin api-targets: puede llamar a CUALQUIER API habilitada"
    else
      ok "$display_name → restringida"
    fi
  done < <(printf '%s' "$KEYS_JSON" | node -e '
    let raw = "";
    process.stdin.on("data", d => raw += d);
    process.stdin.on("end", () => {
      let list = [];
      try { list = JSON.parse(raw); } catch { process.exit(0); }
      for (const k of list) {
        const r = k.restrictions || {};
        const parts = [];
        if (r.browserKeyRestrictions) parts.push("browserKeyRestrictions");
        if (r.androidKeyRestrictions) parts.push("androidKeyRestrictions");
        if (r.iosKeyRestrictions) parts.push("iosKeyRestrictions");
        if (r.serverKeyRestrictions) parts.push("serverKeyRestrictions");
        if ((r.apiTargets || []).length) parts.push("apiTargets");
        console.log((k.displayName || k.name) + "|" + parts.join(","));
      }
    });
  ')
fi

# =============================================================================
banner "2. PRESUPUESTO DE ALERTAS"
# =============================================================================

BUDGET_JSON="$(gcloud "${GCLOUD_EXTRA[@]}" billing budgets list \
  --billing-account="$BILLING_ACCOUNT" \
  --billing-project="$PROJECT" \
  --format=json 2>/dev/null)"

if [[ -z "$BUDGET_JSON" || "$BUDGET_JSON" == *"PERMISSION_DENIED"* ]]; then
  fail "No se pudo leer el presupuesto de la cuenta $BILLING_ACCOUNT."
else
  while IFS='|' read -r status msg; do
    [[ -z "$status" ]] && continue
    if [[ "$status" == "PASS" ]]; then ok "$msg"; else fail "$msg"; fi
  done < <(printf '%s' "$BUDGET_JSON" | node -e '
    let raw = "";
    process.stdin.on("data", d => raw += d);
    process.stdin.on("end", () => {
      let budgets = [];
      try { budgets = JSON.parse(raw); } catch { budgets = []; }
      if (!budgets.length) { console.log("PENDIENTE|no hay presupuestos en la cuenta"); return; }
      for (const b of budgets) {
        const amt = b.amount?.specifiedAmount || {};
        const units = Number(amt.units || 0);
        const cur = amt.currencyCode || "?";
        const name = b.displayName || b.name;
        const thresholds = (b.thresholdRules || []).map(t => (t.thresholdPercent * 100) + "%/" + (t.spendBasis || "CURRENT_SPEND")).join(" ");
        const usd = cur === "COP" ? (units / 3245).toFixed(2) : units.toFixed(2);
        // 1000 COP ≈ 0,30 USD: por debajo, el presupuesto es inservible.
        const tooSmall = cur === "COP" ? units < 1000 : units < 1;
        console.log((tooSmall ? "PENDIENTE" : "PASS") + "|" + name + " = " + units + " " + cur + " (≈ $" + usd + ") | umbrales: " + (thresholds || "ninguno"));
        if (!thresholds) console.log("PENDIENTE|" + name + " → sin umbrales de alerta");
      }
    });
  ')
fi

# =============================================================================
banner "3. APIs HABILITADAS SIN USO"
# =============================================================================

ENABLED="$(g services list --enabled --format="value(config.name)" 2>/dev/null)"

if [[ -z "$ENABLED" ]]; then
  fail "No se pudo listar las APIs habilitadas (permisos o API serviceusage)."
else
  EXPECT_UNUSED=(
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
  still_on=0
  for api in "${EXPECT_UNUSED[@]}"; do
    if printf '%s\n' "$ENABLED" | grep -qx "$api"; then
      fail "$api sigue habilitada (sin recursos vivos, pero es superficie de gasto)"
      still_on=$((still_on+1))
    fi
  done
  [[ "$still_on" -eq 0 ]] && ok "Todas las APIs sin uso están deshabilitadas."

  if printf '%s\n' "$ENABLED" | grep -qxE "generativelanguage|aiplatform|vertexai"; then
    fail "Hay una API de IA habilitada (Gemini / Vertex) → riesgo directo de gasto"
  else
    ok "APIs de IA (Gemini / Vertex) deshabilitadas."
  fi
fi

# =============================================================================
banner "4. RECURSOS DE PAGO VIVOS"
# =============================================================================

fn_count="$(g functions list --format="value(name)" 2>/dev/null | count_lines)"
if [[ "${fn_count:-0}" -eq 0 ]]; then
  ok "0 Cloud Functions"
else
  fail "$fn_count Cloud Function(s) desplegadas"
fi

run_uc="$(g run services list --region=us-central1 --format="value(metadata.name)" 2>/dev/null | count_lines)"
run_sa="$(g run services list --region=southamerica-east1 --format="value(metadata.name)" 2>/dev/null | count_lines)"
if [[ "${run_uc:-0}" -eq 0 && "${run_sa:-0}" -eq 0 ]]; then
  ok "0 servicios Cloud Run"
else
  fail "Cloud Run: $run_uc (us-central1) + $run_sa (southamerica-east1)"
fi

bq_count="$(g bq datasets list --format="value(datasetId)" 2>/dev/null | count_lines)"
if [[ "${bq_count:-0}" -eq 0 ]]; then
  ok "0 datasets BigQuery"
else
  fail "$bq_count dataset(s) de BigQuery"
fi

sql_count="$(g sql instances list --format="value(name)" 2>/dev/null | count_lines)"
if [[ "${sql_count:-0}" -eq 0 ]]; then
  ok "0 instancias Cloud SQL"
else
  fail "$sql_count instancia(s) de Cloud SQL"
fi

buckets="$(g storage buckets list --format="value(name)" 2>/dev/null | grep -v "gcf-v2-" | count_lines)"
if [[ "${buckets:-0}" -eq 0 ]]; then
  ok "0 buckets de Storage de usuario (solo restos gcf-v2-*)"
else
  fail "$buckets bucket(s) de Storage de usuario"
fi

# =============================================================================
banner "5. CUOTAS DURAS"
# =============================================================================

for svc in run.googleapis.com cloudbuild.googleapis.com; do
  out="$(g quotas info list --service="$svc" --format=json 2>/dev/null)"
  if [[ -z "$out" ]]; then
    warn "No se pudieron leer las cuotas de $svc"
  else
    while read -r line; do
      [[ -z "$line" ]] && continue
      metric="${line%% =*}"; value="${line##*= }"
      [[ "$value" =~ ^[0-9]+$ ]] || continue
      case "$metric" in
        *instances|*running_executions)
          if [[ "$value" -le 10 ]]; then ok "$metric = $value (limitado)"
          else fail "$metric = $value (sin tope de dev; Cloud Run factura por instancia)"; fi ;;
        *requests)
          if [[ "$value" -le 10 ]]; then ok "$metric = $value (limitado)"
          else warn "$metric = $value (Cloud Build factura por build)"; fi ;;
      esac
    done < <(printf '%s' "$out" | node -e '
      let raw = "";
      process.stdin.on("data", d => raw += d);
      process.stdin.on("end", () => {
        let list = [];
        try { list = JSON.parse(raw); } catch { process.exit(0); }
        // Una misma métrica aparece varias veces (una por dimensión/región).
        // Nos queda con el valor MÁXIMO: es el que hay que bajar.
        const max = {};
        for (const q of list) {
          for (const di of (q.dimensionsInfos || [])) {
            const v = di?.details?.value;
            if (v === undefined) continue;
            const n = Number(v);
            if (!Number.isFinite(n)) continue;
            if (max[q.metric] === undefined || n > max[q.metric]) max[q.metric] = n;
          }
        }
        for (const [metric, value] of Object.entries(max)) {
          if (/instances|running_executions|create_requests|all_else_requests/.test(metric)) {
            console.log(metric + " = " + value);
          }
        }
      });
    ')
  fi
done

# =============================================================================
banner "RESUMEN"
# =============================================================================

if [[ "$PENDING" -eq 0 ]]; then
  printf '%s   TODO OK%s — Blindaje de coste verificado.\n' "$C_BOLD$C_GREEN" "$C_RESET"
  printf '%s   Pendientes manuales: spend cap real (consola) + App Check.%s\n' "$C_YELLOW" "$C_RESET"
  exit 0
else
  printf '%s   %d pendiente(s) por resolver.%s\n' "$C_BOLD$C_RED" "$PENDING" "$C_RESET"
  printf '%s   Ejecuta: bash scripts/hardening-firebase.sh --apply%s\n' "$C_YELLOW" "$C_RESET"
  exit 1
fi
