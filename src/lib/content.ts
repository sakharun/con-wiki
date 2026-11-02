import { useEffect, useState } from 'react'
import type { Article, Entry, Kind, Manifest } from '@/types'

export const BASE = import.meta.env.BASE_URL.endsWith('/')
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`

export const KIND_LABEL: Record<Kind, string> = {
  concept: 'концепция',
  entity: 'сущность',
}

export const KIND_PLURAL: Record<Kind, string> = {
  concept: 'Концепции',
  entity: 'Сущности',
}

export function articleHref(kind: Kind, slug: string) {
  return `${BASE}${kind === 'concept' ? 'k' : 'e'}/${slug}`
}

export function articlePath(kind: Kind, slug: string) {
  return `/${kind === 'concept' ? 'k' : 'e'}/${slug}`
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path)
  if (!response.ok) throw new Error(`Не удалось загрузить ${path} (${response.status})`)
  return response.json() as Promise<T>
}

let manifestPromise: Promise<Manifest> | null = null
let manifestCache: Manifest | null = null
let entryMap: Map<string, Entry> | null = null

export function loadManifest(): Promise<Manifest> {
  if (!manifestPromise) {
    manifestPromise = fetchJson<Manifest>(`${BASE}content/index.json`).then((manifest) => {
      manifestCache = manifest
      entryMap = new Map(manifest.entries.map((entry) => [entry.slug, entry]))
      return manifest
    })
  }
  return manifestPromise
}

export function useManifest() {
  const [manifest, setManifest] = useState<Manifest | null>(manifestCache)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (manifestCache) return
    let alive = true
    loadManifest()
      .then((data) => alive && setManifest(data))
      .catch((cause: unknown) => alive && setError(cause instanceof Error ? cause : new Error(String(cause))))
    return () => {
      alive = false
    }
  }, [])

  return {
    manifest,
    entries: manifest?.entries ?? [],
    bySlug: (slug: string) => entryMap?.get(slug),
    error,
  }
}

const articleCache = new Map<string, Promise<Article>>()

export function loadArticle(slug: string): Promise<Article> {
  let cached = articleCache.get(slug)
  if (!cached) {
    cached = fetchJson<Article>(`${BASE}content/articles/${slug}.json`)
    articleCache.set(slug, cached)
    cached.catch(() => articleCache.delete(slug))
  }
  return cached
}

/** Недавно открытые статьи — для пустого состояния поиска. */
const RECENT_KEY = 'dictionary:recent'

export function pushRecent(slug: string) {
  try {
    const current = getRecent().filter((item) => item !== slug)
    current.unshift(slug)
    localStorage.setItem(RECENT_KEY, JSON.stringify(current.slice(0, 8)))
  } catch {
    /* localStorage может быть недоступен */
  }
}

export function getRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

export function plural(count: number, one: string, few: string, many: string) {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat('ru-RU').format(value)
}
