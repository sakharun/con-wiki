import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const DIST = path.join(ROOT, 'dist')
const CONTENT = path.join(ROOT, 'public', 'content')

const SITE_ORIGIN = (process.env.SITE_ORIGIN ?? 'https://sakharun.github.io').replace(/\/$/, '')
const BASE = normalizeBase(process.env.VITE_BASE ?? '/con-wiki/')
const BASE_NO_SLASH = BASE.replace(/\/$/, '')

const SITE_NAME = 'Словарь «Реконструктор Сознания»'
const KIND_LABEL = { concept: 'концепция', entity: 'сущность' }
const KIND_PLURAL = { concept: 'Концепции', entity: 'Сущности' }
const KIND_ROUTE = { concept: 'k', entity: 'e' }

function normalizeBase(value) {
  const clean = value.trim() || '/'
  const withLeadingSlash = clean.startsWith('/') ? clean : `/${clean}`
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, '&#39;')
}

function stripHtml(value) {
  return String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/\s+/g, ' ')
    .trim()
}

function truncate(value, max) {
  const text = String(value).trim()
  if (text.length <= max) return text
  const cut = text.slice(0, max - 1)
  const lastSpace = cut.lastIndexOf(' ')
  const base = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut
  return `${base.trimEnd()}…`
}

function jsonLd(value) {
  // Экранируем <, чтобы содержимое нельзя было закрыть тегом </script>.
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

function formatNumber(value) {
  return new Intl.NumberFormat('ru-RU').format(value)
}

function plural(count, one, few, many) {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

function articleHref(article) {
  return `${BASE_NO_SLASH}/${KIND_ROUTE[article.kind]}/${article.slug}`
}

function staticArticleHref(article) {
  return `${articleHref(article)}/`
}

function articleUrl(article) {
  return `${SITE_ORIGIN}${staticArticleHref(article)}`
}

function renderHead(article, summaryText) {
  const description = truncate(
    summaryText || `Статья словаря «${article.title}»: определение, связи и источники.`,
    160,
  )
  const ogDescription = truncate(summaryText || description, 300)
  const title = `${article.title} — ${SITE_NAME}`
  const canonical = articleUrl(article)

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'DefinedTerm',
    name: article.title,
    inLanguage: 'ru',
    termCode: article.slug,
    description: summaryText || undefined,
    url: canonical,
    isPartOf: {
      '@type': 'WebSite',
      name: SITE_NAME,
      url: `${SITE_ORIGIN}${BASE_NO_SLASH}/`,
    },
  }

  return [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeAttr(description)}" />`,
    `<meta name="robots" content="index, follow" />`,
    `<link rel="canonical" href="${escapeAttr(canonical)}" />`,
    `<meta property="og:type" content="article" />`,
    `<meta property="og:site_name" content="${escapeAttr(SITE_NAME)}" />`,
    `<meta property="og:locale" content="ru_RU" />`,
    `<meta property="og:title" content="${escapeAttr(article.title)}" />`,
    `<meta property="og:description" content="${escapeAttr(ogDescription)}" />`,
    `<meta property="og:url" content="${escapeAttr(canonical)}" />`,
    `<meta name="twitter:card" content="summary" />`,
    `<script type="application/ld+json">${jsonLd(schema)}</script>`,
  ].join('\n    ')
}

function collectRelated(article, entryBySlug) {
  const seen = new Set([article.slug])
  const items = []

  function add(item) {
    if (!item?.slug || seen.has(item.slug)) return
    const entry = entryBySlug.get(item.slug)
    if (!entry) return
    seen.add(item.slug)
    items.push({ slug: item.slug, kind: item.kind ?? entry.kind, title: entry.title })
  }

  for (const link of article.links ?? []) {
    if (link.slug && (link.kind === 'concept' || link.kind === 'entity')) add(link)
  }

  for (const slug of article.backlinks ?? []) {
    add({ slug, kind: entryBySlug.get(slug)?.kind })
  }

  return items.slice(0, 24)
}

function renderRelated(related) {
  if (!related.length) return '<aside class="hidden lg:block"></aside>'

  const links = related
    .map(
      (item) =>
        `<li><a href="${escapeAttr(staticArticleHref(item))}" class="text-accent hover:underline">${escapeHtml(item.title)}</a></li>`,
    )
    .join('\n          ')

  return `<aside class="hidden lg:block">
        <nav aria-label="Связанные статьи" class="card px-5 py-5">
          <h2 class="font-serif text-lg">Связанные статьи</h2>
          <ul class="mt-3 space-y-2 text-[13px]">
          ${links}
          </ul>
        </nav>
      </aside>`
}

function renderStaticBody(article, summaryText, related) {
  const summaryHtml = String(article.summaryHtml ?? '').replaceAll('{{BASE}}', BASE_NO_SLASH)
  const bodyHtml = String(article.html ?? '').replaceAll('{{BASE}}', BASE_NO_SLASH)
  const kindLabel = KIND_LABEL[article.kind]
  const kindPlural = KIND_PLURAL[article.kind]
  const words = Number(article.words) || 0
  const internalLinks = (article.links ?? []).filter(
    (link) => link.slug && (link.kind === 'concept' || link.kind === 'entity'),
  ).length
  const backlinks = (article.backlinks ?? []).length

  const stats = [
    `${formatNumber(words)} ${plural(words, 'слово', 'слова', 'слов')}`,
    `${internalLinks} ${plural(internalLinks, 'связь', 'связи', 'связей')}`,
    `${backlinks} ${plural(backlinks, 'упоминание', 'упоминания', 'упоминаний')}`,
  ].join(' · ')

  return `<div class="flex min-h-screen flex-col">
  <header class="sticky top-0 z-30 border-b border-line/70 bg-paper/85 backdrop-blur-md">
    <div class="mx-auto flex h-16 max-w-[1400px] items-center gap-3 px-4 sm:px-6">
      <a href="${escapeAttr(BASE)}" class="group flex min-w-0 items-center gap-3">
        <span class="grid size-9 shrink-0 place-items-center rounded-md border border-line bg-surface font-serif text-lg font-semibold text-accent shadow-sm">Р</span>
        <span class="min-w-0 leading-tight">
          <span class="block text-[10px] font-medium uppercase tracking-[0.22em] text-muted">Словарь</span>
          <span class="hidden truncate font-serif text-[15px] font-medium sm:block">Реконструктор Сознания</span>
        </span>
      </a>
      <nav class="ml-4 hidden items-center gap-1 md:flex">
        <a href="${escapeAttr(BASE)}" class="rounded-md bg-accent-soft px-3 py-1.5 text-sm text-accent">Словарь</a>
        <a href="${escapeAttr(`${BASE}all`)}" class="rounded-md px-3 py-1.5 text-sm text-muted transition-colors hover:bg-line/30 hover:text-ink">Указатель</a>
        <a href="${escapeAttr(`${BASE}graph`)}" class="rounded-md px-3 py-1.5 text-sm text-muted transition-colors hover:bg-line/30 hover:text-ink">Граф</a>
        <a href="${escapeAttr(`${BASE}about`)}" class="rounded-md px-3 py-1.5 text-sm text-muted transition-colors hover:bg-line/30 hover:text-ink">О словаре</a>
      </nav>
    </div>
  </header>

  <main id="main" class="mx-auto w-full max-w-[1400px] flex-1 px-4 py-8 sm:px-6 sm:py-10">
    <nav aria-label="Хлебные крошки" class="flex flex-wrap items-center gap-2 text-[12px] text-muted">
      <a href="${escapeAttr(BASE)}" class="transition-colors hover:text-ink">Словарь</a>
      <span aria-hidden>/</span>
      <a href="${escapeAttr(`${BASE}all?kind=${article.kind}`)}" class="transition-colors hover:text-ink">${kindPlural}</a>
      <span aria-hidden>/</span>
      <span class="text-ink/70">${escapeHtml(article.title)}</span>
    </nav>

    <div class="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1fr)_280px]">
      <article class="min-w-0 max-w-[72ch]">
        <header>
          <div class="flex flex-wrap items-center gap-3">
            <span class="pill border-accent/30 bg-accent-soft/60 text-accent">${kindLabel}</span>
            <span class="text-[11px] uppercase tracking-[0.12em] text-muted">буква ${escapeHtml(article.letter ?? '')}</span>
          </div>
          <h1 class="mt-4 font-serif text-4xl leading-[1.1] tracking-tight sm:text-[2.9rem]">${escapeHtml(article.title)}</h1>
          <p class="mt-3 text-[12px] text-muted">${stats}</p>
        </header>

        ${
          summaryHtml
            ? `<div class="mt-7">
          <p class="mb-2 text-[10px] font-medium uppercase tracking-[0.16em] text-muted">Определение</p>
          <div class="definition">${summaryHtml}</div>
        </div>`
            : ''
        }

        <div class="mt-9 article-prose">${bodyHtml}</div>
      </article>

      ${renderRelated(related)}
    </div>
  </main>

  <footer class="border-t border-line/70">
    <div class="mx-auto flex max-w-[1400px] flex-col gap-3 px-4 py-6 text-[13px] text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <p>${SITE_NAME}</p>
      <p><a href="${escapeAttr(`${BASE}about`)}" class="transition-colors hover:text-ink">О словаре</a></p>
    </div>
  </footer>
</div>`
}

function prepareTemplate(html) {
  return html
    .replace(/\s*<title>[\s\S]*?<\/title>/i, '')
    .replace(/\s*<meta\s+name=["']description["'][\s\S]*?\/>/i, '')
}

async function main() {
  const started = Date.now()
  console.log(`🛠  Пререндер статей словаря (base: ${BASE})…`)

  const [manifestRaw, templateRaw, articleNames] = await Promise.all([
    fs.readFile(path.join(CONTENT, 'index.json'), 'utf8'),
    fs.readFile(path.join(DIST, 'index.html'), 'utf8'),
    fs.readdir(path.join(CONTENT, 'articles')),
  ])

  const manifest = JSON.parse(manifestRaw)
  if (!Array.isArray(manifest.entries)) {
    throw new Error('В public/content/index.json нет массива entries')
  }

  const entryBySlug = new Map(manifest.entries.map((entry) => [entry.slug, entry]))
  const template = prepareTemplate(templateRaw)

  if (!template.includes('<div id="root"></div>')) {
    throw new Error('В dist/index.html не найден пустой <div id="root"></div>')
  }

  const files = articleNames.filter((name) => name.toLowerCase().endsWith('.json')).sort()
  let written = 0

  for (const file of files) {
    const article = JSON.parse(await fs.readFile(path.join(CONTENT, 'articles', file), 'utf8'))
    if (article.kind !== 'concept' && article.kind !== 'entity') continue

    const entry = entryBySlug.get(article.slug)
    const summaryText = stripHtml(article.summaryHtml ?? '') || entry?.summary || ''
    const related = collectRelated(article, entryBySlug)

    const html = template
      .replace('</head>', `    ${renderHead(article, summaryText)}\n  </head>`)
      .replace('<div id="root"></div>', `<div id="root">${renderStaticBody(article, summaryText, related)}</div>`)

    const output = path.join(DIST, KIND_ROUTE[article.kind], article.slug, 'index.html')
    await fs.mkdir(path.dirname(output), { recursive: true })
    await fs.writeFile(output, html)
    written += 1
  }

  if (!written) {
    throw new Error('Не найдено ни одной статьи для пререндера')
  }

  console.log(`✅ Пререндер готов за ${((Date.now() - started) / 1000).toFixed(1)} с`)
  console.log(`   создано страниц: ${written}`)
  console.log(`   пример: dist/${KIND_ROUTE.concept}/100-versiy/index.html`)
}

main().catch((error) => {
  console.error('❌ Пререндер упал:', error)
  process.exitCode = 1
})
