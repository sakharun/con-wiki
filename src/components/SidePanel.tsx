import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Article } from '@/types'
import { articlePath, useManifest } from '@/lib/content'
import MiniGraph from './MiniGraph'

export default function SidePanel({
  article,
  variant = 'sidebar',
}: {
  article: Article
  variant?: 'sidebar' | 'inline'
}) {
  const { bySlug } = useManifest()
  const [activeId, setActiveId] = useState(article.toc[0]?.id ?? '')

  const related = useMemo(
    () =>
      article.links
        .filter(
          (link) =>
            link.slug &&
            link.slug !== article.slug &&
            (link.kind === 'concept' || link.kind === 'entity'),
        )
        .map((link) => bySlug(link.slug!))
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)),
    [article, bySlug],
  )

  const backlinks = useMemo(
    () =>
      article.backlinks
        .map((slug) => bySlug(slug))
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
        .sort((a, b) => a.title.localeCompare(b.title, 'ru')),
    [article.backlinks, bySlug],
  )

  useEffect(() => {
    const headings = article.toc
      .map((item) => document.getElementById(item.id))
      .filter((element): element is HTMLElement => Boolean(element))
    if (!headings.length) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (visible) setActiveId(visible.target.id)
      },
      { rootMargin: '-96px 0px -65% 0px', threshold: 0 },
    )

    headings.forEach((heading) => observer.observe(heading))
    return () => observer.disconnect()
  }, [article.slug, article.toc])

  return (
    <aside className={variant === 'sidebar' ? 'hidden lg:block' : 'mt-10 border-t border-line/70 pt-8 lg:hidden'}>
      <div className={variant === 'sidebar' ? 'sticky top-24 space-y-7' : 'space-y-7'}>
        {article.toc.length > 0 && (
          <nav aria-label="Содержание статьи">
            <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted">В этой статье</p>
            <ul className="mt-3 space-y-1.5 border-l border-line/70">
              {article.toc.map((item) => (
                <li key={item.id} className={item.level === 3 ? 'pl-3' : ''}>
                  <a
                    href={`#${item.id}`}
                    className={`-ml-px block border-l-2 py-0.5 pl-3 text-[12.5px] leading-snug transition-colors ${
                      activeId === item.id
                        ? 'border-accent text-accent'
                        : 'border-transparent text-muted hover:text-ink'
                    }`}
                  >
                    {item.text}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}

        {related.length > 0 && (
          <section>
            <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted">Связанные</p>
            <ul className="mt-3 space-y-2">
              {related.map((entry) => (
                <li key={entry.slug}>
                  <Link
                    to={articlePath(entry.kind, entry.slug)}
                    className="flex items-baseline gap-2 font-serif text-[14px] leading-snug text-ink transition-colors hover:text-accent"
                  >
                    <span
                      className={`mt-[6px] size-1 shrink-0 rounded-full ${
                        entry.kind === 'concept' ? 'bg-accent/60' : 'bg-emerald-600/60 dark:bg-emerald-400/60'
                      }`}
                    />
                    {entry.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {backlinks.length > 0 && (
          <section>
            <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted">
              Ссылаются · {backlinks.length}
            </p>
            <ul className="mt-3 space-y-1.5">
              {backlinks.slice(0, 8).map((entry) => (
                <li key={entry.slug}>
                  <Link
                    to={articlePath(entry.kind, entry.slug)}
                    className="text-[12.5px] leading-snug text-muted transition-colors hover:text-accent"
                  >
                    {entry.title}
                  </Link>
                </li>
              ))}
            </ul>
            {backlinks.length > 8 && (
              <p className="mt-2 text-[11px] text-muted">
                и ещё{' '}
                <Link
                  to={`/all?letter=${encodeURIComponent(article.letter)}`}
                  className="text-accent hover:underline"
                >
                  {backlinks.length - 8}
                </Link>
              </p>
            )}
          </section>
        )}

        {related.length > 0 && (
          <section className="rounded-xl border border-line/70 bg-surface px-3 py-3">
            <p className="mb-1 px-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted">
              Ближайшие связи
            </p>
            <MiniGraph center={{ slug: article.slug, title: article.title }} neighbors={related} />
          </section>
        )}

        <section className="border-t border-line/60 pt-4">
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted">Исходник</p>
          <p className="mt-1 break-all font-mono text-[11px] leading-snug text-muted/80">{article.source}</p>
        </section>
      </div>
    </aside>
  )
}
