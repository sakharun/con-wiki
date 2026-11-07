import fs from 'node:fs/promises'
import path from 'node:path'

const dist = path.resolve('dist')
const index = await fs.readFile(path.join(dist, 'index.html'), 'utf8')

if (!index.includes('</head>')) {
  throw new Error('В dist/index.html не найден </head> — не могу создать 404.html')
}

// GitHub Pages отдаёт 404.html для неизвестных путей. Это копия SPA-оболочки,
// чтобы React Router сам показал нужный маршрут или страницу «не найдено».
// Саму 404-страницу индексировать не нужно.
const fallback = index.replace(
  '</head>',
  '  <meta name="robots" content="noindex" />\n  </head>',
)

await fs.writeFile(path.join(dist, '404.html'), fallback)
console.log('✅ dist/404.html создан для GitHub Pages (SPA fallback)')
