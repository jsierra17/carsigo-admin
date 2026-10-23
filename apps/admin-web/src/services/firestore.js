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

export { db, serverTimestamp }
