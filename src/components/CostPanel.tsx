import { useState } from 'react'
import { NumberField } from './NumberField'
import { Fuel, Minus, Plus, Settings2, Ship, Ticket } from 'lucide-react'
import type { RouteResult } from '../types'
import { FUEL_PRESETS, VEHICLES, computeCost, formatMoney, type CostSettings, type VehicleClass } from '../lib/cost'
import { formatDistance } from '../lib/format'

interface Props {
  result: RouteResult
  settings: CostSettings
  manualToll: number | null
  onSettings: (s: CostSettings) => void
  onManualToll: (v: number | null) => void
  /** Leva até o bloco "Seu carro", onde ficam consumo e preço */
  onEditCar: () => void
}

const liters = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })

export function CostPanel({ result, settings, manualToll, onSettings, onManualToll, onEditCar }: Props) {
  const [open, setOpen] = useState(false)
  const cost = computeCost(result.distance, result.tollDistance, settings, manualToll)
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
          {cost.tollIsManual
            ? 'valor informado por você'
            : result.tollDistance < 500
              ? result.avoidTolls
                ? 'rota calculada evitando pedágios'
                : 'nenhuma via pedagiada detectada'
              : `estimativa · ${formatDistance(result.tollDistance)} em rodovia pedagiada · ${VEHICLES[settings.vehicle].label.toLowerCase()}`}
        </Row>
      </dl>

      {!cost.tollIsManual && result.tollDistance >= 500 && (
        <p className="mt-2 text-xs text-ink-soft">
          O pedágio é estimado pela tarifa média por km, porque os mapas abertos não trazem o preço de cada praça. Se souber o valor exato, informe em “Ajustar”.
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
            <NumberField label="Tarifa média (R$/km)" value={settings.tollRate} onChange={(v) => set({ tollRate: v ?? 0 })} />
            <NumberField
              label="Pedágio real (R$)"
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
