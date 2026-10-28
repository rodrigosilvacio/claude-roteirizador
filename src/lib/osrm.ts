import type { Leg, Place, Step } from '../types'
import { describeStep, type OsrmStep } from './instructions'

const OSRM = (import.meta.env.VITE_OSRM_URL as string | undefined) ?? 'https://router.project-osrm.org'

/** Fração do passo em via com a classe pedida, estimada pelos cruzamentos do trecho */
export function classShare(step: Pick<OsrmStep, 'intersections'>, cls: string): number {
  const xs = step.intersections ?? []
  if (!xs.length) return 0
  return xs.filter((x) => x.classes?.includes(cls)).length / xs.length
}

const exclude = (avoidTolls: boolean) => (avoidTolls ? '&exclude=toll' : '')

const coords = (places: Place[]) => places.map((p) => `${p.lon.toFixed(6)},${p.lat.toFixed(6)}`).join(';')

async function call<T>(url: string): Promise<T> {
  let res: Response
  try {
    res = await fetch(url)
  } catch {
    throw new Error('Não foi possível falar com o serviço de rotas. Verifique a conexão e tente de novo.')
  }
  if (res.status === 400 && url.includes('exclude=')) throw new Error('O serviço de rotas não aceitou "evitar pedágios" agora. Desmarque a opção e tente de novo.')
  if (res.status === 429) throw new Error('Serviço de rotas sobrecarregado. Aguarde alguns segundos e tente de novo.')
  const data = (await res.json().catch(() => ({}))) as { code?: string; message?: string } & T
  if (!res.ok || data.code !== 'Ok') {
    if (data.code === 'NoRoute') throw new Error('Não existe rota de carro entre alguns pontos (ex.: ilha sem ponte).')
    if (data.code === 'NoSegment') throw new Error('Algum endereço está longe de qualquer via. Ajuste o pino no mapa.')
    throw new Error(data.message ?? 'O serviço de rotas não respondeu como esperado.')
  }
  return data
}

export interface Matrix {
  durations: number[][]
  distances: number[][]
}

export async function fetchMatrix(places: Place[], avoidTolls = false): Promise<Matrix> {
  const data = await call<{ durations: (number | null)[][]; distances: (number | null)[][] }>(
    `${OSRM}/table/v1/driving/${coords(places)}?annotations=duration,distance${exclude(avoidTolls)}`,
  )
  const clean = (m: (number | null)[][]) => m.map((row) => row.map((v) => (v === null ? 1e9 : v)))
  return { durations: clean(data.durations), distances: clean(data.distances) }
}

interface OsrmRoute {
  distance: number
  duration: number
  legs: { distance: number; duration: number; steps: (OsrmStep & { geometry: { coordinates: [number, number][] } })[] }[]
}

export async function fetchRoute(
  places: Place[],
  tags: string[],
  avoidTolls = false,
): Promise<{ legs: Leg[]; distance: number; duration: number; tollDistance: number }> {
  const data = await call<{ routes: OsrmRoute[] }>(
    `${OSRM}/route/v1/driving/${coords(places)}?overview=false&steps=true&geometries=geojson${exclude(avoidTolls)}`,
  )
  const route = data.routes[0]
  const legs: Leg[] = route.legs.map((leg, i) => {
    const to = places[i + 1]
    const geometry: [number, number][] = []
    const steps: Step[] = []
    let tollDistance = 0
    let hasFerry = false
    for (const s of leg.steps) {
      tollDistance += s.distance * classShare(s, 'toll')
      if (classShare(s, 'ferry') > 0 || s.maneuver.type === 'ferry') hasFerry = true
      for (const [lon, lat] of s.geometry.coordinates) geometry.push([lat, lon])
      // trechos de zero metros (exceto a chegada) são ruído do roteador
      if (s.distance < 1 && s.maneuver.type !== 'arrive') continue
      steps.push({
        instruction: describeStep(s, to.label.split(',')[0]),
        distance: s.distance,
        duration: s.duration,
        location: [s.maneuver.location[1], s.maneuver.location[0]],
      })
    }
    return {
      from: places[i],
      to,
      fromTag: tags[i],
      toTag: tags[i + 1],
      distance: leg.distance,
      duration: leg.duration,
      tollDistance,
      hasFerry,
      steps,
      geometry,
    }
  })
  return { legs, distance: route.distance, duration: route.duration, tollDistance: legs.reduce((s, l) => s + l.tollDistance, 0) }
}
