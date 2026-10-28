import type { Place } from '../types'

const PHOTON = (import.meta.env.VITE_PHOTON_URL as string | undefined) ?? 'https://photon.komoot.io'

// Limita a busca ao Brasil: evita que "Campinas" vire uma cidade homônima em outro país
const BRAZIL_BBOX = '-74.1,-33.8,-34.7,5.3'

const KIND_LABEL: Record<string, string> = {
  house: 'endereço',
  street: 'rua',
  locality: 'bairro',
  district: 'bairro',
  city: 'cidade',
  county: 'município',
  state: 'estado',
  country: 'país',
  other: 'local',
}

/** Tipos genéricos cujo ponto é um centroide e costuma enganar o cálculo */
export const COARSE_KINDS = new Set(['estado', 'país'])

const UF: Record<string, string> = {
  Acre: 'AC', Alagoas: 'AL', Amapá: 'AP', Amazonas: 'AM', Bahia: 'BA', Ceará: 'CE',
  'Distrito Federal': 'DF', 'Espírito Santo': 'ES', Goiás: 'GO', Maranhão: 'MA',
  'Mato Grosso': 'MT', 'Mato Grosso do Sul': 'MS', 'Minas Gerais': 'MG', Pará: 'PA',
  Paraíba: 'PB', Paraná: 'PR', Pernambuco: 'PE', Piauí: 'PI', 'Rio de Janeiro': 'RJ',
  'Rio Grande do Norte': 'RN', 'Rio Grande do Sul': 'RS', Rondônia: 'RO', Roraima: 'RR',
  'Santa Catarina': 'SC', 'São Paulo': 'SP', Sergipe: 'SE', Tocantins: 'TO',
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] }
  properties: {
    name?: string
    street?: string
    housenumber?: string
    district?: string
    locality?: string
    city?: string
    state?: string
    country?: string
    type?: string
    osm_key?: string
  }
}

export function featureToPlace(f: PhotonFeature): Place {
  const p = f.properties
  const type = p.type ?? 'other'
  const street = p.street ? [p.street, p.housenumber].filter(Boolean).join(', ') : undefined
  const primary = p.name ?? street ?? p.city ?? p.state ?? 'Local sem nome'
  const uf = p.state ? (UF[p.state] ?? p.state) : undefined
  const parts = [primary]
  if (p.name && street && street !== p.name) parts.push(street)
  for (const extra of [p.district ?? p.locality, p.city]) {
    if (extra && !parts.includes(extra)) parts.push(extra)
  }
  if (type === 'state') {
    if (p.country) parts.push(p.country)
  } else if (uf && !parts.includes(p.state!)) {
    parts.push(uf)
  }
  const isPoi = p.osm_key && !['place', 'highway', 'boundary', 'building'].includes(p.osm_key)
  return {
    label: parts.join(', '),
    lat: f.geometry.coordinates[1],
    lon: f.geometry.coordinates[0],
    kind: isPoi ? 'local' : (KIND_LABEL[type] ?? 'local'),
  }
}

function rank(place: Place): number {
  return place.kind && COARSE_KINDS.has(place.kind) ? 1 : 0
}

export async function searchPlaces(query: string, bias?: { lat: number; lon: number }, signal?: AbortSignal): Promise<Place[]> {
  const params = new URLSearchParams({ q: query, limit: '7', bbox: BRAZIL_BBOX })
  if (bias) {
    params.set('lat', String(bias.lat))
    params.set('lon', String(bias.lon))
  }
  const res = await fetch(`${PHOTON}/api/?${params}`, { signal })
  if (!res.ok) throw new Error('Busca de endereços indisponível no momento.')
  const data = (await res.json()) as { features: PhotonFeature[] }
  const seen = new Set<string>()
  return data.features
    .map(featureToPlace)
    .filter((p) => (seen.has(p.label) ? false : (seen.add(p.label), true)))
    // ordenação estável: cidades e ruas antes de estados inteiros
    .map((p, i) => ({ p, i }))
    .sort((a, b) => rank(a.p) - rank(b.p) || a.i - b.i)
    .map(({ p }) => p)
    .slice(0, 6)
}

export async function reversePlace(lat: number, lon: number): Promise<Place> {
  const fallback: Place = { label: `${lat.toFixed(5)}, ${lon.toFixed(5)}`, lat, lon, kind: 'coordenada' }
  try {
    const res = await fetch(`${PHOTON}/reverse?lat=${lat}&lon=${lon}&limit=1`)
    if (!res.ok) return fallback
    const data = (await res.json()) as { features: PhotonFeature[] }
    if (!data.features.length) return fallback
    // mantém a coordenada exata clicada, usa só o nome do endereço
    return { ...featureToPlace(data.features[0]), lat, lon }
  } catch {
    return fallback
  }
}
