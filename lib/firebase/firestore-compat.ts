/* eslint-disable @typescript-eslint/no-explicit-any */
// Capa de compatibilidad: reimplementa el subconjunto de la API de db
// (auth.* y from(...).select/insert/update/delete/upsert) sobre Firebase
// (Firestore + Auth), para que las pages/actions del panel no cambien.
//
// Los datos son volúmenes pequeños (<200 docs por colección), así que las
// consultas se resuelven trayendo la colección y filtrando/ordenando en
// memoria. Esto evita dependencias de índices compuestos de Firestore.

export type CompatError = { message: string } | null

export type CompatResult<T = any> = { data: T | null; error: CompatError; count?: number }

export interface CompatDeps {
  db: any
  Timestamp: any
  GeoPoint: any
  fs: {
    collection: (db: any, path: string) => any
    doc: (db: any, path: string, ...ids: string[]) => any
    getDocs: (ref: any) => Promise<{ docs: { id: string; data(): any }[] }>
    getDoc: (ref: any) => Promise<{ exists(): boolean; id: string; data(): any }>
    setDoc: (ref: any, data: any) => Promise<void>
    updateDoc: (ref: any, data: any) => Promise<void>
    deleteDoc: (ref: any) => Promise<void>
    addDoc: (ref: any, data: any) => Promise<{ id: string }>
  }
  auth: any
  server?: boolean
  channelFactory?: (name: string) => any
}

type Row = Record<string, any>

const DATE_FIELDS = new Set([
  'created_at',
  'updated_at',
  'reviewed_at',
  'accepted_at',
  'started_at',
  'completed_at',
  'suspended_at',
])

const SRID_RE = /^SRID=4326;POINT\(\s*([-\d.eE]+)\s+([-\d.eE]+)\s*\)$/i

// ─── Serialización ───────────────────────────────────────────────────────────

function isTimestampLike(v: any): boolean {
  return !!v && typeof v === 'object' && typeof v.toDate === 'function' && typeof v.toMillis === 'function'
}

function isGeoPointLike(v: any): boolean {
  return (
    !!v &&
    typeof v === 'object' &&
    typeof v.latitude === 'number' &&
    typeof v.longitude === 'number'
  )
}

function serializeValue(v: any): any {
  if (isTimestampLike(v)) return v.toDate().toISOString()
  if (isGeoPointLike(v)) return { lat: v.latitude, lng: v.longitude }
  if (Array.isArray(v)) return v.map(serializeValue)
  if (v && typeof v === 'object') {
    const out: Row = {}
    for (const k of Object.keys(v)) out[k] = serializeValue(v[k])
    return out
  }
  return v
}

function serializeRow(doc: any, docId?: string, table?: string): Row {
  // Acepta una snapshot de Firestore o un objeto de datos crudo: si tiene
  // .data() como método, extrae los datos; si no, usa el objeto tal cual.
  const hasDataFn = doc && typeof doc === 'object' && typeof doc.data === 'function'
  const base = serializeValue(hasDataFn ? doc.data() : doc) || {}
  if (docId) base.id = docId
  // Firestore no admite arrays anidados: los GeoJSON se guardan como string y
  // aquí se rehidratan a objeto para las páginas (mapas, zona seleccionada).
  if (table === 'geofences' && typeof base.boundaries === 'string' && base.boundaries.startsWith('{')) {
    try {
      base.boundaries = JSON.parse(base.boundaries)
    } catch {
      // Dejar el string tal cual si no es GeoJSON válido
    }
  }
  return base
}

function prepareInput(deps: CompatDeps, table: string, payload: Row, addCreatedAt = true): Row {
  const out: Row = {}
  for (const [k, v] of Object.entries(payload)) {
    if (v === undefined) continue
    if (DATE_FIELDS.has(k) && (typeof v === 'string' || v instanceof Date)) {
      out[k] = deps.Timestamp.fromDate(v instanceof Date ? v : new Date(v))
      continue
    }
    if (typeof v === 'string' && SRID_RE.test(v)) {
      const m = SRID_RE.exec(v)!
      out[k] = new deps.GeoPoint(parseFloat(m[2]), parseFloat(m[1]))
      continue
    }
    out[k] = v
  }
  if (addCreatedAt && !('created_at' in out)) out.created_at = deps.Timestamp.now()
  if (table === 'geofences' && out.boundaries) {
    out.boundary = geoJsonToBoundary(out.boundaries)
    if (typeof out.boundaries !== 'string') {
      // Firestore rechaza arrays anidados; guardamos el GeoJSON como string.
      out.boundaries = JSON.stringify(out.boundaries)
    }
  }
  return out
}

// ─── Geo ─────────────────────────────────────────────────────────────────────

function ringArea(ring: any[]): number {
  let area = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    area += (xj - xi) * (yj + yi)
  }
  return Math.abs(area) / 2
}

export function geoJsonToBoundary(geometry: any): { lat: number; lng: number }[] {
  if (typeof geometry === 'string') {
    try {
      geometry = JSON.parse(geometry)
    } catch {
      return []
    }
  }
  if (!geometry) return []
  const polygons =
    geometry.type === 'Polygon'
      ? [geometry.coordinates]
      : geometry.type === 'MultiPolygon'
        ? geometry.coordinates
        : []
  let best: any[] = []
  let bestArea = -1
  for (const rings of polygons) {
    const ring = rings?.[0]
    if (!ring) continue
    const area = ringArea(ring)
    if (area > bestArea) {
      bestArea = area
      best = ring
    }
  }
  return best.map(([lng, lat]) => ({ lat, lng }))
}

function pointInPolygon(lat: number, lng: number, boundary: { lat: number; lng: number }[]): boolean {
  let inside = false
  for (let i = 0, j = boundary.length - 1; i < boundary.length; j = i++) {
    const xi = boundary[i].lng
    const yi = boundary[i].lat
    const xj = boundary[j].lng
    const yj = boundary[j].lat
    const intersect =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

function rowContainsPoint(row: Row, value: string): boolean {
  const m = value.match(/^POINT\(\s*([-\d.eE]+)\s+([-\d.eE]+)\s*\)$/i)
  if (!m) return false
  const lng = parseFloat(m[1])
  const lat = parseFloat(m[2])

  const rings: { lat: number; lng: number }[][] = []
  if (row.boundaries) {
    let geom = row.boundaries
    if (typeof geom === 'string') {
      try {
        geom = JSON.parse(geom)
      } catch {
        geom = null
      }
    }
    if (geom) {
      const polygons =
        geom.type === 'Polygon'
          ? [geom.coordinates]
          : geom.type === 'MultiPolygon'
            ? geom.coordinates
            : []
      for (const polys of polygons) {
        for (const ring of polys || []) {
          if (Array.isArray(ring) && ring.length >= 3) {
            rings.push(ring.map(([ln, la]: [number, number]) => ({ lat: la, lng: ln })))
          }
        }
      }
    }
  }
  if (rings.length === 0 && Array.isArray(row.boundary)) {
    rings.push(row.boundary)
  }
  return rings.some((ring) => pointInPolygon(lat, lng, ring))
}

// ─── Select parser ───────────────────────────────────────────────────────────

function splitTop(s: string): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of s) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) {
      out.push(cur)
      cur = ''
      continue
    }
    cur += ch
  }
  if (cur.trim()) out.push(cur)
  return out
}

interface EmbedSpec {
  alias?: string
  table: string
  inner: boolean
  fkCol?: string
  cols: string[]
}

interface SelectSpec {
  star: boolean
  scalars: string[]
  embeds: EmbedSpec[]
}

function parseSelect(raw: string | null | undefined): SelectSpec {
  if (!raw || raw.trim() === '' || raw.trim() === '*') return { star: true, scalars: [], embeds: [] }
  const scalars: string[] = []
  const embeds: EmbedSpec[] = []
  for (const tokenRaw of splitTop(raw)) {
    const token = tokenRaw.trim()
    if (!token) continue
    if (!token.includes('(')) {
      scalars.push(token)
      continue
    }
    const open = token.indexOf('(')
    const head = token.slice(0, open).trim()
    const cols = token
      .slice(open + 1, -1)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const colon = head.indexOf(':')
    const alias = colon >= 0 ? head.slice(0, colon).trim() || undefined : undefined
    let table = (colon >= 0 ? head.slice(colon + 1) : head).trim()
    let inner = false
    let fkCol: string | undefined
    if (table.includes('!')) {
      const [t, ...flags] = table.split('!')
      table = t.trim()
      for (const f of flags) {
        if (f === 'inner') inner = true
        else if (f.endsWith('_fkey')) {
          const m = f.match(/^[^_]+_(\w+)_fkey$/) || f.match(/^(\w+)_fkey$/)
          fkCol = m?.[1]
        }
      }
    }
    embeds.push({ alias, table, inner, fkCol, cols })
  }
  return { star: scalars.length === 0 && embeds.length === 0, scalars, embeds }
}

function projectCols(row: Row, cols: string[]): Row {
  const out: Row = { id: row.id }
  for (const c of cols) if (c in row) out[c] = row[c]
  return out
}

function projectRow(row: Row, spec: SelectSpec): Row {  if (spec.star) return row
  const out: Row = { id: row.id }
  for (const s of spec.scalars) {
    if (s in row) out[s] = row[s]
  }
  for (const e of spec.embeds) {
    const key = e.alias || e.table
    if (key in row) out[key] = row[key]
  }
  return out
}

// ─── Or (`or` filters) ───────────────────────────────────────────────────────

function matchOrSegment(row: Row, segment: string): boolean {
  const m = segment.match(/^([A-Za-z_]\w*)\.(eq|neq|ilike|is|gte|lte)\.(.+)$/)
  if (!m) return true
  const [, col, op, rawVal] = m
  const val = row[col]
  if (op === 'is') {
    if (rawVal === 'null') return val === null || val === undefined
    return String(val) === rawVal
  }
  if (op === 'ilike') {
    return typeof val === 'string' && val.toLowerCase().includes(String(rawVal).replace(/%/g, '').toLowerCase())
  }
  const num = Number(rawVal)
  const target = Number.isNaN(num) ? rawVal : num
  if (op === 'eq') return val === target
  if (op === 'neq') return val !== target
  if (op === 'gte') return val >= target
  if (op === 'lte') return val <= target
  return true
}

function matchFilter(row: Row, f: Filter): boolean {
  switch (f.kind) {
    case 'eq':
      return row[f.col!] === f.value
    case 'neq':
      return row[f.col!] !== f.value
    case 'in':
      return Array.isArray(f.value) && f.value.includes(row[f.col!])
    case 'gte':
      return row[f.col!] >= f.value
    case 'lte':
      return row[f.col!] <= f.value
    case 'ilike': {
      const v = row[f.col!]
      return (
        typeof v === 'string' &&
        v.toLowerCase().includes(String(f.value).replace(/%/g, '').toLowerCase())
      )
    }
    case 'or':
      return String(f.value)
        .split(',')
        .some((seg) => matchOrSegment(row, seg.trim()))
    case 'contains':
      return rowContainsPoint(row, String(f.value))
    default:
      return true
  }
}

type Filter = {
  kind: 'eq' | 'neq' | 'in' | 'gte' | 'lte' | 'ilike' | 'or' | 'contains'
  col?: string
  value?: any
}

// ─── Query builder ───────────────────────────────────────────────────────────

type Mode = 'select' | 'insert' | 'update' | 'delete' | 'upsert'

class QueryBuilder {
  private mode: Mode = 'select'
  private selectRaw: string | null = null
  private filters: Filter[] = []
  private orders: { col: string; ascending: boolean }[] = []
  private limitVal: number | null = null
  private countOpt = false
  private head = false
  private singleOpt: 'single' | 'maybeSingle' | null = null
  private payload: any = null
  private cache: Record<string, { id: string; data: Row }[]> = {}

  constructor(private deps: CompatDeps, private table: string) {}

  select(cols?: string, opts?: { count?: 'exact'; head?: boolean }) {
    this.selectRaw = cols ?? '*'
    if (opts?.head) this.head = true
    if (opts?.count) this.countOpt = true
    return this
  }

  eq(col: string, value: any) {
    this.filters.push({ kind: 'eq', col, value })
    return this
  }
  neq(col: string, value: any) {
    this.filters.push({ kind: 'neq', col, value })
    return this
  }
  in(col: string, values: any[]) {
    this.filters.push({ kind: 'in', col, value: values })
    return this
  }
  gte(col: string, value: any) {
    this.filters.push({ kind: 'gte', col, value })
    return this
  }
  lte(col: string, value: any) {
    this.filters.push({ kind: 'lte', col, value })
    return this
  }
  ilike(col: string, pattern: string) {
    this.filters.push({ kind: 'ilike', col, value: pattern })
    return this
  }
  or(filter: string) {
    this.filters.push({ kind: 'or', value: filter })
    return this
  }
  filter(col: string, op: string, value: any) {
    if (op === 'st_contains') this.filters.push({ kind: 'contains', col, value })
    return this
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orders.push({ col, ascending: opts?.ascending ?? true })
    return this
  }
  limit(n: number) {
    this.limitVal = n
    return this
  }
  single() {
    this.singleOpt = 'single'
    return this
  }
  maybeSingle() {
    this.singleOpt = 'maybeSingle'
    return this
  }
  insert(rows: any) {
    this.mode = 'insert'
    this.payload = rows
    return this
  }
  update(payload: Record<string, any>) {
    this.mode = 'update'
    this.payload = payload
    return this
  }
  upsert(payload: Record<string, any>) {
    this.mode = 'upsert'
    this.payload = payload
    return this
  }
  delete() {
    this.mode = 'delete'
    return this
  }

  then<TResult1 = CompatResult, TResult2 = never>(
    onfulfilled?: ((value: CompatResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected)
  }

  private async loadAll(table: string): Promise<{ id: string; data: Row }[]> {
    if (this.cache[table]) return this.cache[table]
    const snap = await this.deps.fs.getDocs(this.deps.fs.collection(this.deps.db, table))
    const rows = snap.docs.map((d) => ({ id: d.id, data: d.data() as Row }))
    this.cache[table] = rows
    return rows
  }

  private async execute(): Promise<CompatResult> {
    try {
      switch (this.mode) {
        case 'select':
          return await this.execSelect()
        case 'insert':
          return await this.execInsert()
        case 'update':
          return await this.execUpdate()
        case 'delete':
          return await this.execDelete()
        case 'upsert':
          return await this.execInsert(true)
      }
    } catch (e: any) {
      console.error(`[compat:${this.mode}]`, this.table, e)
      return { data: null, error: { message: e?.message || String(e) } }
    }
  }

  private async execSelect(): Promise<CompatResult> {
    const all = await this.loadAll(this.table)
    const withId = (r: { id: string; data: Row }) => ({ ...r.data, id: r.id })
    let rows = all.filter((r) => this.filters.every((f) => matchFilter(withId(r), f)))

    const spec = parseSelect(this.selectRaw)
    if (spec.embeds.length > 0) {
      rows = await this.embed(rows, spec)
    }

    const projected = rows.map((r) => projectRow(serializeRow(r.data, r.id, this.table), spec))
    const ordered = this.applyOrders(projected)
    const sliced = this.limitVal ? ordered.slice(0, this.limitVal) : ordered
    const count = rows.length

    if (this.head) return { data: null, count, error: null }

    let data: any = sliced
    if (this.singleOpt === 'single') {
      if (sliced.length > 1) {
        return { data: null, error: { message: 'Se esperaba una sola fila pero se obtuvieron varias' } }
      }
      data = sliced[0]
      if (!data) return { data: null, error: { message: 'No se encontró la fila solicitada' } }
    } else if (this.singleOpt === 'maybeSingle') {
      data = sliced[0] ?? null
    }

    return { data, count: this.countOpt ? count : undefined, error: null }
  }

  private async execInsert(upsertMode = false): Promise<CompatResult> {
    const rows: Row[] = Array.isArray(this.payload) ? this.payload : [this.payload]
    const saved: Row[] = []
    for (const row of rows) {
      const clean = prepareInput(this.deps, this.table, row, !upsertMode)
      let id = typeof clean.id === 'string' ? clean.id : undefined
      delete clean.id

      let ref
      if (upsertMode) {
        id = typeof row.user_id === 'string' ? row.user_id : typeof row.id === 'string' ? row.id : id
      }
      if (id) {
        ref = this.deps.fs.doc(this.deps.db, this.table, id)
        await this.deps.fs.setDoc(ref, clean)
      } else {
        ref = await this.deps.fs.addDoc(this.deps.fs.collection(this.deps.db, this.table), clean)
        id = ref.id
        await this.deps.fs.updateDoc(ref, { id })
      }
      const snap = await this.deps.fs.getDoc(ref)
      saved.push(serializeRow(snap.data(), id, this.table))
    }
    if (this.singleOpt) return { data: saved[0] ?? null, error: null }
    return { data: rows.length === 1 ? saved[0] : saved, error: null }
  }

  private async execUpdate(): Promise<CompatResult> {
    const all = await this.loadAll(this.table)
    const withId = (r: { id: string; data: Row }) => ({ ...r.data, id: r.id })
    const matched = all.filter((r) => this.filters.every((f) => matchFilter(withId(r), f)))
    const clean = prepareInput(this.deps, this.table, this.payload, false)
    for (const r of matched) {
      await this.deps.fs.updateDoc(this.deps.fs.doc(this.deps.db, this.table, r.id), clean)
    }
    if (this.singleOpt) {
      const first = matched[0]
      if (!first) return { data: null, error: { message: 'No se encontró la fila solicitada' } }
      const snap = await this.deps.fs.getDoc(this.deps.fs.doc(this.deps.db, this.table, first.id))
      return { data: serializeRow(snap.data(), first.id, this.table), error: null }
    }
    return { data: matched.map((r) => ({ id: r.id })), error: null }
  }

  private async execDelete(): Promise<CompatResult> {
    const all = await this.loadAll(this.table)
    const withId = (r: { id: string; data: Row }) => ({ ...r.data, id: r.id })
    const matched = all.filter((r) => this.filters.every((f) => matchFilter(withId(r), f)))
    const ids: string[] = []
    for (const r of matched) {
      await this.deps.fs.deleteDoc(this.deps.fs.doc(this.deps.db, this.table, r.id))
      ids.push(r.id)
    }
    return { data: ids, error: null }
  }

  private applyOrders(rows: Row[]): Row[] {
    if (this.orders.length === 0) return rows
    return rows
      .slice()
      .sort((a, b) => {
        for (const o of this.orders) {
          const av = a[o.col]
          const bv = b[o.col]
          if (av === bv) continue
          if (av === undefined || av === null) return o.ascending ? -1 : 1
          if (bv === undefined || bv === null) return o.ascending ? 1 : -1
          const cmp =
            typeof av === 'number' && typeof bv === 'number'
              ? av - bv
              : String(av).localeCompare(String(bv))
          if (cmp !== 0) return o.ascending ? cmp : -cmp
        }
        return 0
      })
  }

  private async embed(rows: { id: string; data: Row }[], spec: SelectSpec) {
    for (const e of spec.embeds) {
      const related = await this.loadAll(e.table)
      if (e.table === 'users' && this.table !== 'users') {
        const key = e.alias || 'users'
        const col =
          e.fkCol || (this.table === 'trips' ? `${e.alias || 'user'}_id` : 'user_id')
        const byId = new Map(related.map((r) => [r.id, r]))
        for (const r of rows) {
          const rel = byId.get(r.data[col])
          if (rel) {
            const base = serializeRow(rel.data, rel.id, e.table)
            r.data[key] =
              e.cols.length > 0
                ? projectCols(base, e.cols)
                : base
          } else {
            r.data[key] = null
            if (e.inner) return rows.filter((x) => x !== r)
          }
        }
      } else if (e.table === 'driver_profiles' && this.table === 'users') {
        const key = e.alias || 'driver_profiles'
        const byUser = new Map<string, { id: string; data: Row }[]>()
        for (const r of related) {
          const uid = r.data.user_id
          if (!byUser.has(uid)) byUser.set(uid, [])
          byUser.get(uid)!.push(r)
        }
        for (const r of rows) {
          const rels = (byUser.get(r.id) || []).map((rel) =>
            projectCols(serializeRow(rel.data, rel.id, e.table), e.cols)
          )
          r.data[key] = rels
          if (e.inner && rels.length === 0) return rows.filter((x) => x !== r)
        }
      }
    }
    return rows
  }
}

// ─── Compat client ───────────────────────────────────────────────────────────

export function createCompatClient(deps: CompatDeps) {
  const client = {
    auth: deps.auth,
    from(table: string) {
      return new QueryBuilder(deps, table)
    },
    channel(name: string) {
      if (deps.channelFactory) return deps.channelFactory(name)
      return {
        on() {
          return this
        },
        subscribe(cb?: (status: string) => void) {
          cb?.('CHANNEL_ERROR')
          return this
        },
        unsubscribe() {},
      }
    },
    removeChannel(ch: any) {
      ch?.unsubscribe?.()
    },
  }
  return client
}