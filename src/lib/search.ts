import MiniSearch from 'minisearch'
import type { SearchResult } from 'minisearch'
import { tokenize } from '@shared/stemmer.js'
import type { Kind } from '@/types'
import { BASE } from './content'

export interface SearchDoc {
  id: string
  title: string
  summary?: string
  text?: string
  kind: Kind
  letter: string
  slug: string
}

export interface SearchHit {
  id: string
  slug: string
  title: string
  kind: Kind
  summary: string
  score: number
}

const SHARED_OPTIONS = {
  tokenize: (text: string) => tokenize(text),
  processTerm: (term: string) => term,
  searchOptions: {
    prefix: true,
    fuzzy: 0.2,
    combineWith: 'AND' as const,
  },
}

const LITE_OPTIONS = {
  ...SHARED_OPTIONS,
  fields: ['title', 'summary'],
  storeFields: ['title', 'summary', 'kind', 'letter', 'slug'],
  searchOptions: {
    ...SHARED_OPTIONS.searchOptions,
    boost: { title: 5, summary: 2 },
  },
}

const FULL_OPTIONS = {
  ...SHARED_OPTIONS,
  fields: ['title', 'text'],
  storeFields: ['title', 'summary', 'kind', 'letter', 'slug'],
  searchOptions: {
    ...SHARED_OPTIONS.searchOptions,
    boost: { title: 5, text: 1 },
  },
}

let litePromise: Promise<MiniSearch<SearchDoc>> | null = null
let fullPromise: Promise<MiniSearch<SearchDoc>> | null = null

async function loadIndex(path: string, options: typeof LITE_OPTIONS | typeof FULL_OPTIONS) {
  const response = await fetch(path)
  if (!response.ok) throw new Error(`Не удалось загрузить индекс (${response.status})`)
  const json = await response.text()
  return MiniSearch.loadJSONAsync<SearchDoc>(json, options)
}

export function loadLiteIndex() {
  if (!litePromise) {
    litePromise = loadIndex(`${BASE}content/search-lite.json`, LITE_OPTIONS)
    litePromise.catch(() => {
      litePromise = null
    })
  }
  return litePromise
}

export function loadFullIndex() {
  if (!fullPromise) {
    fullPromise = loadIndex(`${BASE}content/search-full.json`, FULL_OPTIONS)
    fullPromise.catch(() => {
      fullPromise = null
    })
  }
  return fullPromise
}

function toHits(results: SearchResult[]): SearchHit[] {
  return results.map((result) => ({
    id: String(result.id),
    slug: String(result.slug ?? result.id),
    title: String(result.title ?? ''),
    kind: (result.kind === 'entity' ? 'entity' : 'concept') as Kind,
    summary: String(result.summary ?? ''),
    score: result.score,
  }))
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/ё/g, 'е').trim()
}

/** Совпадение в заголовке важнее случайного стемминга: «Воля» выше «Волны». */
function titleWeight(title: string, query: string) {
  const value = normalizeText(title)
  const target = normalizeText(query)
  if (value === target) return 3
  if (value.startsWith(target)) return 2
  if (value.includes(target)) return 1
  const titleTokens = tokenize(title)
  const queryTokens = tokenize(query)
  if (queryTokens.length && queryTokens.every((token) => titleTokens.includes(token))) return 1
  return 0
}

function rank(hits: SearchHit[], query: string) {
  return hits.sort(
    (a, b) => titleWeight(b.title, query) - titleWeight(a.title, query) || b.score - a.score,
  )
}

export async function searchLite(query: string, limit = 12): Promise<SearchHit[]> {
  const trimmed = query.trim()
  if (!trimmed) return []
  const index = await loadLiteIndex()
  const hits = toHits(index.search(trimmed))
  // Если есть совпадения по названию, не засоряем выдачу дальними словоформами.
  const titled = hits.filter((hit) => titleWeight(hit.title, trimmed) > 0)
  return rank(titled.length ? titled : hits, trimmed).slice(0, limit)
}

export async function searchFull(query: string, limit = 20): Promise<SearchHit[]> {
  const trimmed = query.trim()
  if (!trimmed) return []
  const index = await loadFullIndex()
  return rank(toHits(index.search(trimmed)), trimmed).slice(0, limit)
}
