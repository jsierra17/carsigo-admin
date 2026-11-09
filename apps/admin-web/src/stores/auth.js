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
  const claimsRole = ref(null) // rol desde custom claims del token (fuente de verdad)
  const loading = ref(true)
  const error = ref(null)

  // ── Getters ─────────────────────────────────────────────────────────────
  const isAuthenticated = computed(() => !!user.value)

  /**
   * Rol efectivo.
   *
   * La fuente de verdad es el **custom claim** del token (`decodedToken.role`),
   * porque es lo que la Admin API valida en cada endpoint. El objeto `User` de
   * Firebase NO expone los claims como propiedad (`user.role` siempre es
   * undefined); hay que leerlos con `getIdTokenResult()`. El campo
   * `users/{uid}.role` de Firestore es el espejo para las consultas del panel
   * y puede quedar desincronizado, por eso se usa solo como último recurso.
   */
  const role = computed(() => claimsRole.value || profile.value?.role || null)

  const isAdmin = computed(() => role.value === 'admin' || role.value === 'superadmin')
  const isSuperAdmin = computed(() => role.value === 'superadmin')
  const isValidAdmin = computed(() => role.value === 'admin' || role.value === 'superadmin')
  const displayName = computed(
    () => profile.value?.full_name || profile.value?.name || user.value?.displayName || '',
  )

  // ── Acciones ────────────────────────────────────────────────────────────

  /**
   * Lee el rol de los custom claims del ID token actual (fuente de verdad).
   * `user.role` no existe en el objeto User; los claims viven en
   * `getIdTokenResult().claims`.
   */
  async function loadClaimsRole() {
    const currentUser = auth.currentUser
    if (!currentUser) {
      claimsRole.value = null
      return null
    }
    try {
      const tokenResult = await currentUser.getIdTokenResult()
      claimsRole.value = tokenResult.claims?.role || null
    } catch (e) {
      console.warn('[auth] no se pudieron leer los custom claims:', e)
      claimsRole.value = null
    }
    return claimsRole.value
  }

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

  /**
   * Login con email y contraseña.
   *
   * - `@returns {Promise<boolean>}` true si el login fue correcto y el
   *   usuario es admin/superadmin.
   * - `@throws {Error}` con mensaje legible si Firebase rechaza las
   *   credenciales o el usuario no tiene rol de administrador.
   */
  async function login(email, password) {
    error.value = null
    loading.value = true
    try {
      const result = await signInWithEmailAndPassword(auth, email, password)
      user.value = result.user

      // Forzar renovación del token: los custom claims (role) no llegan en
      // el primer token emitido justo tras el sign-in, solo tras refresh.
      await result.user.getIdToken(true)

      // Leer el rol desde los claims del token renovado (fuente de verdad).
      await loadClaimsRole()

      await loadProfile(result.user.uid)

      if (!isValidAdmin.value) {
        // No es admin: desloguear de inmediato y explicar por qué no entra.
        await firebaseSignOut(auth)
        user.value = null
        profile.value = null
        throw new Error('Tu cuenta no tiene permisos de administrador.')
      }

      return true
    } catch (e) {
      const message = humanizeAuthError(e)
      error.value = message
      throw new Error(message)
    } finally {
      loading.value = false
    }
  }

  /** Alias para compatibilidad con llamadas existentes. */
  async function signInWithEmail(email, password) {
    await login(email, password)
  }

  /** Cierre de sesión. */
  async function signOut() {
    error.value = null
    claimsRole.value = null
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
      // Renovar el token para recoger custom claims (role) que no llegan en
      // el token emitido justo después del sign-in, y evitar que el rol se
      // detecte como null y se cierre la sesión por error.
      try {
        await firebaseUser.getIdToken(true)
      } catch (e) {
        console.warn('[auth] no se pudo renovar el token:', e)
      }
      // Rol desde los custom claims del token (fuente de verdad), antes de
      // validar admin para no cerrar la sesión por un rol leído como null.
      await loadClaimsRole()
      await loadProfile(firebaseUser.uid)
      // Si el usuario no es admin/superadmin, cerrar sesión inmediatamente
      if (!isValidAdmin.value) {
        await signOut()
        profile.value = null
      }
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
    isValidAdmin,
    displayName,
    loadProfile,
    loadClaimsRole,
    refreshToken,
    signInWithGoogle,
    signInWithEmail,
    login,
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
