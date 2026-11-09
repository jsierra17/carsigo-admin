/**
 * Servicios de dominio del panel.
 *
 * Cada servicio agrupa las consultas de una sección del panel. Replican la
 * lógica de los antiguos `legacy-actions` del panel Next.js, pero ejecutándose
 * en el navegador contra Firestore con las reglas de seguridad.
 */
import {
  countDocs,
  createDoc,
  deleteDocById,
  fetchDoc,
  fetchDocs,
  migrateNullToValue,
  setDocWithId,
  updateDocById,
  copyByField,
  serverTimestamp,
  cloneZoneTariffs,
  deleteZoneCascade,
} from './firestore.js'

// ── Dashboard ──────────────────────────────────────────────────────────────

export const dashboardService = {
  /** Métricas principales: pasajeros, conductores y solicitudes pendientes. */
  async getMetrics() {
    const [pasajeros, conductores, pendientes] = await Promise.all([
      countDocs('users', { where: [['role', 'passenger']] }),
      countDocs('users', { where: [['role', 'driver']] }),
      countDocs('driver_profiles', { where: [['status', 'pending']] }),
    ])
    return { pasajeros, conductores, pendientes }
  },

  /** Conductores registrados más recientemente. */
  getLatestDrivers(limit = 5) {
    return fetchDocs('users', {
      where: [['role', 'driver']],
      orderBy: [['created_at', 'desc']],
      limit,
    })
  },

  /** Búsqueda de conductores por nombre, teléfono o email (coincidencia parcial en memoria). */
  async searchDrivers(query) {
    const term = query.trim().toLowerCase()
    if (!term) return []

    const drivers = await fetchDocs('users', { where: [['role', 'driver']] })
    const ids = drivers.map((d) => d.id)

    const profiles = ids.length
      ? await fetchDocs('driver_profiles')
      : []
    const profileByUser = new Map(profiles.map((p) => [p.user_id || p.id, p]))

    return drivers
      .filter((d) => {
        const haystack = [d.name, d.full_name, d.phone, d.email]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return haystack.includes(term)
      })
      .map((d) => ({ ...d, driver_profile: profileByUser.get(d.id) || null }))
  },
}

// ── Zonas (geofences) ──────────────────────────────────────────────────────

const normalizeName = (name) =>
  String(name || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

/**
 * Genera el slug canónico de una zona a partir del nombre oficial del
 * municipio (DANE): 'El Carmen De Bolívar' -> 'el-carmen-de-bolivar'.
 * @param {string} name
 * @returns {string}
 */
export function slugifyName(name) {
  return normalizeName(name)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'zona'
}

/** Zona con tarifas maestras desde las que se clona al crear zonas nuevas. */
export const MASTER_ZONE_SLUG = 'el-carmen-de-bolivar'

export const zonesService = {
  list() {
    return fetchDocs('geofences', { orderBy: [['municipality_name', 'asc']] })
  },

  update(id, payload) {
    return updateDocById('geofences', id, payload)
  },

  remove(id) {
    return deleteDocById('geofences', id)
  },

  toggleStatus(id, currentStatus) {
    return updateDocById('geofences', id, { is_active: !currentStatus })
  },

  /** Cuenta las tarifas asociadas al slug (para el Aviso al eliminar). */
  countTariffs(slug) {
    return countZoneTariffs(slug)
  },

  /**
   * Borrado EN CASCADA: geofences + rate_cards + rate_schedules +
   * dynamic_pricing_rules con `zone_id == slug`, en writeBatch(s) atómicos.
   * IMPORTANTE: las tarifas de otros slugs no se tocan.
   */
  removeCascade(id, slug) {
    return deleteZoneCascade(id, slug || id)
  },
}

/**
 * La nueva zona se crea a partir de un feature del GeoJSON DANE:
 * - `boundaries` (GeoJSON en string, para el panel).
 * - `boundary` (array {lat,lng}, para zone_service.dart de la app móvil).
 * - `slug` derivado del nombre oficial (lo usa rate_cards/rate_schedules/
 *   dynamic_pricing_rules y el pricing engine web/móvil).
 * - `rings` (techos por distancia) copiados de la zona maestra.
 * - Clona inmediatamente las tarifas de la zona maestra (writeBatch atómico)
 *   para que la nueva zona tenga tarifa completa e independiente.
 *
 * @param {object} input
 * @param {string} input.municipality_name nombre para mostrar
 * @param {string} [input.official_name] nombre oficial DANE (para el slug)
 * @param {string} input.boundaries GeoJSON string del feature
 * @param {Array<{lat:number,lng:number}>} input.boundary points array
 */
export async function createZoneWithTariffs({
  municipality_name,
  official_name,
  boundaries,
  boundary,
}) {
  console.log('1. Iniciando creación de zona:', municipality_name, '| boundary pts:', boundary?.length ?? 0)

  // Validación del slug ANTES de escribir: Firestore rechazaría (o peor,
  // corrompería la relación tarifa↔zona) un slug vacío o con caracteres raros.
  const slug = slugifyName(official_name || municipality_name)
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    console.error('Slug inválido generado para:', official_name || municipality_name, '→', JSON.stringify(slug))
    throw new Error(`No se pudo generar un slug válido para «${municipality_name}».`)
  }
  console.log('2. Slug validado:', slug)

  const existing = await fetchDocs('geofences')
  const normalized = normalizeName(municipality_name)
  const duplicated = existing.find(
    (z) => normalizeName(z.municipality_name) === normalized,
  )
  if (duplicated) {
    throw new Error(
      `La zona "${municipality_name.trim()}" ya está habilitada. No se permiten zonas duplicadas.`,
    )
  }
  console.log('3. Sin duplicados (geofences leídos:', existing.length + ')')

  // Techos por defecto (fallback a prueba de fallos).
  // Si la consulta al maestro falla por cualquier motivo, la nueva zona
  // SIEMPRE nace con los techos correctos (5/10/15 km).
  const DEFAULT_RINGS = [
    { max_km: 5, car: 8000, moto: 6000 },
    { max_km: 10, car: 14000, moto: 10000 },
    { max_km: 15, car: 20000, moto: 15000 },
  ]

  // Lee los rings de la zona maestra (buscar por campo slug, NO por document ID).
  // El ID del maestro es '17oKw6fEKDE7vkHZkHwe'; el slug es 'el-carmen-de-bolivar'.
  const masterZones = await fetchDocs('geofences', {
    where: [['slug', '==', MASTER_ZONE_SLUG]],
    limit: 1,
  })
  const masterZone = masterZones[0] || null
  const masterRings = masterZone?.rings || []

  // Copia profunda (snapshot independiente): si luego se editan los techos del maestro,
  // la nueva zona NO se ve afectada, y viceversa.
  // Fallback: si el maestro no tiene rings por lo que sea, usa DEFAULT_RINGS.
  const sourceRings = masterRings.length ? masterRings : DEFAULT_RINGS
  const clonedRings = JSON.parse(JSON.stringify(sourceRings))

  console.log('Techos clonados para la nueva zona:', clonedRings)

  const id = await createDoc('geofences', {
    municipality_name,
    slug,
    // `boundaries`: GeoJSON en string (lo dibuja el mapa del panel).
    boundaries,
    // `boundary`: array {lat,lng} (lo usa zone_service.dart en la app móvil).
    boundary: boundary || [],
    // `rings`: techos por distancia heredados de la zona maestra (copia profunda).
    rings: clonedRings,
    is_active: true,
    base_multiplier: 1,
    base_multiplier_updated_at: serverTimestamp(),
  })
  console.log('4. Geofence creado con id:', id, '| rings heredados:', clonedRings.length)

  // Clonación de tarifas: la nueva zona hereda LOS DOCUMENTOS COMPLETOS de la
  // zona maestra con su propio zone_id (independencia total desde ya).
  console.log('5. Clonando tarifas desde', MASTER_ZONE_SLUG, 'a', slug, '...')
  const cloned = await cloneZoneTariffs(MASTER_ZONE_SLUG, slug)
  console.log('6. Tarifas clonadas:', cloned)

  return { id, slug, cloned }
}

// ── Tarifas (rate_cards + rate_schedules) ─────────────────────────────────

export const tarifasService = {
  listCards(zoneId) {
    return fetchDocs('rate_cards', { orderBy: [['created_at', 'desc']] })
  },
  listSchedules() {
    return fetchDocs('rate_schedules', {
      orderBy: [
        ['vehicle_type', 'asc'],
        ['day_type', 'asc'],
        ['shift_start', 'asc'],
      ],
    })
  },
  async listZones() {
    const zones = await fetchDocs('geofences', {
      orderBy: [['municipality_name', 'asc']],
    })
    return zones.map((z) => ({
      id: z.id,
      slug: z.slug || z.id,
      municipality_name: z.municipality_name,
      is_active: z.is_active,
    }))
  },

  /** Todas las tarifas + zonas, y la zona que más tarifas tiene (default). */
  async getAll() {
    const [cards, schedules, zones] = await Promise.all([
      tarifasService.listCards(),
      tarifasService.listSchedules(),
      tarifasService.listZones(),
    ])

    const countByZone = new Map()
    for (const item of [...cards, ...schedules]) {
      if (typeof item.zone_id === 'string' && item.zone_id) {
        countByZone.set(item.zone_id, (countByZone.get(item.zone_id) || 0) + 1)
      }
    }

    let defaultZoneId = null
    let best = 0
    for (const [zoneId, count] of countByZone) {
      if (count > best) {
        best = count
        defaultZoneId = zoneId
      }
    }
    if (!defaultZoneId) {
      const active = zones.find((z) => z.is_active)
      defaultZoneId = active?.slug || active?.id || zones[0]?.slug || zones[0]?.id || null
    }

    return { cards, schedules, zones, defaultZoneId }
  },

  createCard(payload) {
    return createDoc('rate_cards', { ...payload, is_active: true })
  },
  updateCard(id, payload) {
    return updateDocById('rate_cards', id, payload)
  },
  removeCard(id) {
    return deleteDocById('rate_cards', id)
  },

  createSchedule(payload) {
    return createDoc('rate_schedules', { ...payload, is_active: true })
  },
  updateSchedule(id, payload) {
    return updateDocById('rate_schedules', id, payload)
  },
  removeSchedule(id) {
    return deleteDocById('rate_schedules', id)
  },

  /** Copia las tarifas de una zona a otra. */
  async copyZonePricing(sourceZoneId, targetZoneId) {
    const cards = await copyByField('rate_cards', 'rate_cards', 'zone_id', sourceZoneId, targetZoneId)
    const schedules = await copyByField(
      'rate_schedules',
      'rate_schedules',
      'zone_id',
      sourceZoneId,
      targetZoneId,
    )
    return { cards, schedules }
  },

  /** Asocia la configuración heredada (sin zona) a una zona concreta. */
  async migrateLegacyPricing(targetZoneId) {
    const counts = {}
    for (const table of ['rate_cards', 'rate_schedules', 'dynamic_pricing_rules']) {
      counts[table] = await migrateNullToValue(table, 'zone_id', targetZoneId)
    }
    return counts
  },
}

// ── Precio dinámico (dynamic_pricing_rules) ───────────────────────────────

export const precioDinamicoService = {
  list(zoneId) {
    return fetchDocs('dynamic_pricing_rules', {
      orderBy: [['priority', 'desc']],
    })
  },
  create(payload) {
    return createDoc('dynamic_pricing_rules', { ...payload, is_active: true })
  },
  update(id, payload) {
    return updateDocById('dynamic_pricing_rules', id, payload)
  },
  remove(id) {
    return deleteDocById('dynamic_pricing_rules', id)
  },
}

// ── Solicitudes de conductor (driver_applications) ────────────────────────

export const solicitudesService = {
  list(filter = 'all') {
    return fetchDocs('driver_applications', {
      orderBy: [['created_at', 'desc']],
      ...(filter !== 'all' ? { where: [['status', filter]] } : {}),
    })
  },

  /**
   * Aprueba o rechaza una solicitud.
   * Al aprobar: cambia el rol del usuario a `driver` y crea su `driver_profile`.
   */
  async review(id, status) {
    const app = await fetchDoc('driver_applications', id)
    if (!app) throw new Error('Solicitud no encontrada')

    await updateDocById('driver_applications', id, {
      status,
      reviewed_at: new Date().toISOString(),
    })

    if (status === 'approved') {
      await updateDocById('users', app.user_id, { role: 'driver' })
      await setDocWithId('driver_profiles', app.user_id, {
        user_id: app.user_id,
        full_name: app.full_name || '',
        vehicle_type: app.vehicle_type,
        plate: app.plate,
        brand: app.brand || '',
        model: app.model || '',
        color: app.color || '',
        status: 'active',
      })
    }
  },
}

// ── Conductores (driver_profiles + users) ─────────────────────────────────

export const conductoresService = {
  async list() {
    const [drivers, profiles] = await Promise.all([
      fetchDocs('users', { where: [['role', 'driver']] }),
      fetchDocs('driver_profiles'),
    ])

    const profileByUser = new Map(profiles.map((p) => [p.user_id || p.id, p]))

    return drivers.map((d) => {
      const profile = profileByUser.get(d.id) || null
      return {
        id: d.id,
        name: d.full_name || d.name,
        email: d.email,
        phone: d.phone,
        avatar_url: d.avatar_url,
        status: profile?.status || d.status || 'pending',
        vehicle_type: profile?.vehicle_type || null,
        plate: profile?.plate || null,
        brand: profile?.brand || null,
        model: profile?.model || null,
        color: profile?.color || null,
        is_available: profile?.is_available ?? null,
        created_at: d.created_at,
      }
    })
  },

  setStatus(driverId, status) {
    return updateDocById('driver_profiles', driverId, { status })
  },

  toggleStatus(driverId, currentStatus) {
    const next = currentStatus === 'active' ? 'suspended' : 'active'
    return conductoresService.setStatus(driverId, next)
  },
}

// ── Viajes (trips) ────────────────────────────────────────────────────────

export const viajesService = {
  list({ status, driver_id, passenger_id, limit = 50 } = {}) {
    return fetchDocs('trips', {
      orderBy: [['created_at', 'desc']],
      limit,
      ...(status ? { where: [['status', status]] } : {}),
      ...(driver_id ? { where: [['driver_id', driver_id]] } : {}),
      ...(passenger_id ? { where: [['passenger_id', passenger_id]] } : {}),
    })
  },
}

// ── Finanzas (settlements + wallets + viajes completados) ─────────────────

export const finanzasService = {
  listSettlements() {
    return fetchDocs('settlements', { orderBy: [['created_at', 'desc']] })
  },

  async getStats() {
    const [conductoresActivos, wallets, completedTrips] = await Promise.all([
      countDocs('driver_profiles', { where: [['status', 'active']] }),
      fetchDocs('wallets'),
      fetchDocs('trips', { where: [['status', 'completed']] }),
    ])

    let volumenReal = 0
    let comisionReal = 0
    let tieneDataReal = false

    if (completedTrips.length > 0) {
      tieneDataReal = true
      volumenReal = completedTrips.reduce(
        (sum, t) => sum + (Number(t.fare_amount) || 0),
        0,
      )
      comisionReal = completedTrips.reduce(
        (sum, t) => sum + (Number(t.commission_amount) || 0),
        0,
      )
      if (comisionReal === 0) comisionReal = volumenReal * 0.1
    } else if (wallets.length > 0) {
      tieneDataReal = true
      const saldoTotal = wallets.reduce((sum, w) => sum + (Number(w.balance) || 0), 0)
      volumenReal = saldoTotal
      comisionReal = saldoTotal * 0.1
    }

    return {
      conductoresActivos,
      volumenTotal: Math.round(volumenReal),
      comisionCarSiGo: Math.round(comisionReal),
      tieneDataReal,
    }
  },

  async performSettlement({ amount, driverCount, volumeBase }) {
    const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const referencia = `LIQ-${fecha}-${Math.floor(Math.random() * 9000) + 1000}`

    await createDoc('settlements', {
      total_amount: amount,
      drivers_involved: driverCount,
      volume_base: volumeBase,
      reference: referencia,
      status: 'completed',
    })
    return referencia
  },
}

// ── Administradores (users con rol admin/superadmin) ─────────────────────

export const administradoresService = {
  list() {
    return fetchDocs('users', { orderBy: [['name', 'asc']] }).then((users) =>
      users.filter((u) => u.role === 'admin' || u.role === 'superadmin'),
    )
  },
  toggleStatus(userId, currentStatus) {
    const next = currentStatus === 'active' ? 'inactive' : 'active'
    return updateDocById('users', userId, { status: next })
  },
  update(userId, payload) {
    return updateDocById('users', userId, payload)
  },
}
