import MarkdownIt from 'markdown-it'
import { slugify } from './slugs.mjs'

const WIKILINK = /\[\[([^\]\n]+?)\]\]/g
const TOKEN = /\uE000(\d+)\uE001/g

const HEADING_LABELS = {
  'summary': 'Определение',
  'current understanding': 'Текущее понимание',
  'evidence': 'Доказательства',
  'related pages': 'Связанные страницы',
  'contradictions / uncertainty': 'Противоречия и неопределённость',
  'contradictions': 'Противоречия',
  'next questions': 'Следующие вопросы',
  'core claims': 'Основные тезисы',
  'source metadata': 'Метаданные источника',
  'connections': 'Связи',
  'change impact on wiki': 'Влияние на вики',
  'open questions': 'Открытые вопросы',
  'key evidence / details': 'Ключевые доказательства',
  'key evidence': 'Ключевые доказательства',
}

/** @param {string} text */
function translateHeading(text) {
  return HEADING_LABELS[text.trim().toLowerCase()] ?? text
}

/** @param {string} value */
export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** @param {string} value */
function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, '&#39;')
}

/**
 * Разбивает статью на заголовок, Summary и остальное тело.
 * @param {string} source
 */
export function splitArticle(source) {
  const normalized = source.replace(/\r\n/g, '\n').replace(/^\uFEFF/, '')
  const lines = normalized.split('\n')

  let title = ''
  let start = 0
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^#\s+(.+?)\s*$/)
    if (match) {
      title = match[1].trim()
      start = i + 1
      break
    }
    if (lines[i].trim() && !lines[i].startsWith('#')) break
  }

  const rest = lines.slice(start).join('\n')
  const chunks = rest.split(/^##\s+/m)
  const preamble = chunks.shift() ?? ''
  const sections = chunks.map((chunk) => {
    const newline = chunk.indexOf('\n')
    const heading = (newline === -1 ? chunk : chunk.slice(0, newline)).trim()
    const body = newline === -1 ? '' : chunk.slice(newline + 1)
    return { heading, body: body.replace(/^\n+/, '').trimEnd() }
  })

  const summaryIndex = sections.findIndex((section) =>
    /^(summary|определение|definition)$/i.test(section.heading),
  )

  const summary = summaryIndex >= 0 ? sections[summaryIndex].body : ''
  const body = [
    preamble.trimEnd(),
    ...sections.filter((_, index) => index !== summaryIndex).map((section) => `## ${section.heading}\n${section.body}`),
  ]
    .filter(Boolean)
    .join('\n\n')

  return { title, summary, body }
}

/**
 * @param {(target: string) => { slider?: string, slug?: string, kind: string, title: string }} resolve
 */
export function createRenderer(resolve) {
  const md = new MarkdownIt({
    html: false,
    linkify: false,
    typographer: true,
    breaks: false,
  })

  /** @type {Array<{target: string, alias: string}>} */
  let links = []

  md.core.ruler.push('heading_ids', (state) => {
    const toc = []
    const used = new Map()

    for (let i = 0; i < state.tokens.length; i++) {
      const token = state.tokens[i]
      if (token.type !== 'heading_open') continue

      const inline = state.tokens[i + 1]
      if (!inline || inline.type !== 'inline') continue

      let text = inline.content
        .replace(TOKEN, (_, index) => {
          const link = links[Number(index)]
          return link ? link.alias || link.target : ''
        })
        .replace(/[*_`]/g, '')
        .trim()

      const level = Number(token.tag.slice(1))
      const clear = slugify(text) || `section-${i}`
      const seen = used.get(clear) ?? 0
      used.set(clear, seen + 1)
      const id = seen === 0 ? clear : `${clear}-${seen + 1}`

      token.attrSet('id', id)
      if (level === 2 || level === 3) toc.push({ id, text, level })
    }

    state.env.toc = toc
  })

  /**
   * @param {string} markdown
   * @param {{ collect?: boolean }} [options]
   */
  function render(markdown, options = {}) {
    links = []
    const prepared = markdown.replace(WIKILINK, (_, inner) => {
      const [rawTarget, ...aliasParts] = inner.split('|')
      links.push({ target: rawTarget.trim(), alias: aliasParts.join('|').trim() })
      return `\uE000${links.length - 1}\uE001`
    }).replace(/^(#{2,3})\s+(.+?)\s*$/gm, (line, hashes, text) => {
      const translated = translateHeading(text)
      return translated === text ? line : `${hashes} ${translated}`
    })

    const env = {}
    const html = md.render(prepared, env)

    const outgoing = []
    const seen = new Set()

    const withLinks = html.replace(TOKEN, (_, index) => {
      const link = links[Number(index)]
      if (!link) return ''

      const resolved = resolve(link.target)
      const label = link.alias || resolved.title || link.target

      if (resolved.kind === 'concept' || resolved.kind === 'entity') {
        const route = resolved.kind === 'concept' ? 'k' : 'e'
        const href = `{{BASE}}/${route}/${resolved.slug}`
        if (options.collect && resolved.slug && !seen.has(`a:${resolved.slug}`)) {
          seen.add(`a:${resolved.slug}`)
          outgoing.push({ slug: resolved.slug, kind: resolved.kind, title: resolved.title })
        }
        return `<a class="wl" href="${escapeAttr(href)}" data-slug="${escapeAttr(resolved.slug ?? '')}" data-kind="${resolved.kind}">${escapeHtml(label)}</a>`
      }

      if (resolved.kind === 'source') {
        const key = `s:${resolved.title}`
        if (options.collect && !seen.has(key)) {
          seen.add(key)
          outgoing.push({ kind: 'source', title: resolved.title })
        }
        const rawLabel = link.alias || resolved.title || link.target
        const label =
          !link.alias && rawLabel.length > 46 ? `${rawLabel.slice(0, 45).trimEnd()}…` : rawLabel
        return `<span class="wl-ref" data-ref-kind="source" title="Источник: ${escapeAttr(resolved.title)}">${escapeHtml(label)}</span>`
      }

      const key = `m:${resolved.title}`
      if (options.collect && !seen.has(key)) {
        seen.add(key)
        outgoing.push({ kind: 'missing', title: resolved.title })
      }
      const missingLabel = link.alias || resolved.title || link.target
      const shortMissing =
        !link.alias && missingLabel.length > 36 ? `${missingLabel.slice(0, 35).trimEnd()}…` : missingLabel
      return `<span class="wl-ref" data-ref-kind="missing" title="Статья не найдена: ${escapeAttr(resolved.title)}">${escapeHtml(shortMissing)}</span>`
    })

    return { html: withLinks, toc: env.toc ?? [], outgoing, links }
  }

  return { render }
}

/** @param {string} html */
export function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}
