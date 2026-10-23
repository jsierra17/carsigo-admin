import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Prioridad de carga (la primera que exista gana; dotenv no sobreescribe
// variables ya presentes en process.env):
//   1. apps/admin-api/.env
//   2. <raíz del monorepo>/.env
//   3. <raíz del monorepo>/.env.local
const ROOT = path.resolve(__dirname, '../../..')

for (const envPath of [
  path.resolve(__dirname, '../.env'),
  path.resolve(ROOT, '.env'),
  path.resolve(ROOT, '.env.local'),
]) {
  dotenv.config({ path: envPath })
}

export const PORT = Number(process.env.PORT) || 4000

export const OWNER_EMAIL = process.env.OWNER_EMAIL || 'todoobraparabien1998@gmail.com'

export const DEFAULT_ZONE_ID = process.env.DEFAULT_ZONE_ID || 'el-carmen-de-bolivar'

/**
 * Orígenes permitidos por CORS.
 *
 * El panel Vue se sirve desde Firebase Hosting y llama a la API en el mismo
 * dominio vía el rewrite `/api/**`. En ese caso el navegador envía
 * `Origin: https://<site>.web.app`, que debe estar permitido o la API
 * respondería 500.
 *
 * Añade aquí el dominio personalizado cuando lo tengas:
 *   ALLOWED_ORIGINS=https://carsigo-9e508.web.app,https://panel.carsigo.co
 */
const DEFAULT_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://carsigo-9e508.web.app',
  'https://carsigo-9e508.firebaseapp.com',
]

export const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || DEFAULT_ORIGINS.join(','))
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

export const NODE_ENV = process.env.NODE_ENV || 'development'

export const IS_PROD = NODE_ENV === 'production'
