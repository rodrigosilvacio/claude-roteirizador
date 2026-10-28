import { useState } from 'react'
import { NumberField } from './NumberField'
import { Fuel, Loader2, Minus, Plus, Settings2, Ship, Ticket } from 'lucide-react'
import type { RouteResult } from '../types'
import { FUEL_PRESETS, VEHICLES, formatMoney, plazaPriceFor, type CostBreakdown, type CostSettings, type VehicleClass } from '../lib/cost'
import type { TollPlaza } from '../lib/tolls'
import { formatDistance } from '../lib/format'

export interface TollView {
  status: 'loading' | 'ok' | 'error'
  plazas: TollPlaza[]
  /** Valores reais informados, por praça (lembrados entre rotas) */
  prices: Record<string, number>
  onPrice: (key: string, value: number | null) => void
}

interface Props {
  result: RouteResult
  cost: CostBreakdown
  toll: TollView
  settings: CostSettings
  manualToll: number | null
  onSettings: (s: CostSettings) => void
  onManualToll: (v: number | null) => void
  /** Leva até o bloco "Seu carro", onde ficam consumo e preço */
  onEditCar: () => void
}

const liters = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })

export function CostPanel({ result, cost, toll, settings, manualToll, onSettings, onManualToll, onEditCar }: Props) {
  const [open, setOpen] = useState(false)
  const fuel = FUEL_PRESETS[settings.fuel]
  const set = (patch: Partial<CostSettings>) => onSettings({ ...settings, ...patch })
  const ferry = result.legs.some((l) => l.hasFerry)
  const people = Math.max(1, Math.round(settings.people))

  return (
    <section className="rounded-2xl border border-paper-line bg-paper-card p-4" aria-label="Custo da viagem">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft">custo da viagem</h3>
          <div className="mt-1 text-3xl font-extrabold tracking-tight text-ink" data-testid="cost-total">
            {formatMoney(cost.total)}
          </div>
          <div className="mt-1 font-mono text-xs text-ink-soft">
            {people > 1 && <span className="font-semibold text-ink">{formatMoney(cost.perPerson)} por pessoa · </span>}
            {formatMoney(cost.perKm)}/km
          </div>
        </div>
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-paper-line px-3 py-1.5 text-sm font-medium text-ink hover:border-ink print:hidden"
        >
          <Settings2 className="h-4 w-4" /> {open ? 'Fechar' : 'Ajustar'}
        </button>
      </div>

      <dl className="mt-3 divide-y divide-paper-line rounded-2xl bg-white/70">
        <Row icon={<Fuel className="h-4 w-4" />} label="Combustível" value={formatMoney(cost.fuelCost)}>
          {liters.format(cost.fuelAmount)} {fuel.unit} de {fuel.label.toLowerCase()} · {liters.format(settings.consumption)} km/{fuel.unit} · {formatMoney(settings.price)}/{fuel.unit}
          {!settings.custom && <span className="text-[#9a6a1c]"> · valores de referência</span>}{' '}
          <button onClick={onEditCar} className="font-medium text-ink underline underline-offset-2 print:hidden">
            editar
          </button>
        </Row>
        <Row icon={<Ticket className="h-4 w-4" />} label="Pedágio" value={formatMoney(cost.tollCost)}>
          <TollDescription result={result} cost={cost} toll={toll} settings={settings} />
        </Row>
      </dl>

      {toll.plazas.length > 0 && !cost.tollIsManual && <PlazaList result={result} toll={toll} settings={settings} />}
      {cost.tollSource === 'km' && (
        <p className="mt-2 text-xs text-ink-soft">
          Estimativa pelos km em rodovia pedagiada, porque {toll.status === 'ok' ? 'o mapa não tem as praças deste trajeto' : 'as praças ainda não foram consultadas'}. Se souber o valor exato,
          informe em “Ajustar”.
        </p>
      )}
      {ferry && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-[#9a6a1c]">
          <Ship className="mt-0.5 h-3.5 w-3.5 shrink-0" /> A rota inclui travessia de balsa, que não entra no custo.
        </p>
      )}

      {open && (
        <div className="mt-3 grid gap-3 border-t border-paper-line pt-3 print:hidden">
          <label className="grid gap-1">
            <span className="text-sm text-ink-soft">Veículo (categoria do pedágio)</span>
            <select
              value={settings.vehicle}
              onChange={(e) => set({ vehicle: e.target.value as VehicleClass })}
              className="rounded-xl border border-paper-line bg-white px-3 py-2 text-ink-deep focus:border-ink focus:outline-none"
            >
              {(Object.keys(VEHICLES) as VehicleClass[]).map((v) => (
                <option key={v} value={v}>
                  {VEHICLES[v].label} · {VEHICLES[v].multiplier}× tarifa
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Tarifa por praça (R$)" prefix="R$" value={settings.plazaPrice} onChange={(v) => set({ plazaPrice: v ?? 0 })} />
            <NumberField label="Tarifa por km (R$)" prefix="R$" value={settings.tollRate} onChange={(v) => set({ tollRate: v ?? 0 })} />
          </div>
          <p className="-mt-1 text-xs text-ink-soft">Tarifas de carro, multiplicadas pela categoria do veículo. A tarifa por km só é usada quando o mapa não tem as praças.</p>
          <div>
            <NumberField
              label="Pedágio total real (R$)"
              value={manualToll}
              placeholder={`estimado ${formatMoney(cost.tollEstimate)}`}
              onChange={onManualToll}
              allowEmpty
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink-soft">Dividir entre</span>
            <div className="flex items-center gap-2">
              <button className="rounded-full border border-paper-line p-1.5 text-ink disabled:opacity-40" disabled={people <= 1} onClick={() => set({ people: people - 1 })} aria-label="Menos uma pessoa">
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-24 text-center font-mono text-sm text-ink-deep">
                {people} {people === 1 ? 'pessoa' : 'pessoas'}
              </span>
              <button className="rounded-full border border-paper-line p-1.5 text-ink disabled:opacity-40" disabled={people >= 20} onClick={() => set({ people: people + 1 })} aria-label="Mais uma pessoa">
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
          <p className="text-xs text-ink-soft">Consumo e preço do combustível ficam em “Seu carro”, no formulário. As preferências ficam salvas neste navegador.</p>
        </div>
      )}
    </section>
  )
}

function Row({ icon, label, value, children }: { icon: React.ReactNode; label: string; value: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 px-3 py-2.5 text-sm">
      <span className="mt-0.5 text-sun">{icon}</span>
      <div className="min-w-0 flex-1">
        <dt className="font-medium text-ink-deep">{label}</dt>
        <dd className="text-xs text-ink-soft">{children}</dd>
      </div>
      <span className="shrink-0 font-mono font-semibold text-ink-deep">{value}</span>
    </div>
  )
}

function TollDescription({ result, cost, toll, settings }: { result: RouteResult; cost: CostBreakdown; toll: TollView; settings: CostSettings }) {
  const vehicle = VEHICLES[settings.vehicle].label.toLowerCase()
  if (cost.tollSource === 'manual') return <>valor total informado por você</>
  if (cost.tollSource === 'plazas') {
    const n = cost.plazaCount
    const informed = toll.plazas.filter((p) => toll.prices[p.key] !== undefined).length
    return (
      <>
        {n} {n === 1 ? 'praça' : 'praças'} na rota
        {informed === n ? ' · valores informados por você' : ` · ${informed ? `${informed} com valor seu, ` : ''}tarifa média ${formatMoney(settings.plazaPrice)} por praça · ${vehicle}`}
      </>
    )
  }
  const searching = toll.status === 'loading' && (
    <span className="inline-flex items-center gap-1">
      <Loader2 className="h-3 w-3 animate-spin" /> procurando praças na rota
    </span>
  )
  const failed = toll.status === 'error' && 'não foi possível consultar as praças agora'
  if (cost.tollSource === 'km')
    return (
      <>
        {searching || failed || 'nenhuma praça encontrada no mapa'} · estimativa por {formatDistance(result.tollDistance)} em rodovia pedagiada
      </>
    )
  if (searching) return searching
  if (failed) return <>{failed}</>
  return <>{result.avoidTolls ? 'rota calculada evitando pedágios' : 'nenhuma praça de pedágio na rota'}</>
}

function PlazaList({ result, toll, settings }: { result: RouteResult; toll: TollView; settings: CostSettings }) {
  return (
    <div className="mt-3" aria-label="Praças de pedágio" role="group">
      <ol className="divide-y divide-paper-line rounded-2xl border border-paper-line bg-white/50">
        {toll.plazas.map((p, i) => {
          const leg = result.legs[p.leg]
          const manual = toll.prices[p.key] ?? null
          return (
            <li key={`${p.key}-${i}`} className="flex items-center gap-3 px-3 py-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-sun font-mono text-[10px] font-semibold text-ink-deep">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-ink-deep">{p.name}</div>
                <div className="font-mono text-[10px] text-ink-soft">
                  trecho {leg ? `${leg.fromTag} → ${leg.toTag}` : p.leg + 1}
                  {manual === null && ` · estimado ${formatMoney(plazaPriceFor(null, settings))}`}
                </div>
              </div>
              <div className="w-28 shrink-0">
                <NumberField
                  label={`Valor da praça ${i + 1}`}
                  hideLabel
                  prefix="R$"
                  value={manual}
                  placeholder="valor real"
                  allowEmpty
                  onChange={(v) => toll.onPrice(p.key, v)}
                />
              </div>
            </li>
          )
        })}
      </ol>
      <p className="mt-2 text-xs text-ink-soft">
        Praças encontradas no OpenStreetMap. Em branco, vale a tarifa média; o valor que você digitar fica salvo para as próximas rotas. Confira a tarifa no site da concessionária.
      </p>
    </div>
  )
}
