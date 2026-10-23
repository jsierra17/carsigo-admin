// Helpers de autenticación vía la REST API de Firebase Identity Platform.
// Útiles en el servidor (login por email y reset de contraseña) sin depender
// del SDK de cliente.

const AUTH_REST = 'https://identitytoolkit.googleapis.com/v1'

export function getFirebaseApiKey() {
  return process.env.FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY || ''
}

/**
 * Inicia sesión con email + contraseña.
 * @returns {Promise<{idToken?:string, localId?:string, email?:string, displayName?:string|null, error?:{message:string}}>}
 */
export async function restSignIn(email, password) {
  const res = await fetch(`${AUTH_REST}/accounts:signInWithPassword?key=${getFirebaseApiKey()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    return { error: { message: body?.error?.message || 'INVALID_LOGIN_CREDENTIALS' } }
  }
  return {
    idToken: body.idToken,
    localId: body.localId,
    email: body.email,
    displayName: body.displayName || null,
  }
}

/** Envía el correo de restablecimiento de contraseña. */
export async function sendPasswordReset(email, continueUrl) {
  const res = await fetch(`${AUTH_REST}/accounts:sendOobCode?key=${getFirebaseApiKey()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requestType: 'PASSWORD_RESET',
      email,
      ...(continueUrl ? { continueUrl } : {}),
    }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    return { error: { message: body?.error?.message || 'Unauthorized' } }
  }
  return { error: null }
}

/** Confirma el restablecimiento con el código `oobCode`. */
export async function confirmPasswordReset(oobCode, newPassword) {
  const res = await fetch(`${AUTH_REST}/accounts:resetPassword?key=${getFirebaseApiKey()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ oobCode, newPassword }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    return { error: { message: body?.error?.message || 'OOB_CODE_INVALID' } }
  }
  return { error: null }
}
