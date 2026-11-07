import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const DIST = path.join(ROOT, 'dist')
const CONTENT = path.join(ROOT, 'public', 'content')

const SITE_ORIGIN = (process.env.SITE_ORIGIN ?? 'https://sakharun.github.io').replace(/\/$/, '')
const BASE = normalizeBase(process.env.VITE_BASE ?? '/con-wiki/')
const BASE_NO_SLASH = BASE.replace(/\/$/, '')

const KIND_ROUTE = { concept: 'k', entity: 'e' }

function normalizeBase(value) {
  const clean = value.trim() || '/'
  const withLeadingSlash = clean.startsWith('/') ? clean : `/${clean}`
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function absoluteUrl(pathname) {
  return `${SITE_ORIGIN}${BASE_NO_SLASH}${pathname}`
}

async function main() {
  const started = Date.now()
  const manifest = JSON.parse(await fs.readFile(path.join(CONTENT, 'index.json'), 'utf8'))

  if (!Array.isArray(manifest.entries)) {
    throw new Error('В public/content/index.json нет массива entries')
  }

  const lastmod = manifest.stats?.generatedAt ?? new Date().toISOString()
  const urls = [
    { loc: absoluteUrl('/'), priority: '1.0' },
    ...manifest.entries.map((entry) => ({
      loc: absoluteUrl(`/${KIND_ROUTE[entry.kind]}/${encodeURIComponent(entry.slug)}/`),
      priority: entry.kind === 'concept' ? '0.8' : '0.7',
    })),
  ]

  const body = urls
    .map(
      (item) => `  <url>
    <loc>${escapeXml(item.loc)}</loc>
    <lastmod>${escapeXml(lastmod)}</lastmod>
    <priority>${item.priority}</priority>
  </url>`,
    )
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`

  await fs.writeFile(path.join(DIST, 'sitemap.xml'), xml)
  console.log(`✅ dist/sitemap.xml создан за ${((Date.now() - started) / 1000).toFixed(1)} с`)
  console.log(`   URL: ${urls.length} (главная + ${manifest.entries.length} статей)`)
}

main().catch((error) => {
  console.error('❌ Генерация sitemap упала:', error)
  process.exitCode = 1
})
