import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BASE, articlePath, useManifest } from '@/lib/content'

interface Preview {
  title: string
  summary: string
  kind: 'concept' | 'entity'
  slug: string
  x: number
  y: number
  above: boolean
}

export default function ArticleBody({ html }: { html: string }) {
  const navigate = useNavigate()
  const { bySlug } = useManifest()
  const containerRef = useRef<HTMLDivElement>(null)
  const timer = useRef<number | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)

  const prepared = useMemo(() => html.replaceAll('{{BASE}}', BASE.replace(/\/$/, '')), [html])

  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [])

  function showPreview(anchor: HTMLAnchorElement) {
    const slug = anchor.dataset.slug
    const kind = anchor.dataset.kind
    if (!slug || (kind !== 'concept' && kind !== 'entity')) return
    const entry = bySlug(slug)
    if (!entry) return

    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      const rect = anchor.getBoundingClientRect()
      const width = 320
      const above = rect.bottom + 150 > window.innerHeight
      setPreview({
        title: entry.title,
        summary: entry.summary,
        kind: entry.kind,
        slug: entry.slug,
        x: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
        y: above ? rect.top - 10 : rect.bottom + 10,
        above,
      })
    }, 300)
  }

  function hidePreview() {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = null
    setPreview(null)
  }

  return (
    <>
      <div
        ref={containerRef}
        className="article-prose"
        onClick={(event) => {
          const anchor = (event.target as HTMLElement).closest<HTMLAnchorElement>('a.wl')
          if (!anchor) return
          const { slug, kind } = anchor.dataset
          if (!slug || (kind !== 'concept' && kind !== 'entity')) return
          event.preventDefault()
          navigate(articlePath(kind, slug))
        }}
        onMouseOver={(event) => {
          const anchor = (event.target as HTMLElement).closest<HTMLAnchorElement>('a.wl')
          if (anchor) showPreview(anchor)
        }}
        onMouseOut={(event) => {
          const anchor = (event.target as HTMLElement).closest<HTMLAnchorElement>('a.wl')
          if (anchor) hidePreview()
        }}
        onScroll={hidePreview}
        dangerouslySetInnerHTML={{ __html: prepared }}
      />

      {preview && (
        <div
          className="pointer-events-none fixed z-40 w-80 rounded-xl border border-line bg-surface p-4 shadow-xl"
          style={{
            left: preview.x,
            top: preview.y,
            transform: preview.above ? 'translateY(-100%)' : undefined,
          }}
        >
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted">
            {preview.kind === 'concept' ? 'Концепция' : 'Сущность'}
          </p>
          <p className="mt-1 font-serif text-lg font-medium">{preview.title}</p>
          <p className="mt-1.5 line-clamp-4 font-serif text-[13px] leading-relaxed text-muted">{preview.summary}</p>
          <p className="mt-2 text-[11px] text-accent">Открыть статью →</p>
        </div>
      )}
    </>
  )
}
