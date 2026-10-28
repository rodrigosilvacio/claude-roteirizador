import { useEffect, useState } from 'react'
import { parseNumber } from '../lib/cost'

const fmt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 })

export function NumberField({
  label,
  value,
  onChange,
  placeholder,
  allowEmpty,
  prefix,
  suffix,
  invalid,
  id,
  hideLabel,
}: {
  label: string
  prefix?: string
  suffix?: string
  invalid?: boolean
  id?: string
  /** Mantém o rótulo só para leitores de tela */
  hideLabel?: boolean
  value: number | null
  onChange: (v: number | null) => void
  placeholder?: string
  allowEmpty?: boolean
}) {
  // texto local para permitir digitar "6," sem o campo pular
  const [text, setText] = useState(value === null ? '' : fmt.format(value))
  useEffect(() => {
    const parsed = parseNumber(text)
    if (parsed !== value) setText(value === null ? '' : fmt.format(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  return (
    <label className="grid gap-1">
      <span className={hideLabel ? 'sr-only' : 'text-sm text-ink-soft'}>{label}</span>
      <span
        className={`flex items-center gap-1.5 rounded-xl border bg-white px-3 py-2 focus-within:border-ink ${invalid ? 'border-sun' : 'border-paper-line'}`}
      >
        {prefix && <span className="font-mono text-xs text-ink-soft">{prefix}</span>}
        <input
          id={id}
          inputMode="decimal"
        value={text}
        placeholder={placeholder}
        onChange={(e) => {
          setText(e.target.value)
          const n = parseNumber(e.target.value)
          if (n !== null && n >= 0) onChange(n)
          else if (!e.target.value.trim() && allowEmpty) onChange(null)
        }}
          aria-invalid={invalid || undefined}
          className="w-full min-w-0 bg-transparent font-mono text-ink-deep placeholder:font-sans placeholder:text-xs placeholder:text-ink-soft/70 focus:outline-none"
        />
        {suffix && <span className="shrink-0 font-mono text-xs text-ink-soft">{suffix}</span>}
      </span>
    </label>
  )
}
