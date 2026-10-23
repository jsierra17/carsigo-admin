import express from 'express'
import cors from 'cors'
import { ALLOWED_ORIGINS, NODE_ENV, IS_PROD } from './config.js'
import routes from './routes/index.js'
import { notFound, errorHandler } from './middleware/error-handler.js'
import { rateLimit } from './middleware/rate-limit.js'

/**
 * Factory de la aplicaciÃ³n Express.
 * Se exporta separada de `index.js` para poder testearla sin abrir un puerto.
 */
export function createApp() {
  const app = express()

  app.disable('x-powered-by')
  app.set('trust proxy', 1)

  // CORS: permite el panel Vue configurado en ALLOWED_ORIGINS.
  // En desarrollo se admite cualquier localhost (cualquier puerto), para no
  // tener que reconfigurar la API cada vez que cambia el puerto de Vite.
  const isLocalOrigin = (origin) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)

  app.use(
    cors({
      origin(origin, callback) {
        // Sin Origin = llamada server-to-server, curl, Postman, o a travÃ©s
        // del proxy de Vite (que elimina el Origin).
        if (!origin) return callback(null, true)
        if (ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin)) {
          return callback(null, true)
        }
        if (!IS_PROD && isLocalOrigin(origin)) return callback(null, true)
        return callback(new Error(`Origen no permitido por CORS: ${origin}`))
      },
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  )

  app.use(express.json({ limit: '1mb' }))
  app.use(express.urlencoded({ extended: true, limit: '1mb' }))

  // Cabeceras de seguridad. La API se sirve detrás de Firebase Hosting (que
  // ya añade las suyas), pero también es accesible directamente por su URL de
  // Cloud Run, así que las define también por su cuenta.
  app.disable('x-powered-by')
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Frame-Options', 'DENY')
    res.setHeader('Referrer-Policy', 'no-referrer')
    res.setHeader('Permissions-Policy', 'geolocation=(), camera=()')
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin')
    next()
  })

  // Logger mÃ­nimo
  app.use((req, res, next) => {
    const started = Date.now()
    res.on('finish', () => {
      console.log(
        `${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - started}ms)`,
      )
    })
    next()
  })

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'carsigo-admin-api', env: NODE_ENV, time: new Date().toISOString() })
  })

  // Límite global: la API es una superficie pública (Cloud Run con
  // `invoker: public`), así que debe protegerse del agotamiento de cuota.
  app.use('/api', rateLimit({ max: 200, windowMs: 15 * 60 * 1000, scope: 'global' }))

  app.use('/api', routes)

  app.use(notFound)
  app.use(errorHandler)

  return app
}


