import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Kind } from '@/types'
import { articlePath, getRecent, pushRecent, plural, useManifest } from '@/lib/content'
import { searchFull, searchLite, type SearchHit } from '@/lib/search'

interface Props {
  open: boolean
  onClose: () => void
}

interface Row {
  slug: string
  kind: Kind
  title: string
  summary?: string
}

function KindDot({ kind }: { kind: Kind }) {
  return (
    <span
      className={`mt-[7px] size-1.5 shrink-0 rounded-full ${kind === 'concept' ? 'bg-accent' : 'bg-emerald-600/70 dark:bg-emerald-400/70'}`}
      title={kind === 'concept' ? 'Концепция' : 'Сущность'}
    />
  )
}

function PaletteDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const { manifest, bySlug } = useManifest()
  const [query, setQuery] = useState('')
  const [deep, setDeep] = useState(false)
  const [hits, setHits] = useState<SearchHit[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  const fallback = useMemo<Row[]>(() => {
    const recent = getRecent()
      .map((slug) => bySlug(slug))
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      .slice(0, 4)
    const top = [...(manifest?.entries ?? [])]
      .sort((a, b) => b.backlinks - a.backlinks)
      .slice(0, 6)
    const seen = new Set(recent.map((entry) => entry.slug))
    return [
      ...recent.map((entry) => ({ slug: entry.slug, kind: entry.kind, title: entry.title, summary: entry.summary })),
      ...top
        .filter((entry) => !seen.has(entry.slug))
        .map((entry) => ({ slug: entry.slug, kind: entry.kind, title: entry.title, summary: entry.summary })),
    ]
  }, [manifest, bySlug])

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setHits([])
      setLoading(false)
      setError('')
      return
    }

    let alive = true
    setLoading(true)
    setError('')
    const timer = window.setTimeout(() => {
      const run = deep ? searchFull : searchLite
      run(trimmed, deep ? 20 : 12)
        .then((results) => {
          if (!alive) return
          setHits(results)
          setActive(0)
        })
        .catch(() => {
          if (!alive) return
          setHits([])
          setError(deep ? 'Не удалось загрузить полный индекс. Попробуйте ещё раз.' : 'Поиск недоступен.')
        })
        .finally(() => {
          if (alive) setLoading(false)
        })
    }, 140)

    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [query, deep])

  const rows: Row[] = query.trim().length >= 2 ? hits : fallback

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  function choose(row: Row | undefined) {
    if (!row) return
    pushRecent(row.slug)
    onClose()
    navigate(articlePath(row.kind, row.slug))
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((index) => (rows.length ? (index + 1) % rows.length : 0))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((index) => (rows.length ? (index - 1 + rows.length) % rows.length : 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      choose(rows[active])
    } else if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink/35 px-4 pt-[8vh] backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        className="fade-in flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Поиск по словарю"
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-3 border-b border-line/70 px-4 py-3">
          <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="11" cy="11" r="7" />
            <path d="m16.5 16.5 4 4" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Воля, свобода, траектория…"
            className="palette-input min-w-0 flex-1 bg-transparent text-[17px] text-ink outline-none placeholder:text-muted/70 focus-visible:outline-none"
            aria-label="Поисковый запрос"
            spellCheck={false}
          />
          {loading && <span className="size-4 animate-spin rounded-full border-2 border-line border-t-accent" />}
          <button type="button" onClick={onClose} className="kbd hover:border-accent/60" aria-label="Закрыть поиск">
            Esc
          </button>
        </div>

        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
          {query.trim().length >= 2 && (
            <p className="px-2 pb-1 pt-2 text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
              {error ? 'Ошибка' : loading ? 'Ищу…' : `${rows.length} ${plural(rows.length, 'результат', 'результата', 'результатов')}`}
            </p>
          )}

          {query.trim().length < 2 && fallback.length > 0 && (
            <p className="px-2 pb-1 pt-2 text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
              {getRecent().length ? 'Недавние и опорные понятия' : 'Опорные понятия'}
            </p>
          )}

          {rows.map((row, index) => (
            <button
              key={`${row.kind}-${row.slug}`}
              type="button"
              data-index={index}
              onMouseEnter={() => setActive(index)}
              onClick={() => choose(row)}
              className={`flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                index === active ? 'bg-accent-soft' : 'hover:bg-line/25'
              }`}
            >
              <KindDot kind={row.kind} />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-serif text-[15px] font-medium text-ink">{row.title}</span>
                  <span className="text-[10px] uppercase tracking-[0.1em] text-muted">
                    {row.kind === 'concept' ? 'концепция' : 'сущность'}
                  </span>
                </span>
                {row.summary && (
                  <span className="mt-0.5 line-clamp-2 font-serif text-[13px] leading-snug text-muted">
                    {row.summary}
                  </span>
                )}
              </span>
              {index === active && (
                <svg viewBox="0 0 24 24" className="mt-1 size-4 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              )}
            </button>
          ))}

          {query.trim().length >= 2 && !loading && !rows.length && !error && (
            <div className="px-3 py-8 text-center">
              <p className="font-serif text-[15px] text-ink">Ничего не найдено</p>
              <p className="mt-1 text-[13px] text-muted">
                Попробуйте другое слово{deep ? '' : ' или включите поиск по всему тексту'}.
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line/70 bg-paper/60 px-4 py-2.5 text-[12px] text-muted">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="kbd">↑</span>
              <span className="kbd">↓</span>
              выбор
            </span>
            <span className="flex items-center gap-1">
              <span className="kbd">Enter</span>
              открыть
            </span>
          </div>
          <button
            type="button"
            onClick={() => setDeep((value) => !value)}
            className={`rounded-md border px-2.5 py-1 text-[12px] transition-colors ${
              deep
                ? 'border-accent/60 bg-accent-soft text-accent'
                : 'border-line bg-surface text-muted hover:border-accent/50 hover:text-ink'
            }`}
          >
            {deep ? 'Глубокий поиск: вкл' : 'Глубокий поиск: выкл'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function SearchPalette({ open, onClose }: Props) {
  if (!open) return null
  return <PaletteDialog onClose={onClose} />
}
