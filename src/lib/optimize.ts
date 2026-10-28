/**
 * Otimizador de sequência de paradas (problema do caixeiro viajante com extremos).
 * Trabalha sobre uma matriz de custo assimétrica (tempo ou distância de A para B).
 *
 * Índice 0 é sempre a partida. Os demais índices são paradas, exceto quando
 * `end` é 'fixed': o último índice da matriz é o destino.
 */
export type EndRule = 'fixed' | 'roundtrip' | 'free'

/** Até este número de paradas o resultado é exato (programação dinâmica) */
export const EXACT_LIMIT = 12

export function pathCost(matrix: number[][], path: number[]): number {
  let total = 0
  for (let i = 0; i < path.length - 1; i++) total += matrix[path[i]][path[i + 1]]
  return total
}

/** Monta o caminho completo (partida, paradas, fim) para a regra de fim escolhida */
export function closePath(order: number[], end: EndRule, n: number): number[] {
  if (end === 'fixed') return [0, ...order, n - 1]
  if (end === 'roundtrip') return [0, ...order, 0]
  return [0, ...order]
}

/** Retorna a melhor ordem dos índices de paradas (sem partida e destino) */
export function optimizeOrder(matrix: number[][], end: EndRule): number[] {
  const n = matrix.length
  const stops = end === 'fixed' ? range(1, n - 1) : range(1, n)
  if (stops.length <= 1) return stops
  if (stops.length <= EXACT_LIMIT) return heldKarp(matrix, stops, end)
  return heuristic(matrix, stops, end)
}

function range(from: number, to: number): number[] {
  return Array.from({ length: Math.max(0, to - from) }, (_, i) => from + i)
}

function closingCost(matrix: number[][], last: number, end: EndRule): number {
  const n = matrix.length
  if (end === 'fixed') return matrix[last][n - 1]
  if (end === 'roundtrip') return matrix[last][0]
  return 0
}

function heldKarp(matrix: number[][], stops: number[], end: EndRule): number[] {
  const m = stops.length
  const full = 1 << m
  const dp = new Float64Array(full * m).fill(Infinity)
  const parent = new Int8Array(full * m).fill(-1)
  for (let j = 0; j < m; j++) dp[(1 << j) * m + j] = matrix[0][stops[j]]

  for (let mask = 1; mask < full; mask++) {
    for (let j = 0; j < m; j++) {
      const cur = dp[mask * m + j]
      if (!(mask & (1 << j)) || cur === Infinity) continue
      for (let k = 0; k < m; k++) {
        if (mask & (1 << k)) continue
        const next = mask | (1 << k)
        const cost = cur + matrix[stops[j]][stops[k]]
        if (cost < dp[next * m + k]) {
          dp[next * m + k] = cost
          parent[next * m + k] = j
        }
      }
    }
  }

  let best = Infinity
  let last = 0
  for (let j = 0; j < m; j++) {
    const cost = dp[(full - 1) * m + j] + closingCost(matrix, stops[j], end)
    if (cost < best) {
      best = cost
      last = j
    }
  }

  const order: number[] = []
  let mask = full - 1
  let j = last
  while (j !== -1) {
    order.push(stops[j])
    const p = parent[mask * m + j]
    mask &= ~(1 << j)
    j = p
  }
  return order.reverse()
}

/** Vizinho mais próximo + melhorias locais (2-opt e or-opt), com reinícios */
function heuristic(matrix: number[][], stops: number[], end: EndRule): number[] {
  const n = matrix.length
  const cost = (order: number[]) => pathCost(matrix, closePath(order, end, n))
  let best: number[] = []
  let bestCost = Infinity

  for (const first of stops) {
    const remaining = new Set(stops)
    const order = [first]
    remaining.delete(first)
    while (remaining.size) {
      const from = order[order.length - 1]
      let next = -1
      for (const c of remaining) if (next === -1 || matrix[from][c] < matrix[from][next]) next = c
      order.push(next)
      remaining.delete(next)
    }
    const improved = localSearch(order, cost)
    const c = cost(improved)
    if (c < bestCost) {
      bestCost = c
      best = improved
    }
  }
  return best
}

function localSearch(start: number[], cost: (o: number[]) => number): number[] {
  let order = start
  let current = cost(order)
  let improved = true
  while (improved) {
    improved = false
    // 2-opt: inverte um trecho
    for (let i = 0; i < order.length - 1; i++) {
      for (let k = i + 1; k < order.length; k++) {
        const cand = [...order.slice(0, i), ...order.slice(i, k + 1).reverse(), ...order.slice(k + 1)]
        const c = cost(cand)
        if (c < current - 1e-9) {
          order = cand
          current = c
          improved = true
        }
      }
    }
    // or-opt: move blocos de 1 a 3 paradas para outra posição
    for (let len = 1; len <= 3; len++) {
      for (let i = 0; i + len <= order.length; i++) {
        const block = order.slice(i, i + len)
        const rest = [...order.slice(0, i), ...order.slice(i + len)]
        for (let p = 0; p <= rest.length; p++) {
          if (p === i) continue
          const cand = [...rest.slice(0, p), ...block, ...rest.slice(p)]
          const c = cost(cand)
          if (c < current - 1e-9) {
            order = cand
            current = c
            improved = true
          }
        }
      }
    }
  }
  return order
}
