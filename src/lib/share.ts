import type { Place, RouteResult } from '../types'
import { formatDistance, formatDuration } from './format'

const ll = (p: Place) => `${p.lat.toFixed(6)},${p.lon.toFixed(6)}`

/** Google Maps aceita até 9 paradas intermediárias por link; rotas maiores viram várias partes */
export const GMAPS_MAX_WAYPOINTS = 9

export function googleMapsLinks(sequence: Place[]): string[] {
  const links: string[] = []
  const chunk = GMAPS_MAX_WAYPOINTS + 1
  for (let start = 0; start < sequence.length - 1; start += chunk) {
    const part = sequence.slice(start, start + chunk + 1)
    const params = new URLSearchParams({
      api: '1',
      origin: ll(part[0]),
      destination: ll(part[part.length - 1]),
      travelmode: 'driving',
    })
    const mids = part.slice(1, -1)
    if (mids.length) params.set('waypoints', mids.map(ll).join('|'))
    links.push(`https://www.google.com/maps/dir/?${params}`)
  }
  return links
}

/** Waze só navega para um ponto por vez */
export function wazeLink(p: Place): string {
  return `https://waze.com/ul?ll=${ll(p)}&navigate=yes`
}

export function whatsappText(result: RouteResult, costLine?: string): string {
  const lines = [
    `*Roteiro* · ${formatDistance(result.distance)} · ${formatDuration(result.duration)}`,
    ...(costLine ? [costLine] : []),
    '',
    ...result.sequence.map((p, i) => `${result.tags[i]}. ${p.label}`),
    '',
    ...googleMapsLinks(result.sequence).map((l, i, all) => `Google Maps${all.length > 1 ? ` (parte ${i + 1})` : ''}: ${l}`),
  ]
  return lines.join('\n')
}

export function whatsappLink(result: RouteResult, costLine?: string): string {
  return `https://wa.me/?text=${encodeURIComponent(whatsappText(result, costLine))}`
}

// --- estado compartilhável no hash da URL ---

export interface SharedPlan {
  o: [string, number, number] | null
  s: ([string, number, number] | null)[]
  d: [string, number, number] | null
  e: string
  c: string
  /** 1 quando a rota evita pedágios */
  t?: 1
}

const pack = (p: Place | null): [string, number, number] | null => (p ? [p.label, +p.lat.toFixed(6), +p.lon.toFixed(6)] : null)
export const unpack = (t: [string, number, number] | null): Place | null => (t ? { label: t[0], lat: t[1], lon: t[2] } : null)

export function encodePlan(
  origin: Place | null,
  stops: (Place | null)[],
  dest: Place | null,
  endMode: string,
  criterion: string,
  avoidTolls = false,
): string {
  const plan: SharedPlan = { o: pack(origin), s: stops.map(pack), d: pack(dest), e: endMode, c: criterion, ...(avoidTolls ? { t: 1 as const } : {}) }
  const bytes = new TextEncoder().encode(JSON.stringify(plan))
  let bin = ''
  bytes.forEach((b) => (bin += String.fromCharCode(b)))
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function decodePlan(code: string): SharedPlan | null {
  try {
    const bin = atob(code.replace(/-/g, '+').replace(/_/g, '/'))
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
    const plan = JSON.parse(new TextDecoder().decode(bytes)) as SharedPlan
    return Array.isArray(plan.s) ? plan : null
  } catch {
    return null
  }
}
