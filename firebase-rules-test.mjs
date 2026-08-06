import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing'

const here = path.dirname(fileURLToPath(import.meta.url))
const rulesSource = readFileSync(path.join(here, 'firestore.rules'), 'utf8')

let testEnv
let failures = 0
function check(name, got, expected) {
  const ok = got === expected
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  (${got ? 'ALLOWED' : 'DENIED'})`)
  if (!ok) failures++
}

testEnv = initializeTestEnvironment({
  projectId: 'demo-carsigo',
  firestore: {
    host: '127.0.0.1',
    port: 8080,
    rules: rulesSource,
  },
}).then((env) => {
  console.error('init OK')
  return env
})

// ── Caso A: atacante común (sin claims) ──
const attackerCtx = await (await testEnv).authenticatedContext('attacker-uid')
const atk = attackerCtx.firestore()

try {
  await assertFails(atk.doc('users/attacker-uid').set({ name: 'hacker', email: 'h@x.io', role: 'superadmin', phone: '' }))
  check('create users role superadmin (DENY)', true, true)
} catch (e) { console.error('A1 err:', e?.message?.slice(0, 140)); check('create users role superadmin (DENY)', false, true) }

try {
  await assertFails(atk.doc('users/someone-else').get())
  check('leer users ajeno (DENY)', true, true)
} catch (e) { console.error('A2 err:', e?.message?.slice(0, 140)); check('leer users ajeno (DENY)', false, true) }

try {
  await assertSucceeds(atk.doc('users/attacker-uid').get())
  check('leer users propio (ALLOW)', true, true)
} catch (e) { console.error('A3 err:', e?.message?.slice(0, 140)); check('leer users propio (ALLOW)', false, true) }

await attackerCtx.cleanup()

// ── Caso B: superadmin autentico (claims role en el token) ──
const adminCtx = await (await testEnv).authenticatedContext('admin-uid-1', {
  email: 'jose@carsigo.co',
  role: 'superadmin',
  status: 'active',
})
const adm = adminCtx.firestore()

try {
  await assertSucceeds(adm.doc('users/someone-else').get())
  check('superadmin lee users ajeno (ALLOW)', true, true)
} catch (e) { console.error('B1 err:', e?.message?.slice(0, 140)); check('superadmin lee users ajeno (ALLOW)', false, true) }

try {
  await assertFails(adm.doc('users/admin-uid-1').set({ name: 'Jose', email: 'jose@carsigo.co', role: 'superadmin', status: 'active', created_at: null }))
  check('superadmin NO crea users via cliente (sobre Admin SDK)', true, true)
} catch (e) { console.error('B2 err:', e?.message?.slice(0, 140)); check('superadmin NO crea users via cliente (sobre Admin SDK)', false, true) }

await adminCtx.cleanup()

console.log(failures === 0 ? 'ALL PASS' : `${failures} FAILURES`)
process.exit(failures === 0 ? 0 : 1)