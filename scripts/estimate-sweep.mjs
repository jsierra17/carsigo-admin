#!/usr/bin/env node
/**
 * Barrido de precios contra el endpoint REAL /api/pricing/estimate
 * (motor autoritativo en apps/admin-api, conectado a los datos de la zona).
 *
 * Genera un idToken efímero (custom token con Admin SDK → exchange REST),
 * lanza 24 casos (3 distancias × 2 vehículos × 4 turnos) y produce filas
 * Markdown para comparar ANTES/DESPUÉS de un cambio de tarifas.
 *
 * USO: node --env-file=.env scripts/estimate-sweep.mjs [BASE_URL]
 */
import fs from 'node:fs'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { randomUUID } from 'node:crypto'

const BASE = process.argv[2] || 'http://127.0.0.1:4000'
const ZONE = 'el-carmen-de-bolivar'

/** Casos: slot de turno (label, datetime) × vehículo × distancias. */
const SLOTS = [
  { label: 'Día L-J (Mar 10:30, h+5.5)', datetime: '2026-11-10T10:30:00' },
  { label: 'Noche L-J (Mar 20:30, h+2)', datetime: '2026-11-10T20:30:00' },
  { label: 'Día V-D (Dom 10:30, h+5.5)', datetime: '2026-11-15T10:30:00' },
  { label: 'Noche V-D (Dom 20:30, h+2)', datetime: '2026-11-15T20:30:00' },
]
const DISTANCES = [2, 6, 12]
const VEHICLES = ['moto', 'car']

const cred = cert(JSON.parse(fs.readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT, 'utf8')))
if (getApps().length === 0) initializeApp({ credential: cred })

// Token efímero para autenticar contra la API (el usuario del rol-test ya existe).
const uid = 'CMjER0jw1YRGzKhhKNzsD7VqR793'
const customToken = await getAuth().createCustomToken(uid)
const key = process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY
const res = await fetch(
  `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${key}`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // La API key web está restringida por referrer y Node no envía uno:
      // suplantamos al panel local, cuyo referer sí está autorizado.
      Referer: 'http://localhost:5173/',
    },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  },
)
if (!res.ok) {
  throw new Error(`Exchange de custom token falló: ${res.status} ${await res.text()}`)
}
const exchange = await res.json()
const idToken = exchange.idToken

// Sala de casos.
const results = []
for (const slot of SLOTS) {
  for (const vehicle of VEHICLES) {
    for (const distance of DISTANCES) {
      const r = await fetch(`${BASE}/api/pricing/estimate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          vehicle_type: vehicle,
          distance_km: distance,
          zone_id: ZONE,
          datetime: slot.datetime,
        }),
      })
      if (!r.ok) {
        throw new Error(`estimate ${slot.label} ${vehicle} ${distance}km -> ${r.status} ${await r.text()}`)
      }
      results.push({ slot: slot.label, datetime: slot.datetime, vehicle, distance, data: await r.json() })
    }
  }
}

// Salida: filas Markdown agrupadas por slot. El multiplicador festivo se
// aplica encima del resultado sin festivo (el motor: techo → x1.3 → piso).
const festMul = 1.3
for (const slot of [ ...new Set(results.map((r) => r.slot)) ]) {
  console.log(`\n### ${slot}\n`)
  console.log('| Vehículo | km | Pasajero | Festivo x1.3 | Conductor (12%) | Base turno | Extra km |')
  console.log('|---|---|---|---|---|---|---|')
  for (const r of results.filter((x) => x.slot === slot)) {
    const d = r.data
    const festivo = Math.round((d.final_fare * festMul) / 100) * 100
    console.log(
      `| ${r.vehicle} | ${r.distance} | $${d.final_fare.toLocaleString('es-CO')} | $${festivo.toLocaleString('es-CO')} | $${d.driver_earnings.toLocaleString('es-CO')} | $${d.current_base_fee.toLocaleString('es-CO')} | $${d.extra_km_charge.toLocaleString('es-CO')} |`,
    )
  }
}
const health = await (await fetch(`${BASE}/health`)).json()
console.log(`\n[health] ok=${health.ok} env=${health.env} ts=${health.time} | runId=${randomUUID()}`)
