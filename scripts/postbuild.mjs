import fs from 'node:fs/promises'
import path from 'node:path'

const dist = path.resolve('dist')
await fs.copyFile(path.join(dist, 'index.html'), path.join(dist, '404.html'))
console.log('✅ dist/404.html создан для GitHub Pages')
