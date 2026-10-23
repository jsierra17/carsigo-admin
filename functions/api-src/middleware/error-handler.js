/**
 * Manejo de errores de la Admin API.
 *
 * No se filtran detalles internos (stack traces, mensajes de Firestore) al
 * cliente: se registran en el log del servidor y se devuelve un mensaje
 * genérico con un identificador para poder correlacionar.
 */
import { randomUUID } from 'node:crypto'

/** 404 para rutas no registradas. */
export function notFound(req, res) {
  res.status(404).json({
    error: 'Ruta no encontrada',
    detail: `${req.method} ${req.originalUrl}`,
  })
}

/**
 * Manejador de errores final (debe registrarse al final, con 4 argumentos).
 */
export function errorHandler(err, req, res, _next) {
  const status = Number(err?.status || err?.statusCode || 500)
  const reference = randomUUID().slice(0, 8)

  // Los 4xx son errores del cliente: se registran en warning.
  if (status >= 500) {
    console.error(`[error:${reference}] ${req.method} ${req.originalUrl} ->`, err)
  } else {
    console.warn(`[warn:${reference}] ${req.method} ${req.originalUrl} -> ${err?.message}`)
  }

  // El mensaje de Firestore/Admin puede contener detalles internos del
  // esquema; solo se expone en desarrollo.
  const isDev = process.env.NODE_ENV !== 'production'
  const safeMessage =
    status >= 500
      ? 'Error interno del servidor'
      : err?.message || 'Error al procesar la solicitud'

  res.status(status).json({
    error: safeMessage,
    reference,
    ...(isDev && status >= 500 ? { detail: err?.message } : {}),
  })
}
