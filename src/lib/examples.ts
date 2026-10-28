import type { Criterion, EndMode, Place } from '../types'

export interface Example {
  title: string
  subtitle: string
  icon: 'city' | 'coast' | 'road'
  origin: Place
  stops: Place[]
  destination: Place | null
  endMode: EndMode
  criterion: Criterion
}

const p = (label: string, lat: number, lon: number, kind = 'local'): Place => ({ label, lat, lon, kind })

export const EXAMPLES: Example[] = [
  {
    title: 'Centro, Paulista e Ibirapuera fora de ordem',
    subtitle: 'Exemplo · 5 paradas · volta à partida',
    icon: 'city',
    origin: p('Praça da Sé, Sé, São Paulo, SP', -23.5503, -46.6339),
    stops: [
      p('Parque Ibirapuera, Vila Mariana, São Paulo, SP', -23.5874, -46.6576),
      p('Mercado Municipal, Centro, São Paulo, SP', -23.5418, -46.6293),
      p('MASP, Avenida Paulista, São Paulo, SP', -23.5614, -46.6559),
      p('Museu do Ipiranga, Ipiranga, São Paulo, SP', -23.5855, -46.6097),
      p('Pinacoteca, Luz, São Paulo, SP', -23.5342, -46.6339),
    ],
    destination: null,
    endMode: 'roundtrip',
    criterion: 'duration',
  },
  {
    title: 'São Paulo → Santos, descendo a serra',
    subtitle: 'Exemplo · 2 paradas · destino fixo',
    icon: 'coast',
    origin: p('Praça da Sé, Sé, São Paulo, SP', -23.5503, -46.6339),
    stops: [p('Cubatão, SP', -23.8951, -46.4253, 'cidade'), p('São Bernardo do Campo, SP', -23.6914, -46.5646, 'cidade')],
    destination: p('Gonzaga, Santos, SP', -23.9677, -46.3336, 'bairro'),
    endMode: 'fixed',
    criterion: 'duration',
  },
  {
    title: 'Interior paulista até Ribeirão Preto',
    subtitle: 'Exemplo · 2 paradas · destino fixo',
    icon: 'road',
    origin: p('São Paulo, SP', -23.5505, -46.6333, 'cidade'),
    stops: [p('Indaiatuba, SP', -23.0904, -47.2181, 'cidade'), p('Campinas, SP', -22.9056, -47.0608, 'cidade')],
    destination: p('Ribeirão Preto, SP', -21.1775, -47.8103, 'cidade'),
    endMode: 'fixed',
    criterion: 'duration',
  },
]
