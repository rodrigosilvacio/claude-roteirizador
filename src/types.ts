export interface Place {
  label: string
  lat: number
  lon: number
  /** Tipo do resultado (rua, cidade, estado...) para avisar sobre buscas imprecisas */
  kind?: string
  /** true quando o endereço foi escolhido automaticamente, sem confirmação do usuário */
  approximate?: boolean
}

export interface Waypoint {
  id: string
  query: string
  place: Place | null
}

/** fixed: destino definido · roundtrip: volta à partida · free: o sistema escolhe a última parada */
export type EndMode = 'fixed' | 'roundtrip' | 'free'
export type Criterion = 'duration' | 'distance'

export interface Step {
  instruction: string
  distance: number
  duration: number
  location: [number, number] // [lat, lon]
}

export interface Leg {
  from: Place
  to: Place
  fromTag: string
  toTag: string
  distance: number
  duration: number
  steps: Step[]
  geometry: [number, number][] // [lat, lon]
}

export interface RouteResult {
  /** Pontos na ordem percorrida, já incluindo partida e chegada */
  sequence: Place[]
  tags: string[]
  /** Id do campo de origem de cada ponto, para ligar marcadores e campos */
  ids: string[]
  /** Número que a parada tinha na ordem digitada (null para partida e destino) */
  typedNumbers: (number | null)[]
  endMode: EndMode
  legs: Leg[]
  distance: number
  duration: number
  optimized: boolean
  criterion: Criterion
  /** Comparação com a ordem digitada, presente só quando a rota foi otimizada */
  comparison?: {
    original: { distance: number; duration: number }
    chosen: { distance: number; duration: number }
    orderChanged: boolean
  }
}
