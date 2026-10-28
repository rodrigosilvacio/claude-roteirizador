import { describe, expect, it } from 'vitest'
import { describeStep, type OsrmStep } from './instructions'

const step = (maneuver: Partial<OsrmStep['maneuver']>, extra: Partial<OsrmStep> = {}): OsrmStep => ({
  name: '',
  distance: 100,
  duration: 10,
  ...extra,
  maneuver: { type: 'turn', location: [0, 0], ...maneuver },
})

describe('describeStep', () => {
  it('escreve curvas com artigo correto', () => {
    expect(describeStep(step({ modifier: 'right' }, { name: 'Rua Augusta' }))).toBe('Vire à direita na Rua Augusta')
    expect(describeStep(step({ modifier: 'left' }, { name: 'Viaduto do Chá' }))).toBe('Vire à esquerda no Viaduto do Chá')
  })

  it('inclui código da rodovia e sentido em saídas', () => {
    expect(describeStep(step({ type: 'fork', modifier: 'slight left' }, { name: 'Rodovia Anhanguera', ref: 'SP-330' }))).toBe(
      'Na bifurcação, mantenha-se à esquerda pela Rodovia Anhanguera (SP-330)',
    )
    expect(describeStep(step({ type: 'off ramp', modifier: 'slight right' }, { destinations: 'Campinas, Limeira', exits: '98' }))).toBe(
      'Pegue a saída 98 à direita, sentido Campinas, Limeira',
    )
  })

  it('descreve partida, rotatória e chegada', () => {
    expect(describeStep(step({ type: 'depart', bearing_after: 180 }, { name: 'Avenida Paulista' }))).toBe('Siga sentido sul pela Avenida Paulista')
    expect(describeStep(step({ type: 'roundabout', exit: 2 }, { name: 'Rua B' }))).toBe('Na rotatória, pegue a 2ª saída pela Rua B')
    expect(describeStep(step({ type: 'arrive', modifier: 'left' }), 'Campinas')).toBe('Chegada em Campinas, à esquerda')
  })
})

describe('classShare', async () => {
  const { classShare } = await import('./osrm')
  it('calcula a fração do passo em via pedagiada', () => {
    expect(classShare({ intersections: [{ classes: ['toll', 'motorway'] }, { classes: ['motorway'] }] }, 'toll')).toBe(0.5)
    expect(classShare({ intersections: [{}] }, 'toll')).toBe(0)
    expect(classShare({}, 'toll')).toBe(0)
  })
})
