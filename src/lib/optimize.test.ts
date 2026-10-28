import { describe, expect, it } from 'vitest'
import { closePath, optimizeOrder, pathCost, type EndRule } from './optimize'

function randomMatrix(n: number, seed: number): number[][] {
  let s = seed
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  const pts = Array.from({ length: n }, () => [rnd() * 100, rnd() * 100])
  // assimétrica de propósito, como tempos reais de trânsito
  return pts.map((a, i) =>
    pts.map((b, j) => (i === j ? 0 : Math.hypot(a[0] - b[0], a[1] - b[1]) * (1 + ((i * 7 + j * 3) % 5) / 20))),
  )
}

function permutations(arr: number[]): number[][] {
  if (arr.length <= 1) return [arr]
  return arr.flatMap((x, i) => permutations([...arr.slice(0, i), ...arr.slice(i + 1)]).map((p) => [x, ...p]))
}

function bruteForce(matrix: number[][], end: EndRule): number {
  const n = matrix.length
  const stops = end === 'fixed' ? [...Array(n - 2).keys()].map((i) => i + 1) : [...Array(n - 1).keys()].map((i) => i + 1)
  return Math.min(...permutations(stops).map((p) => pathCost(matrix, closePath(p, end, n))))
}

describe('optimizeOrder', () => {
  for (const end of ['fixed', 'roundtrip', 'free'] as EndRule[]) {
    it(`encontra o ótimo exato (${end})`, () => {
      for (let seed = 1; seed <= 15; seed++) {
        const m = randomMatrix(7, seed)
        const order = optimizeOrder(m, end)
        expect(pathCost(m, closePath(order, end, m.length))).toBeCloseTo(bruteForce(m, end), 6)
      }
    })
  }

  it('visita cada parada exatamente uma vez com heurística (muitas paradas)', () => {
    const m = randomMatrix(26, 42)
    for (const end of ['fixed', 'roundtrip', 'free'] as EndRule[]) {
      const order = optimizeOrder(m, end)
      const expected = end === 'fixed' ? 24 : 25
      expect(new Set(order).size).toBe(expected)
      expect(order).not.toContain(0)
      if (end === 'fixed') expect(order).not.toContain(25)
    }
  })

  it('heurística não piora a ordem digitada', () => {
    const m = randomMatrix(22, 7)
    const typed = [...Array(20).keys()].map((i) => i + 1)
    const order = optimizeOrder(m, 'fixed')
    expect(pathCost(m, closePath(order, 'fixed', 22))).toBeLessThanOrEqual(pathCost(m, closePath(typed, 'fixed', 22)))
  })

  it('lida com zero ou uma parada', () => {
    expect(optimizeOrder([[0, 1], [1, 0]], 'fixed')).toEqual([])
    expect(optimizeOrder([[0, 1], [1, 0]], 'free')).toEqual([1])
  })
})
