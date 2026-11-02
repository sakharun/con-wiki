import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { formatNumber, plural, useManifest } from '@/lib/content'
import { usePageTitle } from '@/lib/usePageTitle'

interface Props {
  onOpenSearch: () => void
}

function daySeed(length: number) {
  const now = new Date()
  const key = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`
  let hash = 0
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) % 100000
  return hash % length
}

export default function Home({ onOpenSearch }: Props) {
  const { manifest, entries } = useManifest()
  const navigate = useNavigate()
  usePageTitle()

  const letters = useMemo(() => {
    const counts = new Map<string, number>()
    for (const entry of entries) counts.set(entry.letter, (counts.get(entry.letter) ?? 0) + 1)
    return [...counts.entries()]
  }, [entries])

  const top = useMemo(
    () => [...entries].sort((a, b) => b.backlinks - a.backlinks).slice(0, 12),
    [entries],
  )

  const wordOfDay = useMemo(() => (entries.length ? entries[daySeed(entries.length)] : null), [entries])

  function randomWord() {
    if (!entries.length) return
    const entry = entries[Math.floor(Math.random() * entries.length)]
    navigate(entry.kind === 'concept' ? `/k/${entry.slug}` : `/e/${entry.slug}`)
  }

  return (
    <div className="space-y-12">
      <section className="relative overflow-hidden rounded-2xl border border-line/70 bg-surface px-6 py-10 sm:px-10 sm:py-14">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-16 select-none font-serif text-[16rem] leading-none text-accent/[0.06] sm:text-[22rem]"
        >
          С
        </div>
        <div className="relative max-w-3xl">
          <p className="pill">Словарь системы знаний</p>
          <h1 className="mt-5 font-serif text-4xl leading-[1.08] tracking-tight sm:text-5xl">
            Реконструктор Сознания
          </h1>
          <p className="mt-5 max-w-2xl font-serif text-[16px] leading-relaxed text-muted sm:text-[17px]">
            Толковый словарь понятий: устройство мира и сознания, механизмы системы саморегуляции,
            практики и источники. Каждая статья — определение, текущее понимание, доказательства и
            открытые вопросы.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={onOpenSearch}
              className="group flex h-12 items-center gap-3 rounded-lg border border-line bg-paper px-4 text-left text-[15px] text-muted transition-colors hover:border-accent/60 hover:text-ink sm:w-80"
            >
              <svg viewBox="0 0 24 24" className="size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="11" cy="11" r="7" />
                <path d="m16.5 16.5 4 4" />
              </svg>
              <span className="flex-1">Найти понятие…</span>
              <span className="kbd">Ctrl K</span>
            </button>
            <button
              type="button"
              onClick={randomWord}
              className="flex h-12 items-center justify-center gap-2 rounded-lg border border-line bg-surface px-5 text-[14px] font-medium text-ink transition-colors hover:border-accent/60 hover:bg-accent-soft/40"
            >
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path d="M4 7h3l3 10h3l3-10h3M4 17h3M17 7h3" />
              </svg>
              Случайное слово
            </button>
          </div>
        </div>

        {manifest && (
          <dl className="relative mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line/70 bg-line/60 sm:grid-cols-4">
            {[
              { label: 'статей', value: manifest.stats.articles },
              { label: 'концепций', value: manifest.stats.concepts },
              { label: 'сущностей', value: manifest.stats.entities },
              { label: 'связей', value: manifest.stats.edges },
            ].map((item) => (
              <div key={item.label} className="bg-surface px-4 py-3">
                <dt className="text-[11px] uppercase tracking-[0.1em] text-muted">{item.label}</dt>
                <dd className="mt-1 font-serif text-2xl font-medium">{formatNumber(item.value)}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      <section>
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="font-serif text-2xl">Алфавит</h2>
            <p className="mt-1 text-[13px] text-muted">Перейти к словам на нужную букву</p>
          </div>
          <Link to="/all" className="text-[13px] text-accent hover:underline">
            Весь указатель →
          </Link>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {letters.map(([letter, count]) => (
            <Link
              key={letter}
              to={`/all?letter=${encodeURIComponent(letter)}`}
              className="group flex items-baseline gap-2 rounded-lg border border-line/80 bg-surface px-3.5 py-2 transition-colors hover:border-accent/60 hover:bg-accent-soft/40"
            >
              <span className="font-serif text-lg font-medium">{letter}</span>
              <span className="text-[11px] tabular-nums text-muted">{count}</span>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section>
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="font-serif text-2xl">Опорные понятия</h2>
              <p className="mt-1 text-[13px] text-muted">На них чаще всего ссылаются другие статьи</p>
            </div>
            <Link to="/all" className="text-[13px] text-accent hover:underline">
              Все статьи →
            </Link>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {top.map((entry) => (
              <Link
                key={entry.slug}
                to={entry.kind === 'concept' ? `/k/${entry.slug}` : `/e/${entry.slug}`}
                className="card card-hover group flex flex-col gap-2 px-4 py-3.5"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-serif text-[17px] font-medium group-hover:text-accent">{entry.title}</span>
                  <span className="text-[10px] uppercase tracking-[0.1em] text-muted">
                    {entry.kind === 'concept' ? 'концепция' : 'сущность'}
                  </span>
                </span>
                <span className="line-clamp-2 font-serif text-[13px] leading-snug text-muted">{entry.summary}</span>
                <span className="mt-auto pt-1 text-[11px] text-muted">
                  {entry.backlinks} {plural(entry.backlinks, 'ссылка', 'ссылки', 'ссылок')}
                </span>
              </Link>
            ))}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="card px-5 py-5">
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted">Слово дня</p>
            {wordOfDay ? (
              <>
                <Link
                  to={wordOfDay.kind === 'concept' ? `/k/${wordOfDay.slug}` : `/e/${wordOfDay.slug}`}
                  className="mt-2 block font-serif text-2xl font-medium hover:text-accent"
                >
                  {wordOfDay.title}
                </Link>
                <p className="mt-2 font-serif text-[14px] leading-relaxed text-muted">{wordOfDay.summary}</p>
                <Link
                  to={wordOfDay.kind === 'concept' ? `/k/${wordOfDay.slug}` : `/e/${wordOfDay.slug}`}
                  className="mt-4 inline-flex text-[13px] text-accent hover:underline"
                >
                  Читать статью →
                </Link>
              </>
            ) : (
              <div className="mt-3 h-20 animate-pulse rounded bg-line/40" />
            )}
          </section>

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <Link to="/all?kind=concept" className="card card-hover px-5 py-4">
              <p className="font-serif text-lg">Концепции</p>
              <p className="mt-1 text-[13px] text-muted">
                {manifest ? formatNumber(manifest.stats.concepts) : '—'} понятий системы
              </p>
            </Link>
            <Link to="/all?kind=entity" className="card card-hover px-5 py-4">
              <p className="font-serif text-lg">Сущности</p>
              <p className="mt-1 text-[13px] text-muted">
                {manifest ? formatNumber(manifest.stats.entities) : '—'} участников и структур
              </p>
            </Link>
            <Link to="/graph" className="card card-hover px-5 py-4">
              <p className="font-serif text-lg">Граф связей</p>
              <p className="mt-1 text-[13px] text-muted">
                {manifest ? formatNumber(manifest.stats.edges) : '—'} связей между понятиями
              </p>
            </Link>
          </section>
        </aside>
      </div>
    </div>
  )
}
