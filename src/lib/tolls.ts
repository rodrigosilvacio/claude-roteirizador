/**
 * Praças de pedágio ao longo da rota, a partir do OpenStreetMap (Overpass).
 *
 * No Brasil quem mapeia costuma marcar a praça (barrier=toll_booth) e não a
 * rodovia inteira como pedagiada, então contar praças é bem mais confiável
 * que somar km em vias com toll=yes.
 */

export interface TollPlaza {
  /** Id estável no OSM, usado para lembrar o valor que a pessoa informou */
  key: string
  name: string
  lat: number
  lon: number
  /** Índice do trecho onde a praça fica */
  leg: number
  /** Metros desde o início do trecho, para ordenar as praças no caminho */
  along: number
}

export interface OverpassElement {
  type: 'node' | 'way' | 'relation'
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

type LatLon = [number, number]
type Box = [number, number, number, number] // sul, oeste, norte, leste

const OVERPASS = [
  (import.meta.env.VITE_OVERPASS_URL as string | undefined) ?? 'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]

/** Distância máxima da praça até a linha da rota. Pequena de propósito: a cabine da pista contrária fica de fora */
export const MAX_NODE_DISTANCE = 20
/** Praças mapeadas como linha atravessando a pista têm o centro um pouco afastado */
export const MAX_WAY_DISTANCE = 40
/** Cabines a menos disso ao longo da rota são a mesma praça (uma por faixa) */
export const MERGE_DISTANCE = 400

const M_PER_DEG_LAT = 110_540
const mPerDegLon = (lat: number) => 111_320 * Math.cos((lat * Math.PI) / 180)

function meters(a: LatLon, b: LatLon): number {
  const dy = (b[0] - a[0]) * M_PER_DEG_LAT
  const dx = (b[1] - a[1]) * mPerDegLon((a[0] + b[0]) / 2)
  return Math.hypot(dx, dy)
}

/** Divide a rota em caixas de ~15 km para a consulta ficar pequena mesmo em rotas longas */
export function routeBoxes(legs: LatLon[][], chunkMeters = 15_000, padMeters = 60): Box[] {
  const boxes: Box[] = []
  for (const geometry of legs) {
    if (!geometry.length) continue
    let box: Box = [geometry[0][0], geometry[0][1], geometry[0][0], geometry[0][1]]
    let acc = 0
    for (let i = 1; i < geometry.length; i++) {
      const [lat, lon] = geometry[i]
      box = [Math.min(box[0], lat), Math.min(box[1], lon), Math.max(box[2], lat), Math.max(box[3], lon)]
      acc += meters(geometry[i - 1], geometry[i])
      if (acc >= chunkMeters && i < geometry.length - 1) {
        boxes.push(box)
        box = [lat, lon, lat, lon]
        acc = 0
      }
    }
    boxes.push(box)
  }
  return boxes.map(([s, w, n, e]) => {
    const dLat = padMeters / M_PER_DEG_LAT
    const dLon = padMeters / mPerDegLon((s + n) / 2)
    return [s - dLat, w - dLon, n + dLat, e + dLon]
  })
}

export function overpassQuery(boxes: Box[]): string {
  const f = (v: number) => v.toFixed(5)
  const parts = boxes.map(([s, w, n, e]) => `nwr["barrier"="toll_booth"](${f(s)},${f(w)},${f(n)},${f(e)});`)
  return `[out:json][timeout:25];(${parts.join('')});out center tags qt;`
}

/** Distância do ponto até a linha do trecho e posição (em metros) ao longo dele */
export function nearestOnLeg(p: LatLon, geometry: LatLon[]): { dist: number; along: number } {
  const kx = mPerDegLon(p[0])
  let best = { dist: Infinity, along: 0 }
  let acc = 0
  for (let i = 0; i < geometry.length - 1; i++) {
    // coordenadas em metros com origem no próprio ponto
    const ax = (geometry[i][1] - p[1]) * kx
    const ay = (geometry[i][0] - p[0]) * M_PER_DEG_LAT
    const bx = (geometry[i + 1][1] - p[1]) * kx
    const by = (geometry[i + 1][0] - p[0]) * M_PER_DEG_LAT
    const vx = bx - ax
    const vy = by - ay
    const len2 = vx * vx + vy * vy
    const t = len2 ? Math.max(0, Math.min(1, -(ax * vx + ay * vy) / len2)) : 0
    const dist = Math.hypot(ax + t * vx, ay + t * vy)
    const segLen = Math.sqrt(len2)
    if (dist < best.dist) best = { dist, along: acc + t * segLen }
    acc += segLen
  }
  return best
}

const GENERIC_NAME = 'Praça de pedágio'

/** Nome da cabine e quão informativo ele é: 2 nome próprio, 1 só a concessionária, 0 genérico */
function plazaName(tags: Record<string, string> = {}): { name: string; score: number } {
  const name = tags.name?.trim()
  if (name && !/^(pra[cç]a de )?ped[aá]gio$/i.test(name)) return { name, score: 2 }
  if (tags.operator) return { name: `Pedágio ${tags.operator}`, score: 1 }
  return { name: GENERIC_NAME, score: 0 }
}

export function plazasFromElements(elements: OverpassElement[], legs: LatLon[][]): TollPlaza[] {
  const candidates: (TollPlaza & { id: string; score: number })[] = []
  for (const el of elements) {
    const lat = el.lat ?? el.center?.lat
    const lon = el.lon ?? el.center?.lon
    if (lat === undefined || lon === undefined) continue
    const limit = el.type === 'node' ? MAX_NODE_DISTANCE : MAX_WAY_DISTANCE
    let bestLeg = -1
    let best = { dist: Infinity, along: 0 }
    legs.forEach((g, i) => {
      const r = nearestOnLeg([lat, lon], g)
      if (r.dist < best.dist) {
        best = r
        bestLeg = i
      }
    })
    if (bestLeg < 0 || best.dist > limit) continue
    const id = `${el.type}/${el.id}`
    candidates.push({ id, key: id, ...plazaName(el.tags), lat, lon, leg: bestLeg, along: best.along })
  }

  candidates.sort((a, b) => a.leg - b.leg || a.along - b.along)
  const plazas: TollPlaza[] = []
  let group: typeof candidates = []
  const flush = () => {
    if (!group.length) return
    // representante estável: menor id do grupo; nome: o mais informativo
    const rep = [...group].sort((a, b) => a.id.localeCompare(b.id))[0]
    const named = group.reduce((a, b) => (b.score > a.score ? b : a))
    plazas.push({ key: rep.key, name: named.name, lat: group[0].lat, lon: group[0].lon, leg: group[0].leg, along: group[0].along })
    group = []
  }
  for (const c of candidates) {
    const last = group[group.length - 1]
    if (last && (last.leg !== c.leg || c.along - last.along > MERGE_DISTANCE)) flush()
    group.push(c)
  }
  flush()
  return plazas
}

export async function fetchPlazas(legs: LatLon[][], signal?: AbortSignal): Promise<TollPlaza[]> {
  const boxes = routeBoxes(legs)
  if (!boxes.length) return []
  const body = new URLSearchParams({ data: overpassQuery(boxes) })
  let lastError: unknown
  for (const url of OVERPASS) {
    try {
      const res = await fetch(url, { method: 'POST', body, signal })
      if (!res.ok) throw new Error(`Overpass respondeu ${res.status}`)
      const data = (await res.json()) as { elements: OverpassElement[] }
      return plazasFromElements(data.elements ?? [], legs)
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e
      lastError = e
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Consulta de praças indisponível')
}
