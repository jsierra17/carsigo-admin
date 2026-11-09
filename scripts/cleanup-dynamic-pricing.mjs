#!/usr/bin/env node
/**
 * Limpieza PUNTUAL de duplicados en `dynamic_pricing_rules`.
 *
 * Fecha: 2026-11. Elimina las reglas date_range que se solapan con reglas
 * specific_date del mismo festivo (y una fecha redundante de Fiestas
 * Patronales). Quedan 8 reglas activas: 1 regla por festivo-día, x1.3,
 * todas `specific_date` (recurrentes anuales con el matching del motor:
 * mes+fecha). Los `date_range` además solo viven en su año literal
 * (el motor no los hace recurrentes), así que eran las candidatas a morir.
 *
 * USO:
 *   node --env-file=.env scripts/cleanup-dynamic-pricing.mjs          # dry-run
 *   node --env-file=.env scripts/cleanup-dynamic-pricing.mjs --apply  # borra de verdad
 *
 * Guardas: solo borra si el documento existe, su zone_id es el esperado
 * y su `name`/`specific conditions` coinciden con lo registrado aquí.
 */
import fs from 'node:fs'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

/** Reglas a eliminar con su justificación y guardas de identidad. */
const TO_DELETE = [
  { id: '23651259-a732-4353-9f88-7fe023e43db7', expect: { name: 'Semana Santa' }, reason: 'date_range 3→10 abr: solapa Jueves/Viernes/Sábado Santo y expira en 2026' },
  { id: '540d717e-ff08-4a67-84f6-4e3d30cffce9', expect: { name: 'Carnaval' }, reason: 'date_range 19→22 feb: solapa Carnaval (16 feb) y fechas fuera del Carnaval real 2026' },
  { id: '4a09592d-2ce1-4b6f-846b-57f71bf9ae3c', expect: { name: 'Fiestas patronales' }, reason: 'date_range 14 jul→18 ago: solapa Virgen del Carmen (16 jul)' },
  { id: '783a8b0a-d28d-4be8-abe7-3988fa9dea96', expect: { name: 'Fiestas Patronales 18 Jul' }, expectDate: '2026-07-18', reason: 'Festividad duplicada: Virgen del Carmen ya está cubierta por la regla del 16 de julio' },
]

const ZONE = 'el-carmen-de-bolivar'
const APPLY = process.argv.includes('--apply')

const cred = cert(JSON.parse(fs.readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT, 'utf8')))
if (getApps().length === 0) initializeApp({ credential: cred })
const db = getFirestore()

console.log(`Limpieza dynamic_pricing_rules (${ZONE}) — modo: ${APPLY ? 'APLICAR' : 'DRY-RUN'}\n`)

// Seguridad global: abortar si la zona cambió (datos distintos a auditados).
const rules = await db.collection('dynamic_pricing_rules').where('zone_id', '==', ZONE).get()
console.log(`Reglas activas para la zona: ${rules.size} (esperadas: 12)\n`)

const batch = db.batch()
let deletions = 0

for (const item of TO_DELETE) {
  const ref = db.collection('dynamic_pricing_rules').doc(item.id)
  const snap = await ref.get()

  if (!snap.exists) {
    console.log(`SKIP  ${item.id} — ya no existe`)
    continue
  }
  const data = snap.data()
  if (data.zone_id !== ZONE) {
    console.log(`SKIP  ${item.id} — zone_id inesperado: ${data.zone_id}`)
    continue
  }
  if (item.expect?.name && data.name !== item.expect.name) {
    console.log(`SKIP  ${item.id} — name inesperado: ${JSON.stringify(data.name)}`)
    continue
  }
  if (item.expectDate && data.specific_date !== item.expectDate) {
    console.log(`SKIP  ${item.id} — fecha inesperada: ${JSON.stringify(data.specific_date)}`)
    continue
  }

  console.log(`DELETE ${item.id} (${JSON.stringify(data.name)}) — ${item.reason}`)
  batch.delete(ref)
  deletions++
}

if (!APPLY) {
  console.log(`\nDRY-RUN: ${deletions} documento(s) serían borrados. Ejecuta con --apply para confirmarlo.`)
  process.exit(0)
}

if (deletions === 0) {
  console.log('\nNada que borrar.')
  process.exit(0)
}

await batch.commit()
const after = await db.collection('dynamic_pricing_rules').where('zone_id', '==', ZONE).get()
console.log(`\nOK: ${deletions} borrado(s). Reglas restantes para ${ZONE}: ${after.size}`)
for (const d of after.docs) {
  const r = d.data()
  console.log(`  - ${r.name} (${r.rule_type} ${r.specific_date || r.date_from || d.data().days_of_week?.length || ''}) x${r.multiplier}`)
}
