import { useCallback, useEffect, useMemo, useState } from 'react'
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowDown, ArrowUp, ArrowUpDown, Building2, Crosshair, GripVertical, Info, Loader2, Navigation, Plus, RotateCcw, Route, Sparkles, Trash2, Waves, AlertTriangle } from 'lucide-react'
import type { Criterion, EndMode, Place, RouteResult, Waypoint } from './types'
import { AddressInput, Badge } from './components/AddressInput'
import { MapView, type MapPoint } from './components/MapView'
import { Comparison, DriverSteps, ExportPanel, Itinerary, Summary } from './components/Results'
import { MAX_STOPS, computePlan, validate } from './lib/planner'
import { reversePlace } from './lib/geocode'
import { EXAMPLES, type Example } from './lib/examples'
import { decodePlan, encodePlan, unpack } from './lib/share'

const STORAGE_KEY = 'rota:v1'

let seq = 0
const uid = () => `w${Date.now().toString(36)}${(seq++).toString(36)}`
const wp = (place: Place | null = null): Waypoint => ({ id: uid(), query: place?.label ?? '', place })

interface PlanState {
  origin: Waypoint
  stops: Waypoint[]
  destination: Waypoint
  endMode: EndMode
  criterion: Criterion
}

function emptyPlan(): PlanState {
  return { origin: wp(), stops: [wp()], destination: wp(), endMode: 'fixed', criterion: 'duration' }
}

function loadInitial(): PlanState {
  const hash = new URLSearchParams(window.location.hash.slice(1)).get('p')
  if (hash) {
    const plan = decodePlan(hash)
    history.replaceState(null, '', window.location.pathname + window.location.search)
    if (plan) {
      const stops = plan.s.map((s) => wp(unpack(s)))
      return {
        origin: wp(unpack(plan.o)),
        stops: stops.length ? stops : [wp()],
        destination: wp(unpack(plan.d)),
        endMode: (['fixed', 'roundtrip', 'free'].includes(plan.e) ? plan.e : 'fixed') as EndMode,
        criterion: plan.c === 'distance' ? 'distance' : 'duration',
      }
    }
  }
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const s = JSON.parse(saved) as PlanState
      if (s.origin && Array.isArray(s.stops)) return s
    }
  } catch {
    /* armazenamento indisponível: começa vazio */
  }
  return emptyPlan()
}

/** Assinatura dos dados que afetam o cálculo, para saber se o resultado está desatualizado */
function signature(s: PlanState, optimized: boolean) {
  const pt = (w: Waypoint) => (w.place ? `${w.place.lat.toFixed(5)},${w.place.lon.toFixed(5)}` : '-')
  return [pt(s.origin), ...s.stops.map(pt), s.endMode === 'fixed' ? pt(s.destination) : '', s.endMode, optimized ? s.criterion : ''].join('|')
}

export default function App() {
  const [plan, setPlan] = useState<PlanState>(loadInitial)
  const [result, setResult] = useState<RouteResult | null>(null)
  const [resultSig, setResultSig] = useState('')
  const [busy, setBusy] = useState<'typed' | 'optimized' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [highlightLeg, setHighlightLeg] = useState<number | null>(null)
  const [focus, setFocus] = useState<[number, number] | null>(null)
  const [locating, setLocating] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(plan))
    } catch {
      /* sem persistência, segue funcionando */
    }
  }, [plan])

  const { origin, stops, destination, endMode, criterion } = plan
  const stale = !!result && resultSig !== signature(plan, result.optimized)

  const update = (fn: (s: PlanState) => PlanState) => {
    setError(null)
    setPlan(fn)
  }
  const patchWaypoint = useCallback((id: string, patch: Partial<Waypoint>) => {
    setError(null)
    setPlan((s) => ({
      ...s,
      origin: s.origin.id === id ? { ...s.origin, ...patch } : s.origin,
      destination: s.destination.id === id ? { ...s.destination, ...patch } : s.destination,
      stops: s.stops.map((w) => (w.id === id ? { ...w, ...patch } : w)),
    }))
  }, [])

  const run = async (optimize: boolean) => {
    const problem = validate(plan)
    if (problem) {
      setError(problem)
      return
    }
    setBusy(optimize ? 'optimized' : 'typed')
    setError(null)
    try {
      const r = await computePlan(plan, optimize)
      setResult(r)
      setResultSig(signature(plan, r.optimized))
      setHighlightLeg(null)
      if (window.innerWidth < 1024) setTimeout(() => document.getElementById('resultado')?.scrollIntoView({ behavior: 'smooth' }), 50)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const applyOptimizedOrder = () => {
    if (!result) return
    const order = result.ids.filter((id) => stops.some((s) => s.id === id))
    update((s) => ({ ...s, stops: [...order.map((id) => s.stops.find((w) => w.id === id)!), ...s.stops.filter((w) => !w.place)] }))
    // a ordem nos campos agora é a otimizada; o resultado continua válido
    setResultSig(signature({ ...plan, stops: [...order.map((id) => stops.find((w) => w.id === id)!), ...stops.filter((w) => !w.place)] }, result.optimized))
  }

  const loadExample = (ex: Example) => {
    setResult(null)
    setError(null)
    setPlan({ origin: wp(ex.origin), stops: ex.stops.map((p) => wp(p)), destination: wp(ex.destination), endMode: ex.endMode, criterion: ex.criterion })
  }

  const reset = () => {
    if (!window.confirm('Limpar todos os endereços?')) return
    setResult(null)
    setError(null)
    setPlan(emptyPlan())
  }

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setError('Este navegador não informa a localização.')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const place = await reversePlace(pos.coords.latitude, pos.coords.longitude)
        patchWaypoint(origin.id, { place, query: place.label })
        setLocating(false)
      },
      () => {
        setError('Não foi possível obter sua localização. Verifique a permissão do navegador.')
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  const onPick = useCallback(async (role: 'origin' | 'stop' | 'dest', lat: number, lon: number) => {
    const place = await reversePlace(lat, lon)
    setError(null)
    setPlan((s) => {
      const filled = { place, query: place.label }
      if (role === 'origin') return { ...s, origin: { ...s.origin, ...filled } }
      if (role === 'dest') return { ...s, destination: { ...s.destination, ...filled } }
      const emptyIdx = s.stops.findIndex((w) => !w.place && !w.query.trim())
      if (emptyIdx >= 0) return { ...s, stops: s.stops.map((w, i) => (i === emptyIdx ? { ...w, ...filled } : w)) }
      if (s.stops.length >= MAX_STOPS) return s
      return { ...s, stops: [...s.stops, { id: uid(), ...filled }] }
    })
  }, [])

  const onMove = useCallback(
    async (id: string, lat: number, lon: number) => {
      const place = await reversePlace(lat, lon)
      patchWaypoint(id, { place, query: place.label })
    },
    [patchWaypoint],
  )

  const bias = origin.place ? { lat: origin.place.lat, lon: origin.place.lon } : undefined

  const mapPoints = useMemo<MapPoint[]>(() => {
    const fresh = result && !stale
    const tagById = new Map<string, string>()
    if (fresh) result.ids.forEach((id, i) => !tagById.has(id) && tagById.set(id, result.tags[i]))
    const pts: MapPoint[] = []
    const push = (w: Waypoint, tag: string, variant: MapPoint['variant']) =>
      w.place && pts.push({ id: w.id, tag: tagById.get(w.id) ?? tag, variant, lat: w.place.lat, lon: w.place.lon, label: w.place.label })
    push(origin, 'A', 'origin')
    let n = 0
    stops.forEach((w) => w.place && push(w, String(++n), 'stop'))
    if (endMode === 'fixed') push(destination, 'B', 'dest')
    return pts
  }, [origin, stops, destination, endMode, result, stale])

  const shareUrl = useMemo(
    () =>
      `${window.location.origin}${window.location.pathname}#p=${encodePlan(
        origin.place,
        stops.map((s) => s.place).filter(Boolean),
        endMode === 'fixed' ? destination.place : null,
        endMode,
        criterion,
      )}`,
    [origin, stops, destination, endMode, criterion],
  )

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return
    update((s) => {
      const from = s.stops.findIndex((w) => w.id === e.active.id)
      const to = s.stops.findIndex((w) => w.id === e.over!.id)
      return { ...s, stops: arrayMove(s.stops, from, to) }
    })
  }
  const move = (i: number, dir: -1 | 1) => update((s) => ({ ...s, stops: arrayMove(s.stops, i, i + dir) }))

  const criterionLabel = criterion === 'duration' ? 'tempo' : 'distância'
  const filledStops = stops.filter((s) => s.place).length

  return (
    <div className="min-h-screen bg-paper text-ink-deep">
      <div className="mx-auto grid max-w-[1560px] grid-cols-1 lg:grid-cols-[minmax(460px,560px)_1fr] lg:grid-rows-[auto_1fr]">
        {/* ---------- formulário ---------- */}
        <div className="px-4 pt-6 sm:px-6 lg:col-start-1 lg:row-start-1 print:hidden">
          <header className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="font-mono text-xs uppercase tracking-[0.3em] text-ink-soft">planejador de trajetos</div>
              <h1 className="mt-1 text-6xl font-extrabold tracking-tighter text-ink">
                Rota<span className="text-sun">.</span>
              </h1>
            </div>
            <p className="max-w-[230px] text-right text-ink-soft">Até {MAX_STOPS} paradas. Uma ordem que faz sentido.</p>
          </header>

          <section className="mt-6 rounded-[28px] border border-paper-line bg-paper-card p-4 shadow-sm sm:p-6">
            <Segmented
              label="Como a rota termina"
              value={endMode}
              onChange={(v) => update((s) => ({ ...s, endMode: v }))}
              options={[
                { value: 'fixed', label: 'Destino fixo' },
                { value: 'roundtrip', label: 'Volta à partida' },
                { value: 'free', label: 'Melhor final' },
              ]}
            />
            {endMode === 'free' && <p className="mt-2 text-sm text-ink-soft">O sistema escolhe qual parada deve ser a última para economizar mais.</p>}

            <FieldLabel className="mt-6" title="Partida" waypoint={origin} />
            <AddressInput
              query={origin.query}
              place={origin.place}
              badge={<Badge tag="A" variant="origin" />}
              placeholder="De onde você sai?"
              onQuery={(q) => patchWaypoint(origin.id, { query: q, place: null })}
              onPlace={(p) => patchWaypoint(origin.id, { place: p, query: p.label })}
              onClear={() => patchWaypoint(origin.id, { place: null, query: '' })}
            />
            <div className="mt-2 flex items-center justify-between pl-12">
              <button onClick={useMyLocation} className="inline-flex items-center gap-2 font-mono text-sm text-ink hover:underline" disabled={locating}>
                {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />} usar minha localização
              </button>
              {endMode === 'fixed' && (
                <button
                  onClick={() => update((s) => ({ ...s, origin: s.destination, destination: s.origin }))}
                  className="rounded-full border border-paper-line p-2.5 text-ink hover:bg-paper"
                  aria-label="Inverter partida e destino"
                  title="Inverter partida e destino"
                >
                  <ArrowUpDown className="h-5 w-5" />
                </button>
              )}
            </div>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={stops.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                <div className="mt-3 space-y-3 border-l-2 border-dashed border-sun-line pl-3">
                  {stops.map((w, i) => (
                    <StopRow
                      key={w.id}
                      waypoint={w}
                      index={i}
                      total={stops.length}
                      bias={bias}
                      autoFocus={i === stops.length - 1 && i > 0 && !w.query}
                      onPatch={(patch) => patchWaypoint(w.id, patch)}
                      onMove={(dir) => move(i, dir)}
                      onRemove={() => update((s) => ({ ...s, stops: s.stops.length > 1 ? s.stops.filter((x) => x.id !== w.id) : [wp()] }))}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            <button
              onClick={() => update((s) => ({ ...s, stops: [...s.stops, wp()] }))}
              disabled={stops.length >= MAX_STOPS}
              className="mt-3 flex w-full items-center justify-between rounded-2xl border border-dashed border-paper-line px-4 py-3 text-ink hover:border-ink disabled:opacity-50"
            >
              <span className="flex items-center gap-2 text-[17px]">
                <Plus className="h-5 w-5" /> Adicionar parada
              </span>
              <span className="font-mono text-sm text-ink-soft">
                {stops.length}/{MAX_STOPS}
              </span>
            </button>
            <p className="mt-2 text-xs text-ink-soft">Dica: clique no mapa para adicionar um ponto, e arraste os pinos para ajustar.</p>

            {endMode === 'fixed' && (
              <>
                <FieldLabel className="mt-5" title="Destino" waypoint={destination} />
                <AddressInput
                  query={destination.query}
                  place={destination.place}
                  badge={<Badge tag="B" variant="dest" />}
                  placeholder="Para onde você vai?"
                  bias={bias}
                  onQuery={(q) => patchWaypoint(destination.id, { query: q, place: null })}
                  onPlace={(p) => patchWaypoint(destination.id, { place: p, query: p.label })}
                  onClear={() => patchWaypoint(destination.id, { place: null, query: '' })}
                />
              </>
            )}

            <div className="mt-6">
              <Segmented
                label="Otimizar pelo"
                value={criterion}
                onChange={(v) => update((s) => ({ ...s, criterion: v }))}
                options={[
                  { value: 'duration', label: 'Menor tempo' },
                  { value: 'distance', label: 'Menor distância' },
                ]}
              />
            </div>

            {error && (
              <div role="alert" className="mt-4 flex items-start gap-2 rounded-2xl border border-alert/30 bg-alert/5 px-4 py-3 text-sm text-alert">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
              </div>
            )}

            <div className="mt-5 grid gap-3">
              <button
                onClick={() => run(true)}
                disabled={!!busy}
                className="flex items-center justify-center gap-2.5 rounded-2xl bg-sun px-4 py-4 text-lg font-bold text-ink-deep shadow-sm transition hover:brightness-95 disabled:opacity-60"
              >
                {busy === 'optimized' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
                Otimizar por {criterionLabel}
              </button>
              <div className="flex gap-3">
                <button
                  onClick={() => run(false)}
                  disabled={!!busy}
                  className="flex flex-1 items-center justify-center gap-2.5 rounded-2xl bg-ink px-4 py-3.5 font-semibold text-white transition hover:bg-ink-deep disabled:opacity-60"
                >
                  {busy === 'typed' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Navigation className="h-5 w-5" />}
                  Na ordem digitada
                </button>
                <button onClick={reset} className="rounded-2xl border border-paper-line px-4 text-ink hover:bg-paper" aria-label="Limpar tudo" title="Limpar tudo">
                  <RotateCcw className="h-5 w-5" />
                </button>
              </div>
            </div>
            {filledStops >= 2 && !busy && <p className="mt-2 text-center text-xs text-ink-soft">A otimização testa as combinações de {filledStops} paradas e escolhe a melhor.</p>}
          </section>

          <div className="mt-4 grid gap-2">
            <div className="font-mono text-xs uppercase tracking-[0.2em] text-ink-soft">ou comece por um exemplo</div>
            {EXAMPLES.map((ex) => (
              <button
                key={ex.title}
                onClick={() => loadExample(ex)}
                className="flex items-center gap-3 rounded-2xl border border-dashed border-paper-line px-4 py-3 text-left hover:border-ink hover:bg-paper-card"
              >
                {ex.icon === 'city' ? <Building2 className="h-5 w-5 shrink-0 text-sun" /> : ex.icon === 'coast' ? <Waves className="h-5 w-5 shrink-0 text-sun" /> : <Route className="h-5 w-5 shrink-0 text-sun" />}
                <span>
                  <span className="block text-[15px] leading-snug text-ink-deep">{ex.title}</span>
                  <span className="block font-mono text-[11px] text-ink-soft">{ex.subtitle.replace('Exemplo · ', '')}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* ---------- mapa ---------- */}
        <aside className="px-4 pt-5 sm:px-6 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:pl-0 lg:pt-0 print:hidden">
          <div className="relative h-[60vh] overflow-hidden rounded-[28px] border border-paper-line lg:sticky lg:top-0 lg:h-[calc(100vh-2rem)] lg:mt-4">
            <MapView
              points={mapPoints}
              result={result}
              stale={stale}
              highlightLeg={highlightLeg}
              focus={focus}
              endMode={endMode}
              canAddStop={stops.length < MAX_STOPS || stops.some((w) => !w.place && !w.query.trim())}
              onPick={onPick}
              onMove={onMove}
            />
            {stale && (
              <div className="absolute left-1/2 top-4 z-[500] -translate-x-1/2 rounded-full bg-ink px-4 py-2 font-mono text-xs text-white shadow-lg">
                endereços mudaram · recalcule a rota
              </div>
            )}
          </div>
        </aside>

        {/* ---------- resultado ---------- */}
        <div id="resultado" className="space-y-4 px-4 pb-16 pt-5 sm:px-6 lg:col-start-1 lg:row-start-2">
          {result && (
            <div className={`space-y-4 transition ${stale ? 'opacity-50' : ''}`}>
              {stale && (
                <div className="rounded-2xl bg-ink/5 px-4 py-3 text-sm text-ink print:hidden">Os endereços mudaram desde o último cálculo. Recalcule para atualizar.</div>
              )}
              <Summary result={result} />
              <Comparison result={result} onApply={applyOptimizedOrder} />
              <Itinerary result={result} onHover={setHighlightLeg} />
              <ExportPanel result={result} shareUrl={shareUrl} />
              <p className="flex items-start gap-2 text-sm text-ink-soft">
                <Info className="mt-0.5 h-4 w-4 shrink-0" /> Tempo estimado sem trânsito em tempo real. Busca e rotas usam serviços públicos do OpenStreetMap, que às vezes ficam indisponíveis.
              </p>
              <DriverSteps result={result} onHover={setHighlightLeg} onFocus={setFocus} />
            </div>
          )}
          {!result && (
            <div className="rounded-3xl border border-dashed border-paper-line p-6 text-center text-ink-soft print:hidden">
              Preencha a partida e as paradas, ou escolha um exemplo acima. O resultado aparece aqui.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function FieldLabel({ title, waypoint, className = '' }: { title: string; waypoint: Waypoint; className?: string }) {
  const status = waypoint.place
    ? { text: waypoint.place.approximate ? 'endereço aproximado' : 'endereço confirmado', cls: 'text-ink' }
    : waypoint.query.trim()
      ? { text: 'escolha uma sugestão', cls: 'text-[#9a6a1c]' }
      : null
  return (
    <div className={`mb-2 flex items-baseline justify-between ${className}`}>
      <span className="font-mono text-sm uppercase tracking-[0.2em] text-ink-soft">{title}</span>
      {status && <span className={`font-mono text-xs ${status.cls}`}>{status.text}</span>}
    </div>
  )
}

function Segmented<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div>
      <div className="mb-2 font-mono text-sm uppercase tracking-[0.2em] text-ink-soft">{label}</div>
      <div role="radiogroup" aria-label={label} className="grid rounded-2xl bg-paper p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map((o) => (
          <button
            key={o.value}
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={`rounded-xl px-2 py-2 text-[15px] font-medium transition ${value === o.value ? 'bg-white text-ink shadow-sm' : 'text-ink-soft hover:text-ink'}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

interface StopRowProps {
  waypoint: Waypoint
  index: number
  total: number
  bias?: { lat: number; lon: number }
  autoFocus: boolean
  onPatch: (p: Partial<Waypoint>) => void
  onMove: (dir: -1 | 1) => void
  onRemove: () => void
}

function StopRow({ waypoint, index, total, bias, autoFocus, onPatch, onMove, onRemove }: StopRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: waypoint.id })
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 20 : undefined }
  return (
    <div ref={setNodeRef} style={style} className={isDragging ? 'opacity-80' : ''}>
      <FieldLabel title={`Parada ${index + 1}`} waypoint={waypoint} />
      <div className="flex items-center gap-1">
        <button {...attributes} {...listeners} className="cursor-grab touch-none rounded p-1 text-ink-soft hover:text-ink active:cursor-grabbing" aria-label={`Arrastar parada ${index + 1}`}>
          <GripVertical className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <AddressInput
            query={waypoint.query}
            place={waypoint.place}
            badge={<Badge tag={String(index + 1)} variant="stop" />}
            placeholder="Endereço, cidade ou local"
            bias={bias}
            autoFocus={autoFocus}
            onQuery={(q) => onPatch({ query: q, place: null })}
            onPlace={(p) => onPatch({ place: p, query: p.label })}
            onClear={() => onPatch({ place: null, query: '' })}
          />
        </div>
        <div className="flex shrink-0 items-center">
          <IconBtn label="Subir parada" disabled={index === 0} onClick={() => onMove(-1)}>
            <ArrowUp className="h-5 w-5" />
          </IconBtn>
          <IconBtn label="Descer parada" disabled={index === total - 1} onClick={() => onMove(1)}>
            <ArrowDown className="h-5 w-5" />
          </IconBtn>
          <IconBtn label="Remover parada" onClick={onRemove}>
            <Trash2 className="h-5 w-5" />
          </IconBtn>
        </div>
      </div>
    </div>
  )
}

function IconBtn({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled} aria-label={label} title={label} className="rounded-lg p-1.5 text-ink hover:bg-paper disabled:text-ink-soft/30 disabled:hover:bg-transparent">
      {children}
    </button>
  )
}
