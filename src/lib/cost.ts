/** Custo da viagem: combustível pela distância e pedágio pelos km em rodovia pedagiada */

export type FuelType = 'gasolina' | 'etanol' | 'diesel' | 'gnv'
export type VehicleClass = 'moto' | 'carro' | 'reboque' | 'caminhao2' | 'caminhao3' | 'caminhao4'

export interface FuelPreset {
  label: string
  unit: string
  /** Consumo típico de um carro popular, em km por unidade */
  consumption: number
  price: number
}

// Valores de referência para começar. Preço muda toda semana: a pessoa edita com o do seu posto.
export const FUEL_PRESETS: Record<FuelType, FuelPreset> = {
  gasolina: { label: 'Gasolina', unit: 'l', consumption: 12, price: 6.29 },
  etanol: { label: 'Etanol', unit: 'l', consumption: 8.5, price: 4.29 },
  diesel: { label: 'Diesel', unit: 'l', consumption: 10, price: 6.09 },
  gnv: { label: 'GNV', unit: 'm³', consumption: 13, price: 4.89 },
}

/** Multiplicador sobre a tarifa de carro, seguindo a lógica de categorias por eixo das concessionárias */
export const VEHICLES: Record<VehicleClass, { label: string; multiplier: number }> = {
  moto: { label: 'Moto', multiplier: 0.5 },
  carro: { label: 'Carro', multiplier: 1 },
  reboque: { label: 'Carro com reboque', multiplier: 1.5 },
  caminhao2: { label: 'Caminhão 2 eixos', multiplier: 2 },
  caminhao3: { label: 'Caminhão 3 eixos', multiplier: 3 },
  caminhao4: { label: 'Caminhão 4 eixos', multiplier: 4 },
}

/** Média aproximada da tarifa de carro por km em rodovias pedagiadas (referência: SP e federais) */
export const DEFAULT_TOLL_RATE = 0.16

export interface CostSettings {
  fuel: FuelType
  consumption: number
  price: number
  vehicle: VehicleClass
  tollRate: number
  people: number
  /** true depois que a pessoa informa o consumo ou o preço do próprio carro */
  custom?: boolean
}

export const DEFAULT_COST: CostSettings = {
  fuel: 'gasolina',
  consumption: FUEL_PRESETS.gasolina.consumption,
  price: FUEL_PRESETS.gasolina.price,
  vehicle: 'carro',
  tollRate: DEFAULT_TOLL_RATE,
  people: 1,
  custom: false,
}

/** Faixas plausíveis: fora delas o valor quase sempre é erro de digitação */
export const CONSUMPTION_RANGE = [2, 60] as const
export const PRICE_RANGE = [1, 20] as const

/** Aviso sobre consumo ou preço que deixariam o custo errado */
export function fuelWarning(s: CostSettings): string | null {
  const unit = FUEL_PRESETS[s.fuel].unit
  const unitName = unit === 'l' ? 'litro' : 'm³'
  if (s.consumption <= 0) return `Informe quantos km o carro faz por ${unitName}.`
  if (s.price <= 0) return `Informe o preço do ${unitName}.`
  if (s.consumption < CONSUMPTION_RANGE[0] || s.consumption > CONSUMPTION_RANGE[1])
    return `Confira o consumo: ${s.consumption.toLocaleString('pt-BR')} km/${unit} é incomum para um carro.`
  if (s.price < PRICE_RANGE[0] || s.price > PRICE_RANGE[1]) return `Confira o preço: ${formatMoney(s.price)} por ${unitName} é incomum.`
  return null
}

/** Quanto custa cada km rodado só de combustível */
export function fuelCostPerKm(s: CostSettings): number {
  return s.consumption > 0 ? Math.max(0, s.price) / s.consumption : 0
}

/** Configurações salvas antes deste campo existir: considera "seus valores" se diferem da referência */
export function inferCustom(s: CostSettings): boolean {
  if (s.custom !== undefined) return s.custom
  const ref = FUEL_PRESETS[s.fuel]
  return s.consumption !== ref.consumption || s.price !== ref.price
}

export interface CostBreakdown {
  fuelAmount: number
  fuelCost: number
  tollEstimate: number
  tollCost: number
  tollIsManual: boolean
  total: number
  perPerson: number
  perKm: number
}

/** Custo só do combustível para uma distância, usado na comparação entre ordens */
export function fuelCostFor(meters: number, s: CostSettings): number {
  if (s.consumption <= 0) return 0
  return (meters / 1000 / s.consumption) * Math.max(0, s.price)
}

export function tollEstimateFor(tollMeters: number, s: CostSettings): number {
  return (tollMeters / 1000) * Math.max(0, s.tollRate) * VEHICLES[s.vehicle].multiplier
}

export function computeCost(distance: number, tollDistance: number, s: CostSettings, manualToll: number | null): CostBreakdown {
  const fuelAmount = s.consumption > 0 ? distance / 1000 / s.consumption : 0
  const fuelCost = fuelCostFor(distance, s)
  const tollEstimate = tollEstimateFor(tollDistance, s)
  const tollIsManual = manualToll !== null && manualToll >= 0
  const tollCost = tollIsManual ? manualToll! : tollEstimate
  const total = fuelCost + tollCost
  return {
    fuelAmount,
    fuelCost,
    tollEstimate,
    tollCost,
    tollIsManual,
    total,
    perPerson: total / Math.max(1, Math.round(s.people)),
    perKm: distance > 0 ? total / (distance / 1000) : 0,
  }
}

/** Aceita "12,5", "12.5" e "R$ 1.234,56" */
export function parseNumber(text: string): number | null {
  const clean = text.replace(/[^\d,.-]/g, '')
  if (!clean) return null
  const normalized = clean.includes(',') ? clean.replace(/\./g, '').replace(',', '.') : clean
  const n = Number(normalized)
  return Number.isFinite(n) ? n : null
}

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
export const formatMoney = (v: number) => brl.format(v)
