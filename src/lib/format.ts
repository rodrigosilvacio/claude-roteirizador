const km = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })
const kmInt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters >= 100_000 ? kmInt : km).format(meters / 1000)} km`
}

export function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60)
  if (mins < 1) return 'menos de 1 min'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (!h) return `${m} min`
  return m ? `${h} h ${m} min` : `${h} h`
}

/** Divide "474 km" em número e unidade para os destaques visuais */
export function splitDistance(meters: number): [string, string] {
  const [value, unit] = formatDistance(meters).split(' ')
  return [value, unit]
}
