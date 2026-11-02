/**
 * Лёгкий стеммер для русского языка.
 * Задача не научная точность, а сведение словоформ к одной основе:
 * «воля», «воли», «волей» → «вол»; «свобода», «свободы» → «свобод».
 * Используется и при построении поискового индекса, и при запросе.
 */

const VOWELS = 'аеиоуыэюя'

/** @param {string} word */
export function normalize(word) {
  return word.toLowerCase().replace(/ё/g, 'е')
}

/** @param {string} word */
function regions(word) {
  const rv = word.search(/[аеиоуыэюя]/)
  const r1 = word.search(/[аеиоуыэюя][^аеиоуыэюя]/)
  const r2 = r1 >= 0 ? word.slice(r1 + 1).search(/[аеиоуыэюя][^аеиоуыэюя]/) : -1
  return { rv: rv < 0 ? word.length : rv, r1: r1 < 0 ? word.length : r1 + 1, r2: r2 < 0 ? word.length : r1 + 1 + r2 + 1 }
}

/** @param {string} word @param {string[]} suffixes @param {number} minLength */
function strip(word, suffixes, minLength) {
  for (const suffix of suffixes) {
    if (word.length - suffix.length >= minLength && word.endsWith(suffix)) {
      return word.slice(0, -suffix.length)
    }
  }
  return word
}

// Порядок важен: сначала длинные и специфичные окончания.
const PERFECTIVE_GERUND = ['вшись', 'вши', 'в']
const ADJECTIVE = [
  'ими', 'ыми', 'его', 'ому', 'ему', 'ыми', 'ими', 'ая', 'яя', 'ое', 'ее', 'ые', 'ие',
  'ой', 'ый', 'ий', 'ей', 'ую', 'юю', 'ою', 'ею', 'ых', 'их', 'ым', 'им', 'ом', 'ем',
]
const VERB = [
  'ила', 'ыла', 'ена', 'ейте', 'уйте', 'ите', 'или', 'ыли', 'ило', 'ыло', 'ено',
  'ует', 'уют', 'ены', 'ить', 'ыть', 'ишь', 'ует', 'ать', 'ять', 'ет', 'ют', 'ит',
  'ыт', 'ен', 'ил', 'ыл', 'им', 'ым', 'уй', 'ей', 'ую', 'юю', 'ла', 'на', 'ли',
]
const NOUN = [
  'иями', 'ями', 'ами', 'ией', 'иям', 'ием', 'иях', 'ия', 'ье', 'еи', 'ии', 'ей',
  'ой', 'ий', 'ям', 'ем', 'ам', 'ом', 'ах', 'ях', 'ов', 'ев', 'ью', 'ию', 'я', 'а',
  'е', 'и', 'й', 'о', 'у', 'ы', 'ь', 'ю',
]
const SUPERLATIVE = ['ейше', 'ейш']
const DERIVATIONAL = ['ость', 'ости', 'остей', 'остью']

/**
 * @param {string} input
 * @returns {string}
 */
export function stem(input) {
  let word = normalize(input)
  if (word.length < 4) return word
  if (!/[а-я]/.test(word)) return word

  const { rv, r1, r2 } = regions(word)
  const tail = word.slice(rv)

  // Возвратные глаголы: «называться» → «называ»
  let reflexive = false
  if (tail.endsWith('ся') || tail.endsWith('сь')) {
    word = word.slice(0, -2)
    reflexive = true
  }

  const beforeR2 = word.slice(0, r2)
  let stemmed = strip(beforeR2, DERIVATIONAL, 4)
  if (stemmed === beforeR2) {
    const afterR1 = word.slice(r1)
    const withoutSuperlative = strip(afterR1, SUPERLATIVE, 4)
    if (withoutSuperlative !== afterR1) {
      word = word.slice(0, r1) + withoutSuperlative
    }
    if (reflexive) {
      // после -ся/-сь окончания прилагательных/глаголов маловероятны
      word = strip(word, ['а', 'я'], 3)
    } else {
      const w1 = strip(word, PERFECTIVE_GERUND, 4)
      if (w1 !== word) {
        word = w1
      } else {
        const w2 = strip(word, ADJECTIVE, 4)
        if (w2 !== word) {
          word = strip(w2, ['ее', 'ие', 'ые', 'ое', 'ими', 'ыми', 'ей', 'ий', 'ый', 'ой', 'ем', 'им', 'ом', 'его', 'ому', 'ему', 'их', 'ых', 'ую', 'юю', 'ая', 'яя', 'ою', 'ею'], 3)
        } else {
          const w3 = strip(word, VERB, 4)
          if (w3 !== word) {
            word = w3
          } else {
            word = strip(word, NOUN, 3)
          }
        }
      }
    }
  } else {
    word = stemmed
  }

  return word
}

/** @param {string} text */
export function tokenize(text) {
  return normalize(text)
    .split(/[^a-zа-я0-9]+/i)
    .filter((token) => token.length > 1)
    .map(stem)
}

export { VOWELS }
