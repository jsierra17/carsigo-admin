/**
 * Migration script for CarSiGo Supabase database.
 * 
 * Usage:
 *   1. Set SUPABASE_DB_URL env var or pass as --db-url param
 *   2. node scripts/migrate.js
 * 
 * DB URL format: postgresql://postgres:[PASSWORD]@db.gyfbazbvrgmwtwkkswdy.supabase.co:5432/postgres
 * Get password from Supabase Dashboard > Project Settings > Database
 */

const { Client } = require('pg')
const fs = require('fs')
const path = require('path')

const DB_URL = process.env.SUPABASE_DB_URL || process.argv.find(a => a.startsWith('--db-url='))?.split('=')[1]

if (!DB_URL) {
  console.error(`
❌ SUPABASE_DB_URL no encontrada.
   
   Para obtener la contraseña de la base de datos:
   1. Ve a https://supabase.com/dashboard/project/gyfbazbvrgmwtwkkswdy
   2. Settings > Database > Connection string
   3. Copia la URI (postgresql://postgres:XXXX@...)
   
   Luego ejecuta:
     set SUPABASE_DB_URL=postgresql://postgres:XXXX@db.gyfbazbvrgmwtwkkswdy.supabase.co:5432/postgres
     node scripts/migrate.js
   
   O directamente:
     node scripts/migrate.js --db-url=postgresql://postgres:XXXX@...
`)
  process.exit(1)
}

async function main() {
  console.log('🚀 Conectando a Supabase PostgreSQL...')
  
  const client = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } })
  await client.connect()
  console.log('✅ Conectado.\n')

  const sqlPath = path.join(__dirname, '..', 'supabase', 'migration-002-rate-schedules.sql')
  let sql = fs.readFileSync(sqlPath, 'utf-8')

  // Add special date rules
  sql += `
INSERT INTO public.dynamic_pricing_rules (name, description, rule_type, specific_date, is_recurring, multiplier, vehicle_type, priority)
SELECT d.name, d.description, d.rule_type, d.specific_date, d.is_recurring, d.multiplier, d.vehicle_type, d.priority
FROM (VALUES
  ('Navidad 24 Dic', 'Nochebuena - +25%', 'specific_date'::TEXT, '2026-12-24'::DATE, true, 1.25, NULL::TEXT, 200),
  ('Navidad 25 Dic', 'Navidad - +25%', 'specific_date', '2026-12-25', true, 1.25, NULL, 200),
  ('Año Nuevo 31 Dic', 'Fin de año - +25%', 'specific_date', '2026-12-31', true, 1.25, NULL, 200),
  ('Año Nuevo 1 Ene', 'Año Nuevo - +25%', 'specific_date', '2026-01-01', true, 1.25, NULL, 200),
  ('Semana Santa Jueves', 'Jueves Santo - +25%', 'specific_date', '2026-04-02', true, 1.25, NULL, 200),
  ('Semana Santa Viernes', 'Viernes Santo - +25%', 'specific_date', '2026-04-03', true, 1.25, NULL, 200),
  ('Semana Santa Sábado', 'Sábado de Gloria - +25%', 'specific_date', '2026-04-04', true, 1.25, NULL, 200),
  ('Carnaval Lunes', 'Carnaval Barranquilla - +25%', 'specific_date', '2026-02-16', true, 1.25, NULL, 200),
  ('Carnaval Martes', 'Carnaval Barranquilla - +25%', 'specific_date', '2026-02-17', true, 1.25, NULL, 200),
  ('Virgen del Carmen 16 Jul', 'Fiesta Virgen del Carmen - +25%', 'specific_date', '2026-07-16', true, 1.25, NULL, 200),
  ('Virgen del Carmen 17 Jul', 'Fiesta Virgen del Carmen - +25%', 'specific_date', '2026-07-17', true, 1.25, NULL, 200),
  ('Virgen del Carmen 18 Jul', 'Fiesta Virgen del Carmen - +25%', 'specific_date', '2026-07-18', true, 1.25, NULL, 200)
) AS d(name, description, rule_type, specific_date, is_recurring, multiplier, vehicle_type, priority)
WHERE NOT EXISTS (SELECT 1 FROM public.dynamic_pricing_rules r WHERE r.specific_date = d.specific_date AND r.is_recurring = true);
`

  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))

  for (const stmt of statements) {
    const preview = stmt.split('\n')[0].trim().substring(0, 80)
    process.stdout.write(`  ${preview}... `)
    try {
      await client.query(stmt + ';')
      console.log('✅')
    } catch (err) {
      if (err.code === '42701' || err.message?.includes('already exists')) {
        console.log('⚠️  (ya existe)')
      } else {
        console.log(`❌ ${err.message}`)
      }
    }
  }

  await client.end()
  console.log('\n✅ Migración completada.')
}

main().catch(err => { console.error(err); process.exit(1) })
