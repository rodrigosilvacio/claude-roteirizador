import { describe, expect, it } from 'vitest'
import { nearestOnLeg, overpassQuery, plazasFromElements, routeBoxes, type OverpassElement } from './tolls'

// rodovia reta norte-sul de ~111 km em lon -47
const leg: [number, number][] = Array.from({ length: 101 }, (_, i) => [-23 + i * 0.01, -47])
const node = (id: number, lat: number, lon: number, name?: string): OverpassElement => ({ type: 'node', id, lat, lon, tags: name ? { name } : {} })
// 1 m em longitude perto de -22.5
const M = 1 / (111_320 * Math.cos((22.5 * Math.PI) / 180))

describe('routeBoxes', () => {
  it('divide rotas longas em caixas pequenas que cobrem toda a linha', () => {
    const boxes = routeBoxes([leg])
    expect(boxes.length).toBeGreaterThanOrEqual(7)
    for (const [lat, lon] of leg) {
      expect(boxes.some(([s, w, n, e]) => lat >= s && lat <= n && lon >= w && lon <= e)).toBe(true)
    }
    expect(overpassQuery(boxes)).toContain('nwr["barrier"="toll_booth"](')
  })
})

describe('nearestOnLeg', () => {
  it('mede a distância até a linha e a posição ao longo dela', () => {
    const r = nearestOnLeg([-22.5, -47 + 10 * M], leg)
    expect(r.dist).toBeCloseTo(10, 0)
    expect(r.along / 1000).toBeCloseTo(55.27, 1)
  })
})

describe('plazasFromElements', () => {
  it('junta as cabines de uma praça e ignora a pista contrária', () => {
    const els = [
      node(3, -22.5, -47 + 2 * M, 'Praça de Pedágio Campinas'), // cabine na pista da rota
      node(1, -22.5005, -47 + 6 * M, 'Pedágio'), // outra faixa da mesma praça, 55 m adiante
      node(9, -22.5, -47 + 35 * M, 'Praça de Pedágio Campinas'), // pista contrária, 35 m ao lado
      node(5, -22.2, -47, undefined), // segunda praça, sem nome
      node(7, -22.9, -46.9, 'Longe'), // fora da rota
    ]
    const plazas = plazasFromElements(els, [leg])
    expect(plazas.map((p) => p.name)).toEqual(['Praça de Pedágio Campinas', 'Praça de pedágio'])
    expect(plazas[0].key).toBe('node/1')
    expect(plazas[0].along).toBeLessThan(plazas[1].along)
  })

  it('conta a mesma praça em trechos diferentes (ida e volta)', () => {
    const back = [...leg].reverse()
    const plazas = plazasFromElements([node(1, -22.5, -47, 'P1')], [leg, back])
    expect(plazas).toHaveLength(1) // o mesmo nó só pertence ao trecho mais próximo
    const both = plazasFromElements([node(1, -22.5, -47, 'P1'), node(2, -22.5, -47.00001, 'P1 volta')], [leg, back.map(([a, b]) => [a, b - 0.00001] as [number, number])])
    expect(both.map((p) => p.leg)).toEqual([0, 1])
  })

  it('aceita praças mapeadas como linha, pelo centro', () => {
    const way: OverpassElement = { type: 'way', id: 4, center: { lat: -22.6, lon: -47 + 30 * M }, tags: { operator: 'CCR' } }
    expect(plazasFromElements([way], [leg])[0].name).toBe('Pedágio CCR')
  })
})
