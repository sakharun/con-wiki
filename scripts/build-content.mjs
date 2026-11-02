import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import MiniSearch from 'minisearch'
import { createRenderer, splitArticle, htmlToText, escapeHtml } from './lib/markdown.mjs'
import { slugify, normalizeName, linkBasename, displayTarget } from './lib/slugs.mjs'
import { tokenize, stem } from '../shared/stemmer.js'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const WIKI = path.join(ROOT, 'wiki')
const OUT = path.join(ROOT, 'public', 'content')

const KIND_LABEL = { concept: 'концепция', entity: 'сущность' }
const ALPHABET = 'абвгдеёжзийклмнопрстуфхцчшщъыьэюя'

// Настоящие составные термины, где дефис осмысленен. Остальные дефисы в H1 —
// это следы имён файлов, и в словаре они читаются как пробелы.
const KEEP_HYPHEN = new Set([
  'Бог-Отец',
  'Кризис-менеджер',
  'Купи-продай',
  'Модно-немодно',
  'Перекати-поле',
  'Фильтр-портал',
  'Цивилизация-паразит',
  'Ребёнок-фрактал',
  'Событие-имплант',
  'Импульс-Образ',
  'Стоп-кадр качества',
])

function prettifyTitle(title) {
  if (!title.includes('-') || KEEP_HYPHEN.has(title)) return title
  return title.replace(/-/g, ' ').replace(/\s+/g, ' ').trim()
}

async function readMarkdownFiles(dir) {
  let names = []
  try {
    names = await fs.readdir(dir)
  } catch {
    return []
  }
  return names.filter((name) => name.toLowerCase().endsWith('.md')).map((name) => path.join(dir, name))
}

async function main() {
  const started = Date.now()
  console.log('📚 Читаю wiki…')

  await fs.rm(OUT, { recursive: true, force: true })
  await fs.mkdir(path.join(OUT, 'articles'), { recursive: true })

  const conceptFiles = await readMarkdownFiles(path.join(WIKI, 'concepts'))
  const entityFiles = await readMarkdownFiles(path.join(WIKI, 'entities'))
  const sourceFiles = await readMarkdownFiles(path.join(WIKI, 'sources'))
  const lintFiles = await readMarkdownFiles(path.join(WIKI, 'lint-reports'))
  const rootFiles = await readMarkdownFiles(WIKI)

  /** @type {Array<{slug:string,kind:'concept'|'entity',title:string,summary:string,body:string,file:string,keys:string[]}>} */
  const entries = []
  const usedSlugs = new Set()

  async function loadEntry(file, kind) {
    const source = await fs.readFile(file, 'utf8')
    const { title: rawTitle, summary, body } = splitArticle(source)
    const baseName = path.basename(file, '.md')
    const sourceTitle = rawTitle || baseName.replace(/-/g, ' ')
    const title = prettifyTitle(sourceTitle)

    let slug = slugify(sourceTitle) || slugify(baseName) || kind
    let suffix = 2
    while (usedSlugs.has(slug)) slug = `${slugify(sourceTitle) || slugify(baseName)}-${suffix++}`
    usedSlugs.add(slug)

    entries.push({
      slug,
      kind,
      title,
      summary,
      body,
      file: path.relative(ROOT, file).replace(/\\/g, '/'),
      keys: [normalizeName(baseName), normalizeName(sourceTitle), normalizeName(title), slug],
    })
  }

  for (const file of conceptFiles) await loadEntry(file, 'concept')
  for (const file of entityFiles) await loadEntry(file, 'entity')

  console.log(`   найдено: ${conceptFiles.length} концепций, ${entityFiles.length} сущностей`)

  // Разрешение вики-ссылок: имя файла, заголовок H1 или слаг.
  /** @type {Map<string, typeof entries[number]>} */
  const byName = new Map()
  for (const entry of entries) {
    for (const key of entry.keys) {
      if (key && !byName.has(key)) byName.set(key, entry)
    }
  }

  // Морфологический запасной вариант: «Антимире» → «Антимир».
  const stemKey = (name) => name.split('-').map((part) => stem(part)).join('-')
  const byStem = new Map()
  for (const entry of entries) {
    for (const key of entry.keys) {
      if (!key) continue
      const normalized = stemKey(key)
      const existing = byStem.get(normalized)
      byStem.set(normalized, existing && existing !== entry ? null : entry)
    }
  }

  /** @type {Map<string, {kind:'source'|'page', title:string}>} */
  const references = new Map()

  async function loadReference(file, kind) {
    const source = await fs.readFile(file, 'utf8')
    const firstLine = source.split(/\r?\n/).find((line) => /^#\s+/.test(line))
    const title = firstLine ? firstLine.replace(/^#\s+/, '').trim() : path.basename(file, '.md')
    const keys = [normalizeName(path.basename(file, '.md')), normalizeName(title)]
    for (const key of keys) {
      if (key && !references.has(key)) references.set(key, { kind, title })
    }
  }

  for (const file of sourceFiles) await loadReference(file, 'source')
  for (const file of lintFiles) await loadReference(file, 'page')
  for (const file of rootFiles) {
    if (/^(index|overview|log)\.md$/i.test(path.basename(file))) await loadReference(file, 'page')
  }

  const unresolved = new Map()

  function resolve(target) {
    const base = linkBasename(target)
    const key = normalizeName(base)
    const entry = byName.get(key)
    if (entry) return { kind: entry.kind, slug: entry.slug, title: entry.title }
    const morphological = byStem.get(stemKey(key))
    if (morphological) return { kind: morphological.kind, slug: morphological.slug, title: morphological.title }
    const reference = references.get(key)
    if (reference) return { kind: reference.kind, title: reference.title }
    unresolved.set(base, (unresolved.get(base) ?? 0) + 1)
    return { kind: 'missing', title: displayTarget(target) }
  }

  const renderer = createRenderer(resolve)
  const baseUrl = '{{BASE}}'

  console.log('🛠  Рендерю статьи…')

  for (const entry of entries) {
    const summaryRender = renderer.render(entry.summary)
    const bodyRender = renderer.render(entry.body, { collect: true })

    const summaryHtml = summaryRender.html
      .replaceAll('{{BASE}}', baseUrl)
      .trim()
    const bodyHtml = bodyRender.html.replaceAll('{{BASE}}', baseUrl)

    entry.summaryHtml = summaryHtml
    entry.bodyHtml = bodyHtml
    entry.toc = bodyRender.toc
    entry.links = bodyRender.outgoing
    entry.summaryText = htmlToText(summaryHtml)
    entry.bodyText = htmlToText(bodyHtml)
    entry.words = (entry.summaryText + ' ' + entry.bodyText).split(/\s+/).filter(Boolean).length
  }

  // Обратные ссылки
  const backlinks = new Map(entries.map((entry) => [entry.slug, new Set()]))
  for (const entry of entries) {
    for (const link of entry.links) {
      if (link.slug && link.kind !== 'source' && link.kind !== 'missing') {
        if (link.slug !== entry.slug) backlinks.get(link.slug)?.add(entry.slug)
      }
    }
  }

  console.log('🔎 Собираю поисковые индексы…')

  const lite = new MiniSearch({
    fields: ['title', 'summary'],
    storeFields: ['title', 'summary', 'kind', 'letter'],
    tokenize: (text) => tokenize(text),
    processTerm: (term) => term,
    searchOptions: {
      boost: { title: 5, summary: 2 },
      prefix: true,
      fuzzy: 0.2,
      combineWith: 'AND',
    },
  })

  const full = new MiniSearch({
    fields: ['title', 'text'],
    storeFields: ['title', 'kind', 'letter', 'summary'],
    tokenize: (text) => tokenize(text),
    processTerm: (term) => term,
    searchOptions: {
      boost: { title: 5, text: 1 },
      prefix: true,
      fuzzy: 0.2,
      combineWith: 'AND',
    },
  })

  const indexEntries = []

  for (const entry of entries) {
    const letterRaw = entry.title.trim().charAt(0).toLowerCase()
    const letter = ALPHABET.includes(letterRaw) ? letterRaw.toUpperCase() : '#'

    const liteDoc = {
      id: entry.slug,
      title: entry.title,
      summary: entry.summaryText.slice(0, 400),
      kind: entry.kind,
      letter,
      slug: entry.slug,
    }
    lite.add(liteDoc)

    full.add({
      id: entry.slug,
      title: entry.title,
      text: `${entry.summaryText} ${entry.bodyText}`.slice(0, 40000),
      kind: entry.kind,
      letter,
      summary: entry.summaryText.slice(0, 300),
      slug: entry.slug,
    })

    indexEntries.push({
      slug: entry.slug,
      kind: entry.kind,
      title: entry.title,
      letter,
      summary: entry.summaryText.slice(0, 400),
      backlinks: backlinks.get(entry.slug)?.size ?? 0,
      words: entry.words,
    })

    await fs.writeFile(
      path.join(OUT, 'articles', `${entry.slug}.json`),
      JSON.stringify({
        slug: entry.slug,
        kind: entry.kind,
        title: entry.title,
        letter,
        source: entry.file,
        summaryHtml: entry.summaryHtml,
        html: entry.bodyHtml,
        toc: entry.toc,
        links: entry.links,
        backlinks: [...(backlinks.get(entry.slug) ?? [])],
        words: entry.words,
      }),
    )
  }

  const letterOrder = [...ALPHABET.toUpperCase().split(''), '#']

  indexEntries.sort((a, b) => {
    const letterDiff = letterOrder.indexOf(a.letter) - letterOrder.indexOf(b.letter)
    if (letterDiff !== 0) return letterDiff
    return a.title.localeCompare(b.title, 'ru')
  })

  // Граф
  const nodes = indexEntries.map((entry) => ({
    id: entry.slug,
    title: entry.title,
    kind: entry.kind,
    letter: entry.letter,
    backlinks: entry.backlinks,
  }))

  const edgeMap = new Map()
  for (const entry of entries) {
    for (const link of entry.links) {
      if (!link.slug || link.kind === 'source' || link.kind === 'missing') continue
      if (link.slug === entry.slug) continue
      const [a, b] = [entry.slug, link.slug].sort()
      const key = `${a}~${b}`
      edgeMap.set(key, (edgeMap.get(key) ?? 0) + 1)
    }
  }

  const edges = [...edgeMap.entries()].map(([key, weight]) => {
    const [source, target] = key.split('~')
    return { source, target, weight }
  })

  const totalLinks = entries.reduce((sum, entry) => sum + entry.links.length, 0)
  const nodeIds = new Set(nodes.map((node) => node.id))
  const validEdges = edges.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))

  const stats = {
    generatedAt: new Date().toISOString(),
    concepts: entries.filter((entry) => entry.kind === 'concept').length,
    entities: entries.filter((entry) => entry.kind === 'entity').length,
    articles: entries.length,
    links: totalLinks,
    edges: validEdges.length,
    sources: sourceFiles.length,
    unresolved: unresolved.size,
    words: entries.reduce((sum, entry) => sum + entry.words, 0),
  }

  await Promise.all([
    fs.writeFile(
      path.join(OUT, 'index.json'),
      JSON.stringify({ stats, entries: indexEntries }),
    ),
    fs.writeFile(path.join(OUT, 'graph.json'), JSON.stringify({ nodes, edges: validEdges })),
    fs.writeFile(path.join(OUT, 'search-lite.json'), JSON.stringify(lite.toJSON())),
    fs.writeFile(path.join(OUT, 'search-full.json'), JSON.stringify(full.toJSON())),
  ])

  const size = async (name) => {
    const stat = await fs.stat(path.join(OUT, name))
    return `${name}: ${(stat.size / 1024).toFixed(0)} КБ`
  }
  const sizes = await Promise.all([
    size('index.json'),
    size('graph.json'),
    size('search-lite.json'),
    size('search-full.json'),
  ])

  console.log(`✅ Готово за ${((Date.now() - started) / 1000).toFixed(1)} с`)
  console.log(`   статей: ${stats.articles}, связей: ${stats.edges}, слов: ${stats.words}`)
  console.log(`   ${sizes.join(', ')}`)

  if (unresolved.size) {
    const worst = [...unresolved.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)
    console.log(`⚠️  неразрешённых целей: ${unresolved.size}`)
    for (const [name, count] of worst) console.log(`   ${name} ×${count}`)
  }
}

main().catch((error) => {
  console.error('❌ Сборка контента упала:', error)
  process.exitCode = 1
})
