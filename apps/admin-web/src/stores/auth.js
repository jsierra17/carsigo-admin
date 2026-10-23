/**
 * Store de autenticación del panel (Pinia).
 *
 * El login se hace en el CLIENTE con el Firebase Web SDK:
 *   - `signInWithPopup` con Google (sin backend de por medio).
 *   - `signInWithEmailAndPassword` con email/contraseña.
 *
 * El rol vive en los custom claims del token (`decodedToken.role`) y se
 * refleja en `users/{uid}.role` de Firestore. Para cambiarlo se usa
 * `POST /api/admin/users/:uid/role` (solo superadmin).
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updatePassword,
  sendPasswordResetEmail,
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db, googleProvider } from '../services/firebase.js'

export const useAuthStore = defineStore('auth', () => {
  // ── Estado ──────────────────────────────────────────────────────────────
  const user = ref(null)
  const profile = ref(null)
  const loading = ref(true)
  const error = ref(null)

  // ── Getters ─────────────────────────────────────────────────────────────
  const isAuthenticated = computed(() => !!user.value)

  /**
   * Rol efectivo.
   *
   * La fuente de verdad es el **custom claim** del token (`decodedToken.role`),
   * porque es lo que la Admin API valida en cada endpoint. El campo
   * `users/{uid}.role` de Firestore es el espejo para las consultas del panel
   * y puede quedar desincronizado, por eso se usa solo como respaldo.
   */
  const role = computed(() => user.value?.role || profile.value?.role || null)

  const isAdmin = computed(() => role.value === 'admin' || role.value === 'superadmin')
  const isSuperAdmin = computed(() => role.value === 'superadmin')
  const displayName = computed(
    () => profile.value?.full_name || profile.value?.name || user.value?.displayName || '',
  )

  // ── Acciones ────────────────────────────────────────────────────────────

  /** Carga el perfil de Firestore (`users/{uid}`). */
  async function loadProfile(uid) {
    if (!uid) {
      profile.value = null
      return null
    }
    try {
      const snap = await getDoc(doc(db, 'users', uid))
      profile.value = snap.exists() ? { id: snap.id, ...snap.data() } : null
    } catch (e) {
      console.error('[auth] no se pudo cargar el perfil:', e)
      profile.value = null
    }
    return profile.value
  }

  /** Renueva el ID token para recoger custom claims nuevos (p.ej. tras un cambio de rol). */
  async function refreshToken() {
    if (!user.value) return null
    await user.value.getIdToken(true)
    await loadProfile(user.value.uid)
  }

  /** Login con Google (popup). */
  async function signInWithGoogle() {
    error.value = null
    loading.value = true
    try {
      const result = await signInWithPopup(auth, googleProvider)
      user.value = result.user
      await loadProfile(result.user.uid)
      return result.user
    } catch (e) {
      error.value = humanizeAuthError(e)
      throw e
    } finally {
      loading.value = false
    }
  }

  /** Login con email y contraseña. */
  async function signInWithEmail(email, password) {
    error.value = null
    loading.value = true
    try {
      const result = await signInWithEmailAndPassword(auth, email, password)
      user.value = result.user
      await loadProfile(result.user.uid)
      return result.user
    } catch (e) {
      error.value = humanizeAuthError(e)
      throw e
    } finally {
      loading.value = false
    }
  }

  /** Cierre de sesión. */
  async function signOut() {
    error.value = null
    try {
      await firebaseSignOut(auth)
    } catch (e) {
      error.value = humanizeAuthError(e)
    } finally {
      user.value = null
      profile.value = null
    }
  }

  /** Cambia la contraseña del usuario actual. */
  async function changePassword(newPassword) {
    if (!user.value) throw new Error('No hay sesión activa')
    await updatePassword(user.value, newPassword)
  }

  /** Envía el correo de restablecimiento. */
  async function requestPasswordReset(email) {
    await sendPasswordResetEmail(auth, email)
  }

  // ── Observador de sesión ────────────────────────────────────────────────
  onAuthStateChanged(auth, async (firebaseUser) => {
    user.value = firebaseUser
    if (firebaseUser) {
      await loadProfile(firebaseUser.uid)
    } else {
      profile.value = null
    }
    loading.value = false
  })

  return {
    user,
    profile,
    loading,
    error,
    isAuthenticated,
    role,
    isAdmin,
    isSuperAdmin,
    displayName,
    loadProfile,
    refreshToken,
    signInWithGoogle,
    signInWithEmail,
    signOut,
    changePassword,
    requestPasswordReset,
  }
})

/** Traduce los códigos de error de Firebase a mensajes en español. */
function humanizeAuthError(e) {
  const map = {
    'auth/invalid-credential': 'Correo o contraseña incorrectos',
    'auth/user-not-found': 'No existe una cuenta con ese correo',
    'auth/wrong-password': 'Correo o contraseña incorrectos',
    'auth/invalid-email': 'El correo no es válido',
    'auth/too-many-requests': 'Demasiados intentos. Intenta más tarde',
    'auth/popup-closed-by-user': 'Se cerró la ventana de inicio de sesión',
    'auth/popup-blocked': 'El navegador bloqueó la ventana de inicio de sesión',
    'auth/user-disabled': 'La cuenta está deshabilitada',
    'auth/requires-recent-login': 'Debes volver a iniciar sesión para hacer ese cambio',
  }
  return map[e?.code] || e?.message || 'Error de autenticación'
}
