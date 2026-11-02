import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import type { Article as ArticleType, Kind } from '@/types'
import {
  BASE,
  KIND_LABEL,
  KIND_PLURAL,
  articlePath,
  formatNumber,
  loadArticle,
  plural,
  pushRecent,
  useManifest,
} from '@/lib/content'
import ArticleBody from '@/components/ArticleBody'
import SidePanel from '@/components/SidePanel'

const BASE_TITLE = 'Словарь — Реконструктор Сознания'

export default function Article({ kind }: { kind: Kind }) {
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { entries, manifest } = useManifest()
  const [article, setArticle] = useState<ArticleType | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let alive = true
    setArticle(null)
    setError(false)

    loadArticle(slug)
      .then((data) => {
        if (!alive) return
        setArticle(data)
        pushRecent(data.slug)
        document.title = `${data.title} — Словарь`
      })
      .catch(() => {
        if (!alive) return
        setError(true)
      })

    return () => {
      alive = false
      document.title = BASE_TITLE
    }
  }, [slug])

  useEffect(() => {
    if (!article || !location.hash) return
    const id = decodeURIComponent(location.hash.slice(1))
    const timer = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 60)
    return () => window.clearTimeout(timer)
  }, [article, location.hash])

  const position = useMemo(() => entries.findIndex((entry) => entry.slug === slug), [entries, slug])
  const previous = position > 0 ? entries[position - 1] : null
  const next = position >= 0 && position < entries.length - 1 ? entries[position + 1] : null

  const summaryHtml = useMemo(
    () => article?.summaryHtml.replaceAll('{{BASE}}', BASE.replace(/\/$/, '')) ?? '',
    [article],
  )

  if (error) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <p className="text-[11px] uppercase tracking-[0.16em] text-muted">404</p>
        <h1 className="mt-3 font-serif text-3xl">Статья не найдена</h1>
        <p className="mt-3 text-[14px] text-muted">
          Возможно, ссылка устарела или понятие переименовали.
        </p>
        <Link
          to="/all"
          className="mt-6 inline-flex rounded-lg border border-line bg-surface px-4 py-2 text-[14px] transition-colors hover:border-accent/60"
        >
          К указателю
        </Link>
      </div>
    )
  }

  if (!article) {
    return (
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="max-w-[72ch] space-y-5">
          <div className="h-4 w-40 animate-pulse rounded bg-line/40" />
          <div className="h-12 w-2/3 animate-pulse rounded bg-line/40" />
          <div className="h-32 animate-pulse rounded-xl bg-line/30" />
          <div className="h-64 animate-pulse rounded-xl bg-line/20" />
        </div>
        <div className="hidden lg:block">
          <div className="h-40 animate-pulse rounded-xl bg-line/20" />
        </div>
      </div>
    )
  }

  const internalLinks = article.links.filter(
    (link) => link.slug && (link.kind === 'concept' || link.kind === 'entity'),
  ).length

  return (
    <div className="fade-in">
      <nav aria-label="Хлебные крошки" className="flex flex-wrap items-center gap-2 text-[12px] text-muted">
        <Link to="/" className="transition-colors hover:text-ink">
          Словарь
        </Link>
        <span aria-hidden>/</span>
        <Link to={`/all?kind=${kind}`} className="transition-colors hover:text-ink">
          {KIND_PLURAL[article.kind]}
        </Link>
        <span aria-hidden>/</span>
        <span className="text-ink/70">{article.title}</span>
      </nav>

      <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1fr)_280px]">
        <article className="min-w-0 max-w-[72ch]">
          <header>
            <div className="flex flex-wrap items-center gap-3">
              <span className="pill border-accent/30 bg-accent-soft/60 text-accent">{KIND_LABEL[article.kind]}</span>
              <span className="text-[11px] uppercase tracking-[0.12em] text-muted">
                буква {article.letter}
              </span>
            </div>
            <h1 className="mt-4 font-serif text-4xl leading-[1.1] tracking-tight sm:text-[2.9rem]">
              {article.title}
            </h1>
            <p className="mt-3 text-[12px] text-muted">
              {formatNumber(article.words)} {plural(article.words, 'слово', 'слова', 'слов')} ·{' '}
              {internalLinks} {plural(internalLinks, 'связь', 'связи', 'связей')} ·{' '}
              {article.backlinks.length}{' '}
              {plural(article.backlinks.length, 'упоминание', 'упоминания', 'упоминаний')}
            </p>
          </header>

          {summaryHtml && (
            <div className="mt-7">
              <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.16em] text-muted">Определение</p>
              <div
                className="definition"
                onClick={(event) => {
                  const anchor = (event.target as HTMLElement).closest<HTMLAnchorElement>('a.wl')
                  if (!anchor) return
                  const { slug: target, kind: targetKind } = anchor.dataset
                  if (!target || (targetKind !== 'concept' && targetKind !== 'entity')) return
                  event.preventDefault()
                  navigate(articlePath(targetKind, target))
                }}
                dangerouslySetInnerHTML={{ __html: summaryHtml }}
              />
            </div>
          )}

          <div className="mt-9">
            <ArticleBody html={article.html} />
          </div>

          <nav className="mt-12 grid gap-3 border-t border-line/70 pt-6 sm:grid-cols-2" aria-label="Соседние статьи">
            {previous ? (
              <Link
                to={articlePath(previous.kind, previous.slug)}
                className="card card-hover group flex flex-col gap-1 px-4 py-3"
              >
                <span className="text-[10px] uppercase tracking-[0.12em] text-muted">← Предыдущая</span>
                <span className="font-serif text-[15px] group-hover:text-accent">{previous.title}</span>
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link
                to={articlePath(next.kind, next.slug)}
                className="card card-hover group flex flex-col items-end gap-1 px-4 py-3 text-right"
              >
                <span className="text-[10px] uppercase tracking-[0.12em] text-muted">Следующая →</span>
                <span className="font-serif text-[15px] group-hover:text-accent">{next.title}</span>
              </Link>
            ) : (
              <span />
            )}
          </nav>

          {manifest && (
            <p className="mt-6 text-[11px] text-muted">
              Словарь собран из{' '}
              <Link to="/about" className="text-accent hover:underline">
                {formatNumber(manifest.stats.articles)} статей
              </Link>{' '}
              вики.
            </p>
          )}
        </article>

        <SidePanel article={article} />
        <SidePanel article={article} variant="inline" />
      </div>
    </div>
  )
}
