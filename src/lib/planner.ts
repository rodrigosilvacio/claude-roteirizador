import type { Criterion, EndMode, Place, RouteResult, Waypoint } from '../types'
import { closePath, optimizeOrder, pathCost } from './optimize'
import { fetchMatrix, fetchRoute } from './osrm'

export const MAX_STOPS = 25

export interface PlanInput {
  origin: Waypoint
  stops: Waypoint[]
  destination: Waypoint
  endMode: EndMode
  criterion: Criterion
  avoidTolls?: boolean
}

/** Campos que entram no cálculo: paradas vazias são ignoradas */
export function activeStops(stops: Waypoint[]): Waypoint[] {
  return stops.filter((s) => s.place)
}

export function validate(input: PlanInput): string | null {
  if (!input.origin.place) return 'Informe e confirme o endereço de partida.'
  const pending = input.stops.find((s) => s.query.trim() && !s.place)
  if (pending) return `Confirme o endereço "${pending.query}" escolhendo uma sugestão da lista.`
  const stops = activeStops(input.stops)
  if (input.endMode === 'fixed' && !input.destination.place) return 'Informe o destino ou escolha outra forma de terminar a rota.'
  if (input.endMode !== 'fixed' && stops.length === 0) return 'Adicione pelo menos uma parada.'
  if (input.endMode === 'fixed' && stops.length === 0 && samePlace(input.origin.place, input.destination.place!))
    return 'Partida e destino são o mesmo ponto. Adicione paradas ou marque "voltar à partida".'
  return null
}

function samePlace(a: Place, b: Place) {
  return Math.abs(a.lat - b.lat) < 1e-5 && Math.abs(a.lon - b.lon) < 1e-5
}

export async function computePlan(input: PlanInput, optimize: boolean): Promise<RouteResult> {
  const stops = activeStops(input.stops)
  const fixed = input.endMode === 'fixed'
  const nodes: Waypoint[] = [input.origin, ...stops, ...(fixed ? [input.destination] : [])]
  const places = nodes.map((w) => w.place!)
  const typedOrder = stops.map((_, i) => i + 1)
  const typedPath = closePath(typedOrder, input.endMode, nodes.length)

  let path = typedPath
  let comparison: RouteResult['comparison']
  if (optimize && stops.length >= 2) {
    const matrix = await fetchMatrix(places, !!input.avoidTolls)
    const cost = input.criterion === 'duration' ? matrix.durations : matrix.distances
    const order = optimizeOrder(cost, input.endMode)
    path = closePath(order, input.endMode, nodes.length)
    // nunca apresentar como "otimizada" uma ordem pior que a digitada
    if (pathCost(cost, path) > pathCost(cost, typedPath)) path = typedPath
    comparison = {
      original: { distance: pathCost(matrix.distances, typedPath), duration: pathCost(matrix.durations, typedPath) },
      chosen: { distance: pathCost(matrix.distances, path), duration: pathCost(matrix.durations, path) },
      orderChanged: path.some((v, i) => v !== typedPath[i]),
    }
  }

  let visit = 0
  const last = path.length - 1
  const tags = path.map((_, pos) => {
    if (pos === 0 || (input.endMode === 'roundtrip' && pos === last)) return 'A'
    if (fixed && pos === last) return 'B'
    return String(++visit)
  })
  const sequence = path.map((i) => places[i])
  const route = await fetchRoute(sequence, tags, !!input.avoidTolls)

  return {
    sequence,
    tags,
    ids: path.map((i) => nodes[i].id),
    typedNumbers: path.map((i) => (i >= 1 && i <= stops.length ? i : null)),
    endMode: input.endMode,
    legs: route.legs,
    distance: route.distance,
    duration: route.duration,
    tollDistance: route.tollDistance,
    avoidTolls: !!input.avoidTolls,
    optimized: optimize && stops.length >= 2,
    criterion: input.criterion,
    comparison,
  }
}
