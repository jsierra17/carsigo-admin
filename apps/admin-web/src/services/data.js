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

export const zonesService = {
  list() {
    return fetchDocs('geofences', { orderBy: [['municipality_name', 'asc']] })
  },

  async create({ municipality_name, boundaries, boundary, is_active, base_multiplier }) {
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

    const id = await createDoc('geofences', {
      municipality_name,
      // `boundaries`: GeoJSON en string (lo dibuja el mapa del panel).
      boundaries,
      // `boundary`: array {lat,lng} (lo usa zone_service.dart en la app móvil).
      boundary: boundary || [],
      is_active,
      base_multiplier,
      base_multiplier_updated_at: serverTimestamp(),
    })
    return id
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
      municipality_name: z.municipality_name,
      is_active: z.is_active,
      slug: z.slug,
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
      defaultZoneId = active?.id ?? zones[0]?.id ?? null
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
