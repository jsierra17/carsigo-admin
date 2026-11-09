/**
 * Capa de acceso a Firestore para el panel admin.
 *
 * Usa el Web SDK con el token del usuario: las `firestore.rules` aplican, y un
 * usuario con rol `admin`/`superadmin` puede leer/escribir las colecciones de
 * gestión (rate_cards, rate_schedules, dynamic_pricing_rules, geofences,
 * driver_applications, driver_profiles, wallets, settlements, users, trips).
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getCountFromServer,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit as fbLimit,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from './firebase.js'

/**
 * Traduce una configuración de consulta a un `Query` de Firestore.
 * @param {object} [options]
 * @param {Array<[string, unknown]>} [options.where]  Pares [campo, valor]
 * @param {Array<[string, 'asc'|'desc']>} [options.orderBy]
 * @param {number} [options.limit]
 */
function buildQuery(collectionName, options = {}) {
  const { where: wheres = [], orderBy: orders = [], limit } = options
  const parts = []
  for (const [field, value] of wheres) {
    if (value === undefined) continue
    parts.push(where(field, '==', value))
  }
  for (const [field, direction] of orders) {
    parts.push(orderBy(field, direction))
  }
  if (limit) parts.push(fbLimit(limit))
  return query(collection(db, collectionName), ...parts)
}

/** Lee documentos de una colección como array plano. */
export async function fetchDocs(collectionName, options = {}) {
  const snap = await getDocs(buildQuery(collectionName, options))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

/** Cuenta documentos que cumplen un filtro (server-side, eficiente). */
export async function countDocs(collectionName, options = {}) {
  const snap = await getCountFromServer(buildQuery(collectionName, options))
  return snap.data().count
}

/** Lee un documento por id. */
export async function fetchDoc(collectionName, id) {
  const snap = await getDoc(doc(db, collectionName, id))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

/** Crea un documento con id autogenerado. */
export async function createDoc(collectionName, data) {
  const ref = await addDoc(collection(db, collectionName), {
    ...data,
    created_at: serverTimestamp(),
  })
  return ref.id
}

/** Crea un documento con id explícito. */
export async function setDocWithId(collectionName, id, data) {
  const ref = doc(db, collectionName, id)
  await setDoc(ref, { ...data, created_at: serverTimestamp() })
  return id
}

/** Actualiza (merge) un documento. */
export async function updateDocById(collectionName, id, data) {
  const ref = doc(db, collectionName, id)
  await updateDoc(ref, data)
}

/** Elimina un documento. */
export async function deleteDocById(collectionName, id) {
  await deleteDoc(doc(db, collectionName, id))
}

/**
 * Copia todos los documentos de `sourceCollection` que tengan
 * `field == sourceValue` a `targetCollection` con `field = targetValue`.
 * @returns {Promise<number>} cantidad de documentos copiados
 */
export async function copyByField(
  sourceCollection,
  targetCollection,
  field,
  sourceValue,
  targetValue,
) {
  const snap = await getDocs(
    query(collection(db, sourceCollection), where(field, '==', sourceValue)),
  )
  if (snap.empty) return 0

  const batch = writeBatch(db)
  for (const d of snap.docs) {
    const { id, created_at, ...data } = d.data()
    batch.set(doc(collection(db, targetCollection)), { ...data, [field]: targetValue })
  }
  await batch.commit()
  return snap.size
}

/**
 * Asigna a `targetValue` todos los documentos que tengan `field == null`
 * (configuración heredada sin zona asignada).
 * @returns {Promise<number>} cantidad de documentos migrados
 */
export async function migrateNullToValue(collectionName, field, targetValue) {
  const snap = await getDocs(query(collection(db, collectionName), where(field, '==', null)))
  if (snap.empty) return 0

  const batch = writeBatch(db)
  snap.docs.forEach((d) => batch.update(d.ref, { [field]: targetValue }))
  await batch.commit()
  return snap.size
}

/** Límite de operaciones por batch de Firestore. */
const BATCH_LIMIT = 500

/**
 * Clona TODAS las tarifas de una zona maestra a una nueva zona:
 * `rate_cards`, `rate_schedules` y `dynamic_pricing_rules` con
 * `zone_id == sourceZoneId` si clonan con `zone_id == targetZoneId`.
 *
 * Escribe con writeBatch (chunks de 500) para que las tarifas de la nueva
 * zona sean INDEPENDIENTES de la maestra desde el primer momento.
 *
 * @param {string} sourceZoneId slug de la zona maestra (ej. 'el-carmen-de-bolivar')
 * @param {string} targetZoneId slug de la nueva zona (ej. 'san-jacinto')
 * @returns {Promise<{ rate_cards: number, rate_schedules: number, dynamic_pricing_rules: number }>}
 */
export async function cloneZoneTariffs(sourceZoneId, targetZoneId) {
  const collectionsToClone = ['rate_cards', 'rate_schedules', 'dynamic_pricing_rules']
  const snaps = await Promise.all(
    collectionsToClone.map((name) =>
      getDocs(query(collection(db, name), where('zone_id', '==', sourceZoneId))),
    ),
  )

  const ops = []
  const counts = {}
  snaps.forEach((snap, index) => {
    const name = collectionsToClone[index]
    counts[name] = snap.size
    snap.docs.forEach((d) => {
      const { id, created_at, ...data } = d.data()
      ops.push({
        ref: doc(collection(db, name)),
        data: { ...data, zone_id: targetZoneId, created_at: serverTimestamp() },
      })
    })
  })

  for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db)
    for (const op of ops.slice(i, i + BATCH_LIMIT)) {
      batch.set(op.ref, op.data)
    }
    await batch.commit()
  }
  return counts
}

/**
 * Elimina una zona de `geofences` y EN CASCADA sus tarifas asociadas
 * (`rate_cards`, `rate_schedules`, `dynamic_pricing_rules` con
 * `zone_id == zoneSlug`), todo en un writeBatch (atómico).
 *
 * IMPORTANTE: solo se eliminan tarifas del slug de la zona indicada; las
 * tarifas de cualquier otra zona (incluida la maestra) no se tocan.
 *
 * @returns {Promise<{ rate_cards: number, rate_schedules: number, dynamic_pricing_rules: number }>}
 */
export async function deleteZoneCascade(zoneDocId, zoneSlug) {
  const collectionsToClean = ['rate_cards', 'rate_schedules', 'dynamic_pricing_rules']
  const snaps = await Promise.all(
    collectionsToClean.map((name) =>
      getDocs(query(collection(db, name), where('zone_id', '==', zoneSlug))),
    ),
  )

  const counts = {}
  const ops = []
  snaps.forEach((snap, index) => {
    const name = collectionsToClean[index]
    counts[name] = snap.size
    snap.docs.forEach((d) => ops.push({ kind: 'delete', ref: d.ref }))
  })
  ops.push({ kind: 'delete', ref: doc(db, 'geofences', zoneDocId) })

  for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db)
    for (const op of ops.slice(i, i + BATCH_LIMIT)) {
      batch.delete(op.ref)
    }
    await batch.commit()
  }
  return counts
}

/**
 * Cuenta las tarifas asociadas a un slug de zona (para avisos de borrado).
 * @returns {Promise<{ rate_cards: number, rate_schedules: number, dynamic_pricing_rules: number, total: number }>}
 */
export async function countZoneTariffs(zoneSlug) {
  const collectionsToCount = ['rate_cards', 'rate_schedules', 'dynamic_pricing_rules']
  const snaps = await Promise.all(
    collectionsToCount.map((name) =>
      getCountFromServer(query(collection(db, name), where('zone_id', '==', zoneSlug))),
    ),
  )
  const counts = {}
  let total = 0
  snaps.forEach((snap, index) => {
    counts[collectionsToCount[index]] = snap.data().count || 0
    total += counts[collectionsToCount[index]]
  })
  return { ...counts, total }
}

/**
 * Traduce un FirestoreError a un mensaje accionable para el panel.
 *
 * Caso clave: `failed-precondition` = la consulta necesita un índice
 * compuesto; el mensaje original del SDK incluye la URL de creación directa
 * (https://console.firebase.google.com/...&create_index=...). Se extrae para
 * poder ofrecerla como enlace en la UI en lugar de pantalla en blanco.
 *
 * @param {Error|string} error Error del SDK (o su mensaje)
 * @returns {{ title: string, detail: string, indexUrl: string|null }}
 */
export function describeFirestoreError(error) {
  const message = typeof error === 'string' ? error :(error?.message || '')
  const code = typeof error === 'object' ? error?.code || '' : ''
  const indexUrl =
    message.match(/https:\/\/console\.firebase\.google\.com[^\s"'<>]+/)?.[0] || null

  if (code === 'failed-precondition' || indexUrl) {
    return {
      title: 'Falta un índice de Firestore',
      detail:
        'Esta consulta necesita un índice compuesto que aún no existe. Créalo desde el enlace (tarda 1-2 minutos en generarse) y recarga la vista.',
      indexUrl,
    }
  }
  if (code === 'permission-denied') {
    return {
      title: 'Permisos insuficientes',
      detail:
        'Las reglas de seguridad de Firestore bloquearon la operación. Verifica que tu usuario tenga rol admin/superadmin.',
      indexUrl: null,
    }
  }
  return { title: 'Error al cargar los datos', detail: message || 'Error desconocido', indexUrl: null }
}

export { db, serverTimestamp }
