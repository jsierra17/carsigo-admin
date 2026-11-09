#!/usr/bin/env node
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import fs from 'node:fs'

const BASE = 'http://127.0.0.1:4000'
const ZONE = 'el-carmen-de-bolivar'

const cred = cert(JSON.parse(fs.readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT, 'utf8')))
if (getApps().length === 0) initializeApp({ credential: cred })
const customToken = await getAuth().createCustomToken('CMjER0jw1YRGzKhhKNzsD7VqR793')
const key = process.env.VITE_FIREBASE_API_KEY
const res = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key='+key, {
  method:'POST', headers:{'Content-Type':'application/json', Referer:'http://localhost:5173/'},
  body:JSON.stringify({token:customToken, returnSecureToken:true})
})
const {idToken} = await res.json()

async function est(vehicle, km, datetime, label) {
  const r = await fetch(BASE+'/api/pricing/estimate', {
    method:'POST', headers:{'Content-Type':'application/json', Authorization:'Bearer '+idToken},
    body:JSON.stringify({vehicle_type:vehicle, distance_km:km, zone_id:ZONE, datetime})
  })
  const d = await r.json()
  console.log('DEBUG:', JSON.stringify(d, null, 2))
  const festivo = Math.round((d.final_fare * 1.2) / 100) * 100
  console.log('| ' + label + ' | $' + d.final_fare.toLocaleString('es-CO') + ' | $' + festivo.toLocaleString('es-CO') + ' | $' + d.driver_earnings.toLocaleString('es-CO') + ' | base $' + d.current_base_fee.toLocaleString('es-CO') + ' | extra $' + d.extra_km_charge.toLocaleString('es-CO') + ' |')
}

console.log('| Caso | Pasajero | Festivo x1.2 | Conductor (12%) | Base turno | Extra km |')
console.log('|---|---|---|---|---|---|')
await est('car', 6, '2026-11-10T10:30:00', 'Martes (weekday day)')