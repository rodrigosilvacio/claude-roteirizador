import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import type { EndMode, RouteResult } from '../types'

export interface MapPoint {
  id: string
  tag: string
  variant: 'origin' | 'stop' | 'dest'
  lat: number
  lon: number
  label: string
}

// Tiles sem chave de API. A CARTO passou a exigir chave e devolvia o aviso "API KEY REQUIRED" no lugar do mapa.
const TILE_PROVIDERS = [
  {
    url: (import.meta.env.VITE_TILE_URL as string | undefined) ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    subdomains: 'abc',
  },
  {
    url: 'https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · OSM France',
    subdomains: 'abc',
  },
]
/** Falhas de tile antes de trocar para o provedor reserva */
const TILE_ERROR_LIMIT = 6

interface Props {
  /** Muda quando o mapa volta a ficar visível (celular), para recalcular o tamanho */
  visibleKey?: string
  points: MapPoint[]
  result: RouteResult | null
  stale: boolean
  highlightLeg: number | null
  focus: [number, number] | null
  endMode: EndMode
  canAddStop: boolean
  onPick: (role: 'origin' | 'stop' | 'dest', lat: number, lon: number) => void
  onMove: (id: string, lat: number, lon: number) => void
}

const icons = new Map<string, L.DivIcon>()
function pinIcon(tag: string, variant: MapPoint['variant']) {
  const key = `${tag}-${variant}`
  if (!icons.has(key)) {
    icons.set(
      key,
      L.divIcon({
        className: '',
        html: `<div class="rota-pin rota-pin--${variant}"><span>${tag}</span></div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 36],
        popupAnchor: [0, -34],
      }),
    )
  }
  return icons.get(key)!
}

function FitBounds({ points, result, visibleKey }: { points: MapPoint[]; result: RouteResult | null; visibleKey?: string }) {
  const map = useMap()
  const signature = result ? `r-${result.distance}` : points.map((p) => `${p.lat},${p.lon}`).join('|')
  useEffect(() => {
    const coords: [number, number][] = result ? result.legs.flatMap((l) => l.geometry) : points.map((p) => [p.lat, p.lon])
    // o contêiner pode ter estado oculto (display: none) e o Leaflet precisa medir de novo
    map.invalidateSize()
    if (!coords.length) return
    // sem animação: o Leaflet descarta um enquadramento pedido durante outro zoom animado
    map.stop()
    if (coords.length === 1) map.setView(coords[0], 13, { animate: false })
    else map.fitBounds(L.latLngBounds(coords), { padding: [48, 48], maxZoom: 15, animate: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, visibleKey])
  return null
}

function Tiles() {
  const [provider, setProvider] = useState(0)
  const errors = useRef(0)
  const p = TILE_PROVIDERS[provider]
  return (
    <TileLayer
      key={p.url}
      url={p.url}
      attribution={p.attribution}
      subdomains={p.subdomains}
      maxZoom={19}
      className="rota-tiles"
      eventHandlers={{
        tileerror: () => {
          if (++errors.current >= TILE_ERROR_LIMIT && provider < TILE_PROVIDERS.length - 1) {
            errors.current = 0
            setProvider(provider + 1)
          }
        },
        tileload: () => {
          errors.current = 0
        },
      }}
    />
  )
}

function FocusOn({ focus }: { focus: [number, number] | null }) {
  const map = useMap()
  useEffect(() => {
    if (focus) map.flyTo(focus, Math.max(map.getZoom(), 16), { duration: 0.6 })
  }, [focus, map])
  return null
}

function ClickMenu({ endMode, canAddStop, onPick }: Pick<Props, 'endMode' | 'canAddStop' | 'onPick'>) {
  const [at, setAt] = useState<L.LatLng | null>(null)
  useMapEvents({ click: (e) => setAt(e.latlng) })
  if (!at) return null
  const pick = (role: 'origin' | 'stop' | 'dest') => {
    onPick(role, at.lat, at.lng)
    setAt(null)
  }
  return (
    <Popup position={at} eventHandlers={{ remove: () => setAt(null) }}>
      <div className="flex min-w-[170px] flex-col gap-1 font-sans">
        <span className="mb-1 font-mono text-[11px] uppercase tracking-widest text-ink-soft">usar este ponto como</span>
        <button className="map-menu-btn" disabled={!canAddStop} onClick={() => pick('stop')}>
          + Nova parada
        </button>
        <button className="map-menu-btn" onClick={() => pick('origin')}>
          Partida (A)
        </button>
        {endMode === 'fixed' && (
          <button className="map-menu-btn" onClick={() => pick('dest')}>
            Destino (B)
          </button>
        )}
      </div>
    </Popup>
  )
}

export function MapView({ visibleKey, points, result, stale, highlightLeg, focus, endMode, canAddStop, onPick, onMove }: Props) {
  const legs = result?.legs ?? []
  const handlers = useMemo(
    () =>
      Object.fromEntries(
        points.map((p) => [
          p.id,
          {
            dragend: (e: L.LeafletEvent) => {
              const ll = (e.target as L.Marker).getLatLng()
              onMove(p.id, ll.lat, ll.lng)
            },
          },
        ]),
      ),
    [points, onMove],
  )

  return (
    <MapContainer center={[-23.55, -46.63]} zoom={11} className="h-full w-full" zoomControl={true}>
      <Tiles />
      <FitBounds points={points} result={stale ? null : result} visibleKey={visibleKey} />
      <FocusOn focus={focus} />
      <ClickMenu endMode={endMode} canAddStop={canAddStop} onPick={onPick} />
      {!stale &&
        legs.map((leg, i) => {
          const hot = highlightLeg === i
          const dim = highlightLeg !== null && !hot
          return (
            <span key={i}>
              <Polyline positions={leg.geometry} pathOptions={{ color: '#1b3644', weight: hot ? 9 : 7, opacity: dim ? 0.35 : 0.9, lineCap: 'round' }} />
              <Polyline
                positions={leg.geometry}
                pathOptions={{ color: '#e8a63c', weight: hot ? 3 : 2, opacity: dim ? 0.4 : 1, dashArray: hot ? undefined : '6 8', lineCap: 'round' }}
              />
            </span>
          )
        })}
      {points.map((p) => (
        <Marker key={p.id} position={[p.lat, p.lon]} icon={pinIcon(p.tag, p.variant)} draggable eventHandlers={handlers[p.id]}>
          <Popup>
            <div className="font-sans">
              <div className="font-mono text-[11px] uppercase tracking-widest text-ink-soft">
                {p.variant === 'origin' ? 'partida' : p.variant === 'dest' ? 'destino' : `parada ${p.tag}`}
              </div>
              <div className="mt-0.5 text-sm text-ink-deep">{p.label}</div>
              <div className="mt-1 text-xs text-ink-soft">Arraste o pino para ajustar o ponto exato.</div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
