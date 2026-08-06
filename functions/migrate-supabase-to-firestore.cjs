#!/usr/bin/env node

const admin = require('firebase-admin');
const { createClient } = require('@supabase/supabase-js');

const DRY_RUN = !process.argv.includes('--write');

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';

const serviceAccountPath =
  process.env.FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_APPLICATION_CREDENTIALS || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (Settings > API > service_role).');
  process.exit(1);
}
if (!serviceAccountPath) {
  console.error(
    'Falta la ruta del service account JSON de Firebase\n' +
      '  (Project settings > Service accounts > Generate new private key).\n' +
      '  Ej: $env:FIREBASE_SERVICE_ACCOUNT="C:\\ruta\\carsigo-9e508-firebase-adminsdk.json"'
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

admin.initializeApp({
  credential: admin.credential.cert(serviceAccountPath),
});
const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

const PAGE_SIZE = 1000;

function toDate(v) {
  if (v == null) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'string') return new Date(v);
  return null;
}

function toTs(v) {
  const d = toDate(v);
  return d != null && !isNaN(d.getTime()) ? d : null;
}

function geojsonToPoint(geojson) {
  if (!geojson) return null;
  let obj = geojson;
  if (typeof geojson === 'string') {
    try {
      obj = JSON.parse(geojson);
    } catch {
      return null;
    }
  }
  if (obj && obj.type === 'Point' && Array.isArray(obj.coordinates)) {
    const [lng, lat] = obj.coordinates;
    return { lat, lng };
  }
  return null;
}

function geojsonToRing(geojson) {
  if (!geojson) return [];
  let obj = geojson;
  if (typeof geojson === 'string') {
    try {
      obj = JSON.parse(geojson);
    } catch {
      return [];
    }
  }
  if (!obj || !obj.coordinates) return [];
  const coords = obj.type === 'Polygon' ? obj.coordinates[0] : obj.coordinates;
  if (!Array.isArray(coords)) return [];
  return coords.map(([lng, lat]) => ({ lat, lng }));
}

async function fetchAll(table, select) {
  const rows = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .order('created_at', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`[${table}] ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return rows;
}

async function writeDocs(collection, rows, docIdFn) {
  const ref = db.collection(collection);
  let count = 0;
  let batch = db.batch();
  let ops = 0;
  for (const row of rows) {
    batch.set(ref.doc(docIdFn(row)), row);
    count++;
    ops++;
    if (ops === 400) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  }
  if (ops > 0) await batch.commit();
  return count;
}

const PLAIN = {
  id: (r) => r.id,
  user_id: (r) => r.user_id,
};

const transforms = {
  users: {
    select: '*',
    docId: (r) => r.id,
    map: (r) => ({
      id: r.id,
      name: r.name ?? '',
      email: r.email ?? null,
      phone: r.phone ?? '',
      role: r.role ?? 'passenger',
      status: r.status ?? 'active',
      full_name: r.full_name ?? r.name ?? null,
      avatar_url: r.avatar_url ?? null,
      created_at: toTs(r.created_at),
    }),
  },
  driver_profiles: {
    select: '*',
    docId: (r) => r.user_id,
    map: (r) => ({
      user_id: r.user_id,
      vehicle_type: r.vehicle_type ?? 'moto',
      plate: r.plate ?? '',
      status: r.status ?? 'pending',
      total_rides: r.total_rides ?? 0,
      suspension_end_date: toTs(r.suspension_end_date),
      created_at: toTs(r.created_at),
    }),
  },
  driver_applications: {
    select: '*',
    docId: (r) => r.id,
    map: (r) => ({
      id: r.id,
      user_id: r.user_id ?? null,
      status: r.status ?? 'pending',
      full_name: r.full_name ?? '',
      id_number: r.id_number ?? '',
      plate: r.plate ?? '',
      brand: r.brand ?? null,
      model: r.model ?? null,
      color: r.color ?? null,
      vehicle_type: r.vehicle_type ?? 'moto',
      cedula_url: r.cedula_url ?? null,
      selfie_url: r.selfie_url ?? null,
      tarjeta_propiedad_url: r.tarjeta_propiedad_url ?? null,
      licencia_url: r.licencia_url ?? null,
      soat_url: r.soat_url ?? null,
      created_at: toTs(r.created_at),
      reviewed_at: toTs(r.reviewed_at),
      reviewer_notes: r.reviewer_notes ?? null,
    }),
  },
  settlements: {
    select: '*',
    docId: (r) => r.id,
    map: (r) => ({
      id: r.id,
      driver_id: r.driver_id,
      reference: r.reference,
      period_start: r.period_start ?? null,
      period_end: r.period_end ?? null,
      trip_count: r.trip_count ?? 0,
      total_fare: Number(r.total_fare ?? 0),
      commission_amount: Number(r.commission_amount ?? 0),
      driver_payout: Number(r.driver_payout ?? 0),
      status: r.status ?? 'pending',
      notes: r.notes ?? null,
      created_at: toTs(r.created_at),
      updated_at: toTs(r.updated_at),
    }),
  },
  geofences: {
    select: 'id, municipality_name, is_active, base_multiplier, created_at, boundaries',
    docId: (r) => r.id,
    map: (r) => {
      const ring = geojsonToRing(r.boundaries);
      const center = ring.length > 0 ? ring[Math.floor(ring.length / 2)] : null;
      return {
        id: r.id,
        municipality_name: r.municipality_name,
        is_active: r.is_active ?? true,
        base_multiplier: Number(r.base_multiplier ?? 1),
        boundary: ring,
        center: center,
        created_at: toTs(r.created_at),
      };
    },
  },
  wallets: {
    select: '*',
    docId: (r) => r.user_id,
    map: (r) => ({
      user_id: r.user_id,
      balance: Number(r.balance ?? 0),
      created_at: toTs(r.created_at),
    }),
  },
  rate_cards: {
    select: '*',
    docId: (r) => r.id,
    map: (r) => ({
      id: r.id,
      name: r.name ?? '',
      vehicle_type: r.vehicle_type ?? 'car',
      base_fee: Number(r.base_fee ?? 2500),
      price_per_km: Number(r.price_per_km ?? 1000),
      price_per_minute: Number(r.price_per_minute ?? 150),
      minimum_fare: Number(r.minimum_fare ?? 5000),
      free_waiting_minutes: r.free_waiting_minutes ?? 5,
      waiting_price_per_minute: Number(r.waiting_price_per_minute ?? 200),
      commission_percent: Number(r.commission_percent ?? 10),
      included_km: r.included_km ?? 2,
      extra_km_percent: Number(r.extra_km_percent ?? 50),
      is_active: r.is_active ?? true,
      created_at: toTs(r.created_at),
    }),
  },
  rate_schedules: {
    select: '*',
    docId: (r) => r.id,
    map: (r) => ({
      id: r.id,
      name: r.name ?? '',
      vehicle_type: r.vehicle_type ?? 'car',
      day_type: r.day_type ?? 'weekday',
      shift_label: r.shift_label ?? 'morning',
      shift_start: r.shift_start ?? '',
      shift_end: r.shift_end ?? '',
      base_fee: Number(r.base_fee ?? 0),
      hourly_increase_percent: Number(r.hourly_increase_percent ?? 0),
      is_active: r.is_active ?? true,
      created_at: toTs(r.created_at),
    }),
  },
  dynamic_pricing_rules: {
    select: '*',
    docId: (r) => r.id,
    map: (r) => ({
      id: r.id,
      name: r.name ?? '',
      description: r.description ?? null,
      rule_type: r.rule_type ?? 'time_range',
      start_time: r.start_time ?? null,
      end_time: r.end_time ?? null,
      days_of_week: r.days_of_week ?? [],
      specific_date: r.specific_date ?? null,
      is_recurring: r.is_recurring ?? false,
      date_from: r.date_from ?? null,
      date_to: r.date_to ?? null,
      multiplier: Number(r.multiplier ?? 1),
      flat_surcharge: Number(r.flat_surcharge ?? 0),
      geofence_id: r.geofence_id ?? null,
      vehicle_type: r.vehicle_type ?? null,
      is_active: r.is_active ?? true,
      priority: r.priority ?? 100,
      created_at: toTs(r.created_at),
    }),
  },
  trips: {
    select:
      'id, passenger_id, driver_id, status, fare_amount, commission_amount, pickup_address, dropoff_address, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, driver_lat, driver_lng, distance_km, duration_min, created_at, accepted_at, started_at, completed_at',
    docId: (r) => r.id,
    map: (r) => ({
      id: r.id,
      passenger_id: r.passenger_id,
      driver_id: r.driver_id ?? null,
      status: r.status ?? 'pending',
      fare_amount: Number(r.fare_amount ?? 0),
      commission_amount: Number(r.commission_amount ?? 0),
      pickup_address: r.pickup_address ?? '',
      dropoff_address: r.dropoff_address ?? null,
      pickup_lat: r.pickup_lat != null ? Number(r.pickup_lat) : null,
      pickup_lng: r.pickup_lng != null ? Number(r.pickup_lng) : null,
      dropoff_lat: r.dropoff_lat != null ? Number(r.dropoff_lat) : null,
      dropoff_lng: r.dropoff_lng != null ? Number(r.dropoff_lng) : null,
      pickup_location:
        r.pickup_lat != null && r.pickup_lng != null
          ? new admin.firestore.GeoPoint(Number(r.pickup_lat), Number(r.pickup_lng))
          : null,
      dropoff_location:
        r.dropoff_lat != null && r.dropoff_lng != null
          ? new admin.firestore.GeoPoint(Number(r.dropoff_lat), Number(r.dropoff_lng))
          : null,
      driver_lat: r.driver_lat != null ? Number(r.driver_lat) : null,
      driver_lng: r.driver_lng != null ? Number(r.driver_lng) : null,
      distance_km: Number(r.distance_km ?? 0),
      duration_min: Number(r.duration_min ?? 0),
      created_at: toTs(r.created_at),
      accepted_at: toTs(r.accepted_at),
      started_at: toTs(r.started_at),
      completed_at: toTs(r.completed_at),
    }),
  },
  trip_fare_breakdown: {
    select: '*',
    docId: (r) => r.id,
    map: (r) => ({
      id: r.id,
      trip_id: r.trip_id,
      rate_card_id: r.rate_card_id ?? null,
      base_fee: Number(r.base_fee ?? 0),
      distance_charge: Number(r.distance_charge ?? 0),
      time_charge: Number(r.time_charge ?? 0),
      waiting_charge: Number(r.waiting_charge ?? 0),
      dynamic_multiplier: Number(r.dynamic_multiplier ?? 1),
      surcharges: r.surcharges ?? [],
      subtotal: Number(r.subtotal ?? 0),
      commission_percent: Number(r.commission_percent ?? 10),
      commission_amount: Number(r.commission_amount ?? 0),
      driver_earnings: Number(r.driver_earnings ?? 0),
      distance_km: Number(r.distance_km ?? 0),
      duration_min: Number(r.duration_min ?? 0),
      created_at: toTs(r.created_at),
    }),
  },
};

async function run() {
  console.log(DRY_RUN ? '>>> DRY RUN (no escribe nada). Usa --write para migrar.' : '>>> MIGRACION REAL');
  console.log(`Supabase: ${supabaseUrl}`);
  console.log('Firestore: ' + (db ? 'conectado' : '?') + '\n');

  const summary = [];
  for (const [collection, cfg] of Object.entries(transforms)) {
    const rows = await fetchAll(collection, cfg.select);
    const mapped = rows.map(cfg.map);
    summary.push({ collection, count: mapped.length });
    console.log(`  [${collection}] ${mapped.length} registros leidos.`);

    if (!DRY_RUN && mapped.length > 0) {
      await writeDocs(collection, mapped, cfg.docId);
      console.log(`  [${collection}] migrados a /${collection}`);
    }
  }

  if (!DRY_RUN) {
    await ensureEmptyCollections([
      'driver_profiles',
      'driver_applications',
      'settlements',
      'trip_fare_breakdown',
    ]);
  }

  console.log('\n=== RESUMEN ===');
  for (const s of summary) console.log(`  ${s.collection}: ${s.count}`);
  console.log(DRY_RUN ? '\nTodo listo para migrar. Ejecuta con --write cuando quieras.' : '\nMigracion completada.');
}

// Inicializa colecciones vacias con un doc _init (Firestore no crea colecciones vacias).
async function ensureEmptyCollections(collectionNames) {
  for (const name of collectionNames) {
    const ref = db.collection(name);
    const snap = await ref.limit(20).get();
    if (snap.size === 0) {
      await ref.doc('_init').set({
        _init: true,
        created_at: admin.firestore.Timestamp.now(),
        note: 'Coleccion inicializada (tabla vacia en Supabase). Eliminar este doc cuando haya datos reales.',
      });
      console.log(`  [${name}] inicializada con doc _init.`);
    }
  }
}

run().catch((e) => {
  console.error('\nERROR:', e.message);
  process.exit(1);
});