import { describe, expect, it } from 'vitest'
import { decodePlan, encodePlan, googleMapsLinks } from './share'

const pts = (n: number) => Array.from({ length: n }, (_, i) => ({ label: `P${i}`, lat: -23 - i / 100, lon: -46 }))

describe('googleMapsLinks', () => {
  it('gera um link só até 9 paradas intermediárias', () => {
    const links = googleMapsLinks(pts(11))
    expect(links).toHaveLength(1)
    expect(new URL(links[0]).searchParams.get('waypoints')!.split('|')).toHaveLength(9)
  })

  it('divide rotas maiores encadeando o fim de uma parte no início da outra', () => {
    const links = googleMapsLinks(pts(15)).map((l) => new URL(l).searchParams)
    expect(links).toHaveLength(2)
    expect(links[1].get('origin')).toBe(links[0].get('destination'))
    expect(links[1].get('destination')).toBe('-23.140000,-46.000000')
  })
})

describe('encodePlan', () => {
  it('ida e volta preservando acentos', () => {
    const code = encodePlan({ label: 'São Paulo', lat: -23.5, lon: -46.6 }, [null], { label: 'Ribeirão Preto', lat: -21.1, lon: -47.8 }, 'fixed', 'duration')
    const plan = decodePlan(code)!
    expect(plan.o![0]).toBe('São Paulo')
    expect(plan.d![0]).toBe('Ribeirão Preto')
    expect(plan.s).toEqual([null])
  })

  it('ignora códigos inválidos', () => {
    expect(decodePlan('%%%')).toBeNull()
  })
})
