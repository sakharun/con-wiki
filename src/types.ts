export type Kind = 'concept' | 'entity'

export interface Entry {
  slug: string
  kind: Kind
  title: string
  letter: string
  summary: string
  backlinks: number
  words: number
}

export interface Stats {
  generatedAt: string
  concepts: number
  entities: number
  articles: number
  links: number
  edges: number
  sources: number
  unresolved: number
  words: number
}

export interface Manifest {
  stats: Stats
  entries: Entry[]
}

export interface ArticleLink {
  slug?: string
  kind: Kind | 'source' | 'missing'
  title: string
}

export interface TocItem {
  id: string
  text: string
  level: number
}

export interface Article {
  slug: string
  kind: Kind
  title: string
  letter: string
  source: string
  summaryHtml: string
  html: string
  toc: TocItem[]
  links: ArticleLink[]
  backlinks: string[]
  words: number
}

export interface GraphNode {
  id: string
  title: string
  kind: Kind
  letter: string
  backlinks: number
}

export interface GraphEdge {
  source: string
  target: string
  weight: number
}

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}
