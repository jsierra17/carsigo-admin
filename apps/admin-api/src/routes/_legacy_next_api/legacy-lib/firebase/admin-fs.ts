/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Firestore } from 'firebase-admin/firestore'

/**
 * Helpers de Firestore para el Admin SDK (API namespaced de firebase-admin,
 * que no exporta las funciones modulares de 'firebase/firestore').
 * Suficiente para cumplir la interfaz `CompatDeps.fs`.
 */
export const adminFs = {
  collection: (db: Firestore, path: string) => db.collection(path),
  doc: (db: Firestore, path: string, ...ids: string[]) =>
    db.doc(ids.length ? `${path}/${ids.join('/')}` : path),
  getDocs: (ref: any) => ref.get() as Promise<any>,
  getDoc: (ref: any) => ref.get() as Promise<any>,
  setDoc: (ref: any, data: any) => ref.set(data),
  updateDoc: (ref: any, data: any) => ref.update(data),
  deleteDoc: (ref: any) => ref.delete(),
  addDoc: (ref: any, data: any) => ref.add(data),
}