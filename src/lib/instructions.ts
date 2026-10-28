/** Converte manobras do OSRM em instruções em português, no tom de um copiloto */

export interface OsrmStep {
  name: string
  ref?: string
  destinations?: string
  exits?: string
  distance: number
  duration: number
  /** Classes da via após cada cruzamento (toll, ferry, motorway...) */
  intersections?: { classes?: string[] }[]
  maneuver: {
    type: string
    modifier?: string
    exit?: number
    bearing_after?: number
    location: [number, number]
  }
}

const SIDE: Record<string, string> = {
  uturn: 'em retorno',
  'sharp right': 'acentuadamente à direita',
  right: 'à direita',
  'slight right': 'levemente à direita',
  straight: 'em frente',
  'slight left': 'levemente à esquerda',
  left: 'à esquerda',
  'sharp left': 'acentuadamente à esquerda',
}

const KEEP: Record<string, string> = {
  'slight right': 'à direita',
  right: 'à direita',
  'sharp right': 'à direita',
  'slight left': 'à esquerda',
  left: 'à esquerda',
  'sharp left': 'à esquerda',
  straight: 'em frente',
}

const MASCULINE = /^(viaduto|túnel|tunel|largo|acesso|anel|complexo|elevado|trevo|contorno|corredor|rodoanel|minianel|parque|caminho|beco|retorno|boulevard|bulevar|passeio|cais|morro|jardim|eixo|ramal|lote|condomínio|loteamento)\b/i

const CARDINAL = ['norte', 'nordeste', 'leste', 'sudeste', 'sul', 'sudoeste', 'oeste', 'noroeste']

export function roadName(step: Pick<OsrmStep, 'name' | 'ref'>): string {
  const name = step.name?.trim()
  const ref = step.ref?.split(';')[0]?.trim()
  if (name && ref && !name.includes(ref)) return `${name} (${ref})`
  return name || ref || ''
}

/** "na Rua X", "no Viaduto Y": escolhe o artigo pelo tipo de via */
function prep(road: string, kind: 'em' | 'por'): string {
  const masc = MASCULINE.test(road)
  if (kind === 'em') return `${masc ? 'no' : 'na'} ${road}`
  return `${masc ? 'pelo' : 'pela'} ${road}`
}

function ordinal(n: number): string {
  return `${n}ª`
}

function cardinal(bearing?: number): string | undefined {
  if (bearing === undefined) return undefined
  return CARDINAL[Math.round(bearing / 45) % 8]
}

function towards(step: OsrmStep): string {
  const dest = step.destinations?.split(',').slice(0, 3).join(',').trim()
  return dest ? `, sentido ${dest}` : ''
}

export function describeStep(step: OsrmStep, arrivalLabel?: string): string {
  const { type, modifier = 'straight', exit } = step.maneuver
  const road = roadName(step)
  const side = SIDE[modifier] ?? ''
  const onRoad = road ? ` ${prep(road, 'em')}` : ''
  const byRoad = road ? ` ${prep(road, 'por')}` : ''

  switch (type) {
    case 'depart': {
      const dir = cardinal(step.maneuver.bearing_after)
      return `Siga${dir ? ` sentido ${dir}` : ''}${byRoad}`
    }
    case 'arrive': {
      const where = arrivalLabel ? `Chegada em ${arrivalLabel}` : 'Chegada ao destino'
      if (modifier.includes('right')) return `${where}, à direita`
      if (modifier.includes('left')) return `${where}, à esquerda`
      return where
    }
    case 'turn':
      if (modifier === 'uturn') return `Faça o retorno${byRoad}`
      if (modifier === 'straight') return `Siga em frente${byRoad}`
      return `Vire ${side}${onRoad}`
    case 'new name':
      return `Continue${byRoad}`
    case 'continue':
      if (modifier === 'uturn') return `Faça o retorno${byRoad}`
      return modifier === 'straight' ? `Continue em frente${byRoad}` : `Mantenha-se ${side}${byRoad}`
    case 'merge':
      return `Entre ${side === 'em frente' ? '' : `${side} `}${road ? prep(road, 'em') : 'na via'}`.replace('  ', ' ')
    case 'on ramp':
      return `Pegue o acesso ${side === 'em frente' ? '' : `${side} `}${road ? `para ${road}` : ''}${towards(step)}`.trim()
    case 'off ramp': {
      const num = step.exits ? ` ${step.exits.split(';')[0]}` : ''
      return `Pegue a saída${num} ${KEEP[modifier] ?? ''}${towards(step) || (road ? ` para ${road}` : '')}`.replace(/\s+/g, ' ').trim()
    }
    case 'fork':
      return `Na bifurcação, mantenha-se ${KEEP[modifier] ?? 'em frente'}${byRoad}${road ? '' : towards(step)}`
    case 'end of road':
      return `No fim da via, vire ${side}${onRoad}`
    case 'roundabout':
    case 'rotary':
      return exit ? `Na rotatória, pegue a ${ordinal(exit)} saída${byRoad}` : `Entre na rotatória${byRoad ? ` e siga${byRoad}` : ''}`
    case 'roundabout turn':
      return `Na rotatória, vire ${side}${onRoad}`
    case 'exit roundabout':
    case 'exit rotary':
      return `Saia da rotatória${byRoad}`
    default:
      return road ? `Continue${byRoad}` : 'Continue'
  }
}
