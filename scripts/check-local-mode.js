/**
 * Inventario de qué cambios del "modo local" siguen aplicados tras la
 * restauración desde git.
 *
 * Uso:  node scripts/check-local-mode.js
 */
import fs from 'node:fs';
import path from 'node:path';

const checks = [
  // ── Modo local: scripts de despliegue ──
  ['package.json', 'sin script "deploy"', (t) => !/"deploy":\s*"/.test(t)],
  ['package.json', 'sin script "deploy:hosting"', (t) => !/"deploy:hosting":\s*"/.test(t)],
  ['package.json', 'script "deploy:prod"', (t) => /"deploy:prod":/.test(t)],
  ['package.json', 'script "quarantine:hosting"', (t) => /"quarantine:hosting":/.test(t)],
  ['package.json', 'deploy sin --config firebase.prod.json', (t) => !/firebase\.prod\.json/.test(t)],
  ['scripts/confirm-prod.js', 'existe', (t) => /CANCELADO/.test(t)],

  // ── Configuracion unica de Firebase ──
  ['firebase.json', 'con bloque "hosting"', (t) => /"hosting"/.test(t)],
  ['firebase.json', 'con bloque "functions"', (t) => /"functions"/.test(t)],
  ['firebase.json', 'con bloque "emulators"', (t) => /"emulators"/.test(t)],
  ['firebase.json', 'con bloque "firestore" y "storage"', (t) => /"firestore"/.test(t) && /"storage"/.test(t)],
  ['firebase.json', 'sin configs multiples', (t) => !/firebase\.prod\.json|firebase\.local\.json/.test(t)],

  // ── Consolidador de .env ──
  ['.env.example', 'existe (plantilla)', (t) => /^VITE_FIREBASE_API_KEY=/m.test(t)],
  ['.env.example', 'sin NEXT_PUBLIC_', (t) => !/NEXT_PUBLIC_/.test(t)],
  ['.env', 'sin NEXT_PUBLIC_', (t) => !/NEXT_PUBLIC_/.test(t)],
  ['.env.production', 'sin NEXT_PUBLIC_', (t) => !/NEXT_PUBLIC_/.test(t)],

  // ── Auditoría de seguridad (debe seguir vigente) ──
  ['apps/admin-api/src/routes/trips.js', 'requireAuth en GET /', (t) => /router\.get\('\/', requireAuth/.test(t)],
  ['apps/admin-api/src/routes/trips.js', 'requireAuth en POST /', (t) => /router\.post\('\/', requireAuth/.test(t)],
  ['apps/admin-api/src/routes/drivers.js', 'requireAuth+requireAdmin', (t) => /requireAuth, requireAdmin/.test(t)],
  ['apps/admin-api/src/routes/zones.js', 'requireAuth', (t) => /router\.post\('\/check', requireAuth/.test(t)],
  ['apps/admin-api/src/routes/pricing.js', 'requireAuth', (t) => /requireAuth/.test(t)],
  ['apps/admin-api/src/routes/admin.js', 'requireSuperAdmin', (t) => /requireSuperAdmin/.test(t)],
  ['apps/admin-api/src/app.js', 'cabeceras de seguridad', (t) => /X-Content-Type-Options/.test(t)],
  ['apps/admin-api/src/app.js', 'rate limit global', (t) => /rateLimit/.test(t)],
  ['apps/admin-api/src/middleware/rate-limit.js', 'existe', (t) => /export function rateLimit/.test(t)],

  // ── Alojamiento local ──
  ['apps/admin-api/src/config.js', 'exporta FIREBASE_PROJECT_ID', (t) => /export const FIREBASE_PROJECT_ID/.test(t)],
  ['apps/admin-api/src/index.js', 'aviso de produccion', (t) => /PRODUCCI/.test(t)],

  // ── Reglas corregidas ──
  ['firebase/storage.rules', 'isAdmin dentro de service', (t) => /service firebase\.storage \{[\s\S]*function isAdmin/.test(t)],
  ['firebase/firestore.rules', 'vocabulario inProgress', (t) => /'inProgress'/.test(t)],
  ['firebase/firestore.rules', 'limites de tamano', (t) => /name\.size\(\) <= 120/.test(t)],

  // ── Sin restos de Next.js / React / Mapbox ──
  ['apps/admin-web/src', 'sin NEXT_PUBLIC_', (t) => !/NEXT_PUBLIC_/.test(t)],
  ['apps/admin-web/src', 'sin mapbox', (t) => !/mapbox/i.test(t)],
  ['apps/admin-web/vite.config.js', 'envPrefix solo VITE_', (t) => /envPrefix:\s*\['VITE_'\]/.test(t)],
  ['apps/admin-api/src', 'sin NEXT_PUBLIC_', (t) => !/NEXT_PUBLIC_/.test(t)],
  ['apps/admin-api/src', 'sin imports de next/', (t) => !/from ['"]next\//.test(t)],
  ['apps/admin-api/src', 'sin mapbox', (t) => !/mapbox/i.test(t)],
  ['apps/mobile/lib', 'sin mapbox', (t) => !/mapbox/i.test(t)],
];

/** Lee un fichero o, si es un directorio, concatena su contenido recursivo. */
function readTarget(file) {
  const abs = path.resolve(file);
  let stat;
  try {
    stat = fs.statSync(abs);
  } catch {
    return null;
  }
  if (stat.isFile()) return fs.readFileSync(abs, 'utf8');
  if (!stat.isDirectory()) return null;

  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (['node_modules', '.git', 'dist', 'build', '.dart_tool'].includes(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(js|ts|vue|json|jsx|tsx)$/.test(entry.name)) {
        try {
          out.push(fs.readFileSync(full, 'utf8'));
        } catch {
          /* binario o inaccesible: se ignora */
        }
      }
    }
  };
  walk(abs);
  return out.join('\n');
}

let ok = 0;
let fail = 0;
for (const [file, label, test] of checks) {
  const content = readTarget(file);
  if (content === null) {
    console.log(`  ✗ ${file.padEnd(44)} ${label}  (fichero no existe)`);
    fail++;
    continue;
  }
  const good = test(content);
  if (good) ok++;
  else fail++;
  console.log(`  ${good ? '✓' : '✗'} ${file.padEnd(44)} ${label}`);
}

console.log(`\n  ${ok} aplicados · ${fail} pendientes de reaplicar\n`);
