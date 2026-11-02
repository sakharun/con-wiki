const TRANSLIT = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh', з: 'z', и: 'i',
  й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't',
  у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y',
  ь: '', э: 'e', ю: 'yu', я: 'ya', і: 'i', ї: 'yi', є: 'ye', ґ: 'g',
}

/** @param {string} input */
export function slugify(input) {
  return input
    .toLowerCase()
    .split('')
    .map((char) => TRANSLIT[char] ?? char)
    .join('')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

/** Нормализация имени для сопоставления вики-ссылок. */
export function normalizeName(input) {
  return input
    .trim()
    .replace(/\.md$/i, '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
}

/** Последний сегмент ссылки: «../../вложенные файлы/суть» → «суть». */
export function linkBasename(target) {
  const clean = target.split('#')[0].trim().replace(/\\/g, '/')
  const parts = clean.split('/').filter(Boolean)
  return (parts.at(-1) ?? clean).replace(/\.md$/i, '')
}

/** @param {string} target */
export function displayTarget(target) {
  const base = linkBasename(target)
  return base.replace(/-/g, ' ')
}
