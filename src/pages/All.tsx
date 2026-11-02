import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { formatNumber, plural, useManifest } from '@/lib/content'
import { usePageTitle } from '@/lib/usePageTitle'
import type { Kind } from '@/types'

const KIND_OPTIONS: Array<{ value: Kind | null; label: string }> = [
  { value: null, label: 'Всё' },
  { value: 'concept', label: 'Концепции' },
  { value: 'entity', label: 'Сущности' },
]

const LETTER_ORDER = 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ'

export default function All() {
  const { manifest, entries } = useManifest()
  usePageTitle('Указатель')
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState('')

  const rawKind = params.get('kind')
  const kind: Kind | null = rawKind === 'concept' || rawKind === 'entity' ? rawKind : null
  const letter = params.get('letter')

  function update(key: string, value: string | null) {
    const next = new URLSearchParams(params)
    if (!value) next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }

  const kindEntries = useMemo(
    () => (kind ? entries.filter((entry) => entry.kind === kind) : entries),
    [entries, kind],
  )

  const letters = useMemo(() => {
    const counts = new Map<string, number>()
    for (const entry of kindEntries) counts.set(entry.letter, (counts.get(entry.letter) ?? 0) + 1)
    const order = (letter: string) => {
      const index = LETTER_ORDER.indexOf(letter)
      return index === -1 ? LETTER_ORDER.length : index
    }
    return [...counts.entries()].sort((a, b) => order(a[0]) - order(b[0]))
  }, [kindEntries])

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase().replace(/ё/g, 'е')
    return kindEntries.filter((entry) => {
      if (letter && entry.letter !== letter) return false
      if (!text) return true
      return `${entry.title} ${entry.summary}`.toLowerCase().replace(/ё/g, 'е').includes(text)
    })
  }, [kindEntries, letter, query])

  const groups = useMemo(() => {
    const map = new Map<string, typeof filtered>()
    for (const entry of filtered) {
      const list = map.get(entry.letter) ?? []
      list.push(entry)
      map.set(entry.letter, list)
    }
    return [...map.entries()]
  }, [filtered])

  const totalLabel = `${formatNumber(filtered.length)} ${plural(filtered.length, 'статья', 'статьи', 'статей')}`

  return (
    <div>
      <header className="max-w-3xl">
        <p className="pill">Указатель</p>
        <h1 className="mt-4 font-serif text-4xl tracking-tight sm:text-5xl">Все статьи</h1>
        <p className="mt-3 font-serif text-[16px] leading-relaxed text-muted">
          {manifest ? (
            <>
              {formatNumber(manifest.stats.articles)} {plural(manifest.stats.articles, 'статья', 'статьи', 'статей')} словаря:{' '}
              {formatNumber(manifest.stats.concepts)} {plural(manifest.stats.concepts, 'концепция', 'концепции', 'концепций')} и{' '}
              {formatNumber(manifest.stats.entities)} {plural(manifest.stats.entities, 'сущность', 'сущности', 'сущностей')}.
            </>
          ) : (
            'Полный алфавитный перечень статей.'
          )}
        </p>
      </header>

      <div className="mt-8 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex h-11 flex-1 items-center gap-3 rounded-lg border border-line bg-surface px-3.5 focus-within:border-accent/60">
            <svg viewBox="0 0 24 24" className="size-4 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="11" cy="11" r="7" />
              <path d="m16.5 16.5 4 4" />
            </svg>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Фильтр по названию или определению"
              className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted/70"
              aria-label="Фильтр статей"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="text-muted hover:text-ink"
                aria-label="Очистить фильтр"
              >
                ×
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-line bg-surface p-1">
            {KIND_OPTIONS.map((option) => (
              <button
                key={option.label}
                type="button"
                onClick={() => update('kind', option.value)}
                className={`rounded-md px-3 py-1.5 text-[13px] transition-colors ${
                  kind === option.value ? 'bg-accent-soft text-accent' : 'text-muted hover:text-ink'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-line/70 bg-surface/60 p-2">
          <button
            type="button"
            onClick={() => update('letter', null)}
            className={`rounded px-2 py-1 text-[13px] transition-colors ${
              !letter ? 'bg-accent text-accent-ink' : 'text-muted hover:bg-line/40 hover:text-ink'
            }`}
          >
            Все
          </button>
          {letters.map(([value, count]) => (
            <button
              key={value}
              type="button"
              onClick={() => update('letter', value === letter ? null : value)}
              title={`${count} ${plural(count, 'статья', 'статьи', 'статей')}`}
              className={`flex min-w-7 items-baseline justify-center gap-1 rounded px-1.5 py-1 font-serif text-[15px] transition-colors ${
                value === letter
                  ? 'bg-accent text-accent-ink'
                  : 'text-muted hover:bg-line/40 hover:text-ink'
              }`}
            >
              {value}
              <span className="text-[9px] tabular-nums opacity-60">{count}</span>
            </button>
          ))}
        </div>

        <p className="text-[13px] text-muted">
          {totalLabel}
          {letter && <> на букву «{letter}»</>}
          {query && <> по запросу «{query}»</>}
          {(letter || query || kind) && (
            <button
              type="button"
              onClick={() => {
                setQuery('')
                setParams({}, { replace: true })
              }}
              className="ml-3 text-accent hover:underline"
            >
              Сбросить
            </button>
          )}
        </p>
      </div>

      <div className="mt-6 space-y-8">
        {groups.map(([groupLetter, items]) => (
          <section key={groupLetter} id={`letter-${groupLetter}`}>
            <div className="mb-2 flex items-center gap-3">
              <h2 className="font-serif text-3xl leading-none text-accent">{groupLetter}</h2>
              <span className="text-[11px] uppercase tracking-[0.12em] text-muted">
                {items.length} {plural(items.length, 'статья', 'статьи', 'статей')}
              </span>
              <span className="h-px flex-1 bg-line/70" />
            </div>

            <div className="divide-y divide-line/60 border-y border-line/60">
              {items.map((entry) => (
                <Link
                  key={entry.slug}
                  to={entry.kind === 'concept' ? `/k/${entry.slug}` : `/e/${entry.slug}`}
                  className="group flex flex-col gap-1 py-3 transition-colors hover:bg-accent-soft/25 sm:flex-row sm:items-baseline sm:gap-4 sm:px-2"
                >
                  <span className="flex min-w-0 items-baseline gap-2 sm:w-64 sm:shrink-0">
                    <span className="font-serif text-[16px] font-medium group-hover:text-accent">{entry.title}</span>
                    {entry.kind === 'entity' && (
                      <span className="rounded border border-line px-1 text-[9px] uppercase tracking-wide text-muted">
                        сущность
                      </span>
                    )}
                  </span>
                  <span className="line-clamp-2 min-w-0 flex-1 font-serif text-[13px] leading-snug text-muted">
                    {entry.summary}
                  </span>
                  <span className="hidden shrink-0 text-[11px] tabular-nums text-muted sm:block" title="Упоминаний в других статьях">
                    {entry.backlinks}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ))}

        {!filtered.length && manifest && (
          <div className="rounded-xl border border-dashed border-line px-6 py-12 text-center">
            <p className="font-serif text-lg">Ничего не найдено</p>
            <p className="mt-1 text-[13px] text-muted">Попробуйте изменить фильтр или сбросить его.</p>
          </div>
        )}

        {!manifest && (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-14 animate-pulse rounded-lg bg-line/30" />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
