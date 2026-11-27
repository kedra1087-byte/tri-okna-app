/** Убирает из ответа предложение, которое слово в слово повторяет уже сказанное.
 * Источник не важен: колода, вывод, уточнение или модель. Четыре слова подряд — уже повтор.
 */

const WORD = /[а-яёa-z0-9]+/gi

export function wordsOf(text) {
  return String(text || "").toLowerCase().replace(/ё/g, "е").match(WORD)?.filter((word) => word.length >= 2) || []
}

export function phraseWindow(text, size = 4) {
  const words = wordsOf(text)
  const bag = new Set()
  for (let index = 0; index + size <= words.length; index += 1) {
    bag.add(words.slice(index, index + size).join(" "))
  }
  return bag
}

export function repeatsPhrase(text, prior, size = 4) {
  const bag = prior instanceof Set ? prior : phraseWindow(prior, size)
  const words = wordsOf(text)
  for (let index = 0; index + size <= words.length; index += 1) {
    if (bag.has(words.slice(index, index + size).join(" "))) return true
  }
  return false
}

/** Оставляет предложения, которых ещё не было. Подпись «Итог расклада.» не теряется, если первое предложение ушло. */
export function dropEcho(text, prior, size = 4) {
  const source = String(text || "").trim()
  if (!source) return ""
  const labeled = /^\s*вывод\./i.test(source)
  const bag = prior instanceof Set ? prior : new Set(phraseWindow(prior, size))
  const blocks = []
  for (const block of source.split(/\n\n+/)) {
    const kept = []
    for (const sentence of block.split(/(?<=[.!?…])\s+/)) {
      const line = sentence.trim()
      if (!line || repeatsPhrase(line, bag, size)) continue
      kept.push(line)
      for (const phrase of phraseWindow(line, size)) bag.add(phrase)
    }
    if (kept.length) blocks.push(kept.join(" "))
  }
  if (!blocks.length) return ""
  if (labeled) blocks[0] = blocks[0].replace(/^\s*вывод\.\s*/i, "")
  if (labeled && !/^\s*итог расклада\./i.test(blocks[0])) blocks[0] = `Итог расклада. ${blocks[0]}`
  return blocks.join("\n\n")
}
