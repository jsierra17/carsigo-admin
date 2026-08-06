// Helpers de autenticación vía la REST API de Firebase Identity Toolkit.
// Se usan tanto en servidor (login en server action) como en cliente
// (confirmación de reset de contraseña).

const AUTH_REST = 'https://identitytoolkit.googleapis.com/v1'

export function getFirebaseApiKey(): string {
  return process.env.NEXT_PUBLIC_FIREBASE_API_KEY || ''
}

export async function restSignIn(email: string, password: string) {
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
    idToken: body.idToken as string,
    localId: body.localId as string,
    email: body.email as string,
    displayName: (body.displayName as string) || null,
  }
}

export async function sendPasswordReset(email: string, continueUrl?: string) {
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

export async function confirmPasswordReset(oobCode: string, newPassword: string) {
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