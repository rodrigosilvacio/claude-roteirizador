import { describe, expect, it } from 'vitest'
import { DEFAULT_COST, computeCost, parseNumber } from './cost'

describe('computeCost', () => {
  it('soma combustível e pedágio estimado', () => {
    // 120 km a 12 km/l = 10 l; 50 km pedagiados a R$ 0,16 = R$ 8
    const c = computeCost(120_000, { tollDistance: 50_000, plazas: null }, { ...DEFAULT_COST, price: 6 }, null)
    expect(c.fuelAmount).toBeCloseTo(10)
    expect(c.fuelCost).toBeCloseTo(60)
    expect(c.tollCost).toBeCloseTo(8)
    expect(c.total).toBeCloseTo(68)
    expect(c.perKm).toBeCloseTo(68 / 120)
  })

  it('aplica o multiplicador do veículo só no pedágio', () => {
    const c = computeCost(100_000, { tollDistance: 100_000, plazas: null }, { ...DEFAULT_COST, vehicle: 'caminhao3' }, null)
    expect(c.tollCost).toBeCloseTo(100 * 0.16 * 3)
    expect(c.fuelCost).toBeCloseTo(computeCost(100_000, { tollDistance: 0, plazas: null }, DEFAULT_COST, null).fuelCost)
  })

  it('valor de pedágio informado substitui a estimativa, inclusive zero', () => {
    expect(computeCost(100_000, { tollDistance: 80_000, plazas: null }, DEFAULT_COST, 42.3).tollCost).toBe(42.3)
    const zero = computeCost(100_000, { tollDistance: 80_000, plazas: null }, DEFAULT_COST, 0)
    expect(zero.tollCost).toBe(0)
    expect(zero.tollIsManual).toBe(true)
  })

  it('divide entre pessoas e tolera consumo zerado', () => {
    expect(computeCost(100_000, { tollDistance: 0, plazas: null }, { ...DEFAULT_COST, price: 6, consumption: 10, people: 3 }, null).perPerson).toBeCloseTo(20)
    expect(computeCost(100_000, { tollDistance: 0, plazas: null }, { ...DEFAULT_COST, consumption: 0 }, null).fuelCost).toBe(0)
  })
})

describe('parseNumber', () => {
  it('entende formatos brasileiros', () => {
    expect(parseNumber('12,5')).toBe(12.5)
    expect(parseNumber('6.29')).toBe(6.29)
    expect(parseNumber('R$ 1.234,56')).toBe(1234.56)
    expect(parseNumber('')).toBeNull()
  })
})

describe('fuelWarning', async () => {
  const { fuelWarning, fuelCostPerKm, inferCustom } = await import('./cost')
  it('aceita valores normais e aponta os improváveis', () => {
    expect(fuelWarning({ ...DEFAULT_COST, consumption: 13.5, price: 5.89 })).toBeNull()
    expect(fuelWarning({ ...DEFAULT_COST, consumption: 0 })).toMatch(/quantos km/)
    expect(fuelWarning({ ...DEFAULT_COST, price: 0 })).toMatch(/preço do litro/)
    expect(fuelWarning({ ...DEFAULT_COST, consumption: 150 })).toMatch(/150 km\/l é incomum/)
    expect(fuelWarning({ ...DEFAULT_COST, price: 62.9 })).toMatch(/incomum/)
    expect(fuelWarning({ ...DEFAULT_COST, fuel: 'gnv', consumption: 0 })).toMatch(/por m³/)
  })

  it('calcula o custo por km rodado', () => {
    expect(fuelCostPerKm({ ...DEFAULT_COST, consumption: 10, price: 6 })).toBeCloseTo(0.6)
    expect(fuelCostPerKm({ ...DEFAULT_COST, consumption: 0 })).toBe(0)
  })

  it('reconhece valores salvos por versões anteriores como do usuário', () => {
    expect(inferCustom({ ...DEFAULT_COST, custom: undefined })).toBe(false)
    expect(inferCustom({ ...DEFAULT_COST, custom: undefined, consumption: 14 })).toBe(true)
    expect(inferCustom({ ...DEFAULT_COST, custom: false, consumption: 14 })).toBe(false)
  })
})

describe('pedágio por praças', async () => {
  const { computeCost: cc } = await import('./cost')
  const plazas = (...manual: (number | null)[]) => manual.map((m) => ({ manual: m }))

  it('soma tarifa média por praça e valores informados', () => {
    const c = cc(100_000, { tollDistance: 80_000, plazas: plazas(null, 14.6, null) }, { ...DEFAULT_COST, plazaPrice: 10 }, null)
    expect(c.tollCost).toBeCloseTo(34.6)
    expect(c.tollSource).toBe('plazas')
    expect(c.plazaCount).toBe(3)
  })

  it('multiplica só a tarifa média pela categoria do veículo', () => {
    const c = cc(100_000, { tollDistance: 0, plazas: plazas(null, 20) }, { ...DEFAULT_COST, plazaPrice: 10, vehicle: 'caminhao3' }, null)
    expect(c.tollCost).toBeCloseTo(50)
  })

  it('usa a estimativa por km quando não há praça detectada ou a busca falhou', () => {
    expect(cc(100_000, { tollDistance: 50_000, plazas: [] }, DEFAULT_COST, null).tollSource).toBe('km')
    expect(cc(100_000, { tollDistance: 50_000, plazas: null }, DEFAULT_COST, null).tollCost).toBeCloseTo(8)
    const none = cc(100_000, { tollDistance: 0, plazas: [] }, DEFAULT_COST, null)
    expect([none.tollSource, none.tollCost]).toEqual(['none', 0])
  })

  it('o total informado substitui praças e estimativa', () => {
    const c = cc(100_000, { tollDistance: 0, plazas: plazas(null, null) }, DEFAULT_COST, 31.2)
    expect([c.tollSource, c.tollCost]).toEqual(['manual', 31.2])
  })
})
