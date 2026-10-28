import { useEffect, useId, useRef, useState } from 'react'
import { Loader2, MapPin, X } from 'lucide-react'
import type { Place } from '../types'
import { COARSE_KINDS, searchPlaces } from '../lib/geocode'

interface Props {
  query: string
  place: Place | null
  badge: React.ReactNode
  placeholder: string
  bias?: { lat: number; lon: number }
  onQuery: (q: string) => void
  onPlace: (p: Place) => void
  onClear: () => void
  autoFocus?: boolean
}

export function AddressInput({ query, place, badge, placeholder, bias, onQuery, onPlace, onClear, autoFocus }: Props) {
  const [results, setResults] = useState<Place[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [active, setActive] = useState(0)
  const listId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const typed = useRef(false)

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
  }, [autoFocus])

  useEffect(() => {
    // só busca quando a pessoa digitou; preencher via exemplo ou mapa não abre sugestões
    if (!typed.current || place || query.trim().length < 3) {
      setResults([])
      setLoading(false)
      return
    }
    const ctrl = new AbortController()
    setLoading(true)
    const t = setTimeout(() => {
      searchPlaces(query.trim(), bias, ctrl.signal)
        .then((r) => {
          setResults(r)
          setActive(0)
          setError(r.length ? null : 'Nenhum endereço encontrado. Tente incluir cidade ou bairro.')
          setOpen(true)
        })
        .catch((e: Error) => {
          if (e.name !== 'AbortError') {
            setError(e.message)
            setOpen(true)
          }
        })
        .finally(() => setLoading(false))
    }, 350)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
    // bias muda pouco e não deve disparar nova busca sozinho
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, place])

  const choose = (p: Place) => {
    typed.current = false
    onPlace(p)
    setOpen(false)
    setResults([])
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (!open || !results.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => (a + 1) % results.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => (a - 1 + results.length) % results.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      choose(results[active])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const coarse = place?.kind && COARSE_KINDS.has(place.kind)

  return (
    <div className="relative">
      <div
        className={`flex items-center gap-3 rounded-xl border bg-paper-card px-2 py-1.5 transition focus-within:border-ink focus-within:ring-2 focus-within:ring-ink/15 ${
          coarse || place?.approximate ? 'border-sun' : 'border-paper-line'
        }`}
      >
        {badge}
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            typed.current = true
            onQuery(e.target.value)
          }}
          onKeyDown={onKey}
          onFocus={() => results.length && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent text-[15px] text-ink-deep placeholder:text-ink-soft/60 focus:outline-none"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
        />
        {loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-ink-soft" />}
        {query && (
          <button
            type="button"
            onClick={() => {
              typed.current = false
              onClear()
              inputRef.current?.focus()
            }}
            className="rounded-full p-1 text-ink-soft hover:bg-paper hover:text-ink"
            aria-label="Limpar endereço"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {coarse && (
        <p className="mt-1.5 text-xs text-[#9a6a1c]">
          Isto é um {place!.kind} inteiro: o ponto fica no centro geográfico, longe da capital. Prefira a cidade ou um endereço.
        </p>
      )}
      {open && (results.length > 0 || error) && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 z-[1000] mt-1 overflow-hidden rounded-xl border border-paper-line bg-white shadow-xl shadow-ink/10"
        >
          {error && !results.length && <li className="px-4 py-3 text-sm text-ink-soft">{error}</li>}
          {results.map((r, i) => {
            const [head, ...tail] = r.label.split(', ')
            return (
              <li
                key={`${r.label}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault()
                  choose(r)
                }}
                onMouseEnter={() => setActive(i)}
                className={`flex cursor-pointer items-start gap-3 px-3 py-2 text-sm ${i === active ? 'bg-paper' : ''}`}
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-ink-soft" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-ink-deep">{head}</div>
                  {tail.length > 0 && <div className="truncate text-sm text-ink-soft">{tail.join(', ')}</div>}
                </div>
                {r.kind && (
                  <span
                    className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 font-mono text-[11px] ${
                      COARSE_KINDS.has(r.kind) ? 'bg-sun-soft text-[#9a6a1c]' : 'bg-paper text-ink-soft'
                    }`}
                  >
                    {r.kind}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export function Badge({ tag, variant }: { tag: string; variant: 'origin' | 'stop' | 'dest' }) {
  const cls =
    variant === 'origin'
      ? 'bg-ink text-white'
      : variant === 'dest'
        ? 'bg-sun text-ink-deep'
        : 'border-2 border-ink bg-paper-card text-ink'
  return (
    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-xs font-semibold ${cls}`}>
      {tag}
    </span>
  )
}
