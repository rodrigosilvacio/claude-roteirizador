import { useState } from 'react'
import { ChevronDown, Copy, ExternalLink, Navigation, Printer, Share2, TrendingDown, CheckCircle2, ListOrdered, Check } from 'lucide-react'
import type { RouteResult } from '../types'
import { formatDistance, formatDuration, splitDistance } from '../lib/format'
import { googleMapsLinks, wazeLink, whatsappLink } from '../lib/share'
import { Badge } from './AddressInput'
import { fuelCostFor, formatMoney, type CostSettings } from '../lib/cost'

const variantOf = (tag: string, i: number, last: number) => (i === 0 || (tag === 'A' && i === last) ? 'origin' : tag === 'B' ? 'dest' : 'stop')

export function Summary({ result, cost }: { result: RouteResult; cost: number }) {
  const [value, unit] = splitDistance(result.distance)
  const label = result.optimized ? `otimizada · ${result.criterion === 'duration' ? 'menor tempo' : 'menor distância'}` : 'ordem digitada'
  return (
    <section className="grid grid-cols-2 overflow-hidden rounded-2xl bg-ink text-white">
      <div className="border-r border-white/15 p-4">
        <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/70">distância</div>
        <div className="mt-2 flex items-baseline gap-1.5">
          <span className="text-3xl font-extrabold tracking-tight">{value}</span>
          <span className="text-base text-white/75">{unit}</span>
        </div>
      </div>
      <div className="p-4">
        <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/70">tempo estimado</div>
        <div className="mt-2 text-2xl font-extrabold tracking-tight text-sun">{formatDuration(result.duration)}</div>
      </div>
      <div className="col-span-2 flex items-baseline justify-between gap-3 border-t border-white/15 px-4 py-2.5">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/70">custo estimado</span>
        <span className="text-xl font-extrabold tracking-tight">{formatMoney(cost)}</span>
      </div>
      <div className="col-span-2 border-t border-white/15 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-white/60">
        {label} · {result.legs.length} {result.legs.length === 1 ? 'trecho' : 'trechos'}
        {result.avoidTolls ? ' · sem pedágio' : ''}
      </div>
    </section>
  )
}

export function Comparison({ result, settings, onApply }: { result: RouteResult; settings: CostSettings; onApply: () => void }) {
  const c = result.comparison
  if (!c) return null
  const savedTime = c.original.duration - c.chosen.duration
  const savedDist = c.original.distance - c.chosen.distance
  const savedFuel = fuelCostFor(savedDist, settings)

  if (!c.orderChanged) {
    return (
      <section className="flex items-start gap-3 rounded-2xl border border-paper-line bg-paper-card p-4 text-sm">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-ink" />
        <p className="text-ink-deep">
          <strong>Sua ordem já é a mais eficiente.</strong> Nenhuma outra sequência dessas paradas reduz o{' '}
          {result.criterion === 'duration' ? 'tempo' : 'percurso'}.
        </p>
      </section>
    )
  }

  const gains = [
    savedTime >= 30 && <strong key="t">{formatDuration(savedTime)}</strong>,
    savedDist >= 50 && <strong key="d">{formatDistance(savedDist)}</strong>,
    savedFuel >= 0.5 && <strong key="f">{formatMoney(savedFuel)} de combustível</strong>,
  ].filter(Boolean)

  return (
    <section className="rounded-2xl border border-sun-line bg-sun-soft p-4">
      <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-ink-deep">
        <TrendingDown className="h-4 w-4 text-sun" /> ordem reorganizada
      </div>
      <p className="mt-1.5 text-[15px] text-ink-deep">
        {gains.length ? (
          <>
            Economia de {gains.reduce<React.ReactNode[]>((acc, g, i) => (i ? [...acc, i === gains.length - 1 ? ' e ' : ', ', g] : [g]), [])} em relação à ordem digitada.
          </>
        ) : (
          <>Ganho pequeno em relação à ordem digitada: as duas sequências são praticamente equivalentes.</>
        )}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-xs">
        <div className="rounded-2xl bg-white/70 p-3">
          <div className="text-ink-soft">ordem digitada</div>
          <div className="mt-1 text-ink-deep line-through decoration-alert/70">
            {formatDistance(c.original.distance)} · {formatDuration(c.original.duration)}
          </div>
        </div>
        <div className="rounded-2xl bg-white p-3">
          <div className="text-ink-soft">ordem otimizada</div>
          <div className="mt-1 font-semibold text-ink-deep">
            {formatDistance(c.chosen.distance)} · {formatDuration(c.chosen.duration)}
          </div>
        </div>
      </div>
      <button onClick={onApply} className="mt-3 inline-flex items-center gap-2 rounded-full px-1 text-sm font-medium text-ink underline-offset-4 hover:underline">
        <ListOrdered className="h-4 w-4" /> Reordenar os campos nesta sequência
      </button>
    </section>
  )
}

/** Selo de pedágio do trecho: número de praças quando conhecido, senão a marcação de via pedagiada */
function tollBadge(result: RouteResult, plazaCounts: number[] | null | undefined, i: number): string | null {
  const n = plazaCounts?.[i]
  if (plazaCounts) return n ? `${n} ${n === 1 ? 'pedágio' : 'pedágios'}` : null
  return result.legs[i].tollDistance >= 500 ? `pedágio · ${formatDistance(result.legs[i].tollDistance)}` : null
}

export function Itinerary({ result, plazaCounts, onHover }: { result: RouteResult; plazaCounts?: number[] | null; onHover: (leg: number | null) => void }) {
  const last = result.sequence.length - 1
  return (
    <section className="rounded-2xl border border-paper-line bg-paper-card p-4">
      <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft">
        itinerário · {result.tags.filter((t) => /\d/.test(t)).length} paradas
      </h3>
      <ol className="mt-3">
        {result.sequence.map((p, i) => {
          const tag = result.tags[i]
          const leg = result.legs[i]
          const typed = result.typedNumbers[i]
          return (
            <li key={i} className="relative pl-10">
              <div className="absolute left-0 top-0">
                <Badge tag={tag} variant={variantOf(tag, i, last)} />
              </div>
              {i < last && <div className="absolute bottom-0 left-[13px] top-7 w-0.5 bg-sun-line" />}
              <div className="flex min-h-7 items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm text-ink-deep">{p.label}</div>
                  {typed !== null && String(typed) !== tag && (
                    <div className="font-mono text-[11px] text-ink-soft">era a parada {typed}</div>
                  )}
                  {i === last && result.endMode === 'roundtrip' && <div className="font-mono text-[11px] text-ink-soft">retorno à partida</div>}
                </div>
                {i > 0 && (
                  <a
                    href={wazeLink(p)}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 rounded-full border border-paper-line px-2.5 py-1 font-mono text-[11px] text-ink-soft hover:border-ink hover:text-ink"
                    title="Navegar até aqui no Waze"
                  >
                    waze
                  </a>
                )}
              </div>
              {leg && (
                <div
                  onMouseEnter={() => onHover(i)}
                  onMouseLeave={() => onHover(null)}
                  className="my-1.5 inline-block rounded-full bg-paper px-2.5 py-0.5 font-mono text-[11px] text-ink-soft"
                >
                  ↓ {formatDistance(leg.distance)} · {formatDuration(leg.duration)}
                  {tollBadge(result, plazaCounts, i) && <span className="ml-1.5 text-[#9a6a1c]">· {tollBadge(result, plazaCounts, i)}</span>}
                  {leg.hasFerry && <span className="ml-1.5 text-[#9a6a1c]">· balsa</span>}
                </div>
              )}
              {!leg && <div className="h-1" />}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

export function ExportPanel({ result, shareUrl, costLine }: { result: RouteResult; shareUrl: string; costLine: string }) {
  const links = googleMapsLinks(result.sequence)
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Copie o link:', shareUrl)
    }
  }
  return (
    <section className="rounded-2xl border border-paper-line bg-paper-card p-4 print:hidden">
      <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft">levar para a estrada</h3>
      <div className="mt-3 grid gap-2">
        {links.map((href, i) => (
          <a
            key={href}
            href={href}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white hover:bg-ink-deep"
          >
            <span className="flex items-center gap-2">
              <Navigation className="h-4 w-4" /> Abrir no Google Maps{links.length > 1 ? ` · parte ${i + 1} de ${links.length}` : ''}
            </span>
            <ExternalLink className="h-4 w-4 opacity-70" />
          </a>
        ))}
        {links.length > 1 && (
          <p className="text-xs text-ink-soft">O Google Maps aceita até 9 paradas por link, então a rota foi dividida em partes encadeadas.</p>
        )}
        <div className="grid grid-cols-3 gap-2">
          <a href={whatsappLink(result, costLine)} target="_blank" rel="noreferrer" className="export-btn">
            <Share2 className="h-4 w-4" /> WhatsApp
          </a>
          <button onClick={copy} className="export-btn">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? 'Copiado' : 'Copiar link'}
          </button>
          <button onClick={() => window.print()} className="export-btn">
            <Printer className="h-4 w-4" /> Imprimir
          </button>
        </div>
        <p className="text-xs text-ink-soft">Waze navega até um ponto por vez: use o botão “waze” de cada parada no itinerário.</p>
      </div>
    </section>
  )
}

export function DriverSteps({
  result,
  plazaCounts,
  onHover,
  onFocus,
}: {
  result: RouteResult
  plazaCounts?: number[] | null
  onHover: (leg: number | null) => void
  onFocus: (ll: [number, number]) => void
}) {
  const [open, setOpen] = useState<Set<number>>(() => new Set([0]))
  const toggle = (i: number) =>
    setOpen((s) => {
      const n = new Set(s)
      if (n.has(i)) n.delete(i)
      else n.add(i)
      return n
    })
  return (
    <section>
      <h2 className="pt-2 text-lg font-bold text-ink">Trajeto do motorista</h2>
      <p className="mt-0.5 text-sm text-ink-soft">Siga os trechos na ordem. A distância indica quanto percorrer depois de cada instrução. Toque numa instrução para vê-la no mapa.</p>
      <div className="mt-3 space-y-2">
        {result.legs.map((leg, i) => {
          const isOpen = open.has(i)
          return (
            <div key={i} className="overflow-hidden rounded-2xl border border-paper-line bg-paper-card" onMouseEnter={() => onHover(i)} onMouseLeave={() => onHover(null)}>
              <button onClick={() => toggle(i)} className="flex w-full items-start gap-2.5 px-4 py-3 text-left text-sm" aria-expanded={isOpen}>
                <ChevronDown className={`mt-1 h-4 w-4 shrink-0 text-ink transition ${isOpen ? '' : '-rotate-90'}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-bold text-ink">
                      Trecho {i + 1} · {leg.fromTag} → {leg.toTag}
                    </span>
                    <span className="text-ink-soft">
                      {formatDistance(leg.distance)} · {formatDuration(leg.duration)}
                    </span>
                    {tollBadge(result, plazaCounts, i) && (
                      <span className="rounded-full bg-sun-soft px-2 py-0.5 font-mono text-[11px] text-[#9a6a1c]">{tollBadge(result, plazaCounts, i)}</span>
                    )}
                  </div>
                  <div className="truncate text-sm text-ink-soft">
                    {leg.from.label} → {leg.to.label}
                  </div>
                </div>
              </button>
              {isOpen && (
                <ol className="border-t border-paper-line px-4 pb-1">
                  {leg.steps.map((s, j) => (
                    <li key={j} className="border-b border-paper-line last:border-0">
                      <button onClick={() => onFocus(s.location)} className="flex w-full items-start gap-2.5 py-2 text-left hover:bg-paper/60">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-paper font-mono text-[10px] text-ink-soft">{j + 1}</span>
                        <span className="flex-1 pt-0.5 text-sm text-ink-deep">{s.instruction}</span>
                        {j < leg.steps.length - 1 && <span className="shrink-0 pt-0.5 font-mono text-[11px] text-ink-soft">{formatDistance(s.distance)}</span>}
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
