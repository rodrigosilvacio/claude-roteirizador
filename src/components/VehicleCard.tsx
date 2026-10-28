import { Car } from 'lucide-react'
import { CONSUMPTION_RANGE, FUEL_PRESETS, PRICE_RANGE, formatMoney, fuelCostPerKm, fuelWarning, type CostSettings, type FuelType } from '../lib/cost'
import { NumberField } from './NumberField'

/** Consumo e preço do combustível do próprio carro, visíveis antes de calcular a rota */
export function VehicleCard({ settings, onChange }: { settings: CostSettings; onChange: (s: CostSettings) => void }) {
  const fuel = FUEL_PRESETS[settings.fuel]
  const unitName = fuel.unit === 'l' ? 'litro' : 'm³'
  const warning = fuelWarning(settings)
  const set = (patch: Partial<CostSettings>) => onChange({ ...settings, ...patch, custom: true })

  return (
    <div className="mt-4 rounded-2xl border border-paper-line bg-paper/60 p-3" aria-label="Seu carro" role="group">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft">
          <Car className="h-3.5 w-3.5" /> seu carro
        </span>
        <span
          className={`rounded-full px-2 py-0.5 font-mono text-[10px] ${settings.custom ? 'bg-ink/10 text-ink' : 'bg-sun-soft text-[#9a6a1c]'}`}
          data-testid="vehicle-status"
        >
          {settings.custom ? 'seus valores' : 'valores de referência'}
        </span>
      </div>

      <div role="radiogroup" aria-label="Combustível do carro" className="grid grid-cols-4 rounded-xl bg-white/70 p-1">
        {(Object.keys(FUEL_PRESETS) as FuelType[]).map((f) => (
          <button
            key={f}
            type="button"
            role="radio"
            aria-checked={settings.fuel === f}
            onClick={() => onChange({ ...settings, fuel: f, consumption: FUEL_PRESETS[f].consumption, price: FUEL_PRESETS[f].price, custom: false })}
            className={`rounded-lg px-1 py-1 text-xs font-medium ${settings.fuel === f ? 'bg-white text-ink shadow-sm' : 'text-ink-soft hover:text-ink'}`}
          >
            {FUEL_PRESETS[f].label}
          </button>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <NumberField
          label={`Faz quantos km por ${unitName}`}
          value={settings.consumption}
          suffix={`km/${fuel.unit}`}
          invalid={settings.consumption < CONSUMPTION_RANGE[0] || settings.consumption > CONSUMPTION_RANGE[1]}
          onChange={(v) => set({ consumption: v ?? 0 })}
        />
        <NumberField
          label={`Preço do ${unitName}`}
          value={settings.price}
          prefix="R$"
          invalid={settings.price < PRICE_RANGE[0] || settings.price > PRICE_RANGE[1]}
          onChange={(v) => set({ price: v ?? 0 })}
        />
      </div>

      {warning ? (
        <p role="status" className="mt-2 text-xs text-[#9a6a1c]">
          {warning}
        </p>
      ) : (
        <p className="mt-2 text-xs text-ink-soft">
          {settings.custom ? 'Com esses valores, cada km rodado custa ' : 'Troque pelos números do seu carro e do seu posto. Hoje cada km custa '}
          <strong className="font-mono text-ink" data-testid="cost-per-km">
            {formatMoney(fuelCostPerKm(settings))}
          </strong>{' '}
          de combustível.
        </p>
      )}
    </div>
  )
}
