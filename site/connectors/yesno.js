/** Одна карта на прямой вопрос. Один и тот же вопрос в один день получает ту же карту: карту не перетягивают. */

import { DECK } from "./arkanum-data.js"

const YES = "yes"
const NO = "no"
const WAIT = "wait"

const VERDICT = {
  fool: YES, mag: YES, priestess: WAIT, empress: YES, emperor: YES, hierophant: YES, lovers: YES,
  chariot: YES, strength: YES, hermit: WAIT, wheel: YES, justice: WAIT, hanged: WAIT, death: NO,
  temperance: YES, devil: NO, tower: NO, star: YES, moon: NO, sun: YES, judgement: YES, world: YES,
  wands_ace: YES, wands_2: YES, wands_3: YES, wands_4: YES, wands_5: WAIT, wands_6: YES, wands_7: WAIT,
  wands_8: YES, wands_9: WAIT, wands_10: NO, wands_page: YES, wands_knight: YES, wands_queen: YES, wands_king: YES,
  cups_ace: YES, cups_2: YES, cups_3: YES, cups_4: WAIT, cups_5: NO, cups_6: YES, cups_7: WAIT,
  cups_8: NO, cups_9: YES, cups_10: YES, cups_page: YES, cups_knight: YES, cups_queen: YES, cups_king: YES,
  swords_ace: YES, swords_2: WAIT, swords_3: NO, swords_4: WAIT, swords_5: NO, swords_6: WAIT, swords_7: NO,
  swords_8: NO, swords_9: NO, swords_10: NO, swords_page: WAIT, swords_knight: WAIT, swords_queen: WAIT, swords_king: WAIT,
  pentacles_ace: YES, pentacles_2: WAIT, pentacles_3: YES, pentacles_4: WAIT, pentacles_5: NO, pentacles_6: YES, pentacles_7: WAIT,
  pentacles_8: YES, pentacles_9: YES, pentacles_10: YES, pentacles_page: YES, pentacles_knight: WAIT, pentacles_queen: YES, pentacles_king: YES,
}

export const VERDICT_WORD = { [YES]: "Да", [NO]: "Нет", [WAIT]: "Не сейчас" }

const VERDICT_LINE = {
  [YES]: "Карта говорит «да». Это не гарантия, а направление: дверь открыта, если вы в неё пойдёте.",
  [NO]: "Карта говорит «нет». В таком виде, как спрошено, это не сложится — стоит поменять сам план.",
  [WAIT]: "Карта не даёт прямого ответа: условия ещё складываются. Вернитесь к вопросу позже или разложите полный расклад.",
}

export function normalizeQuestion(text) {
  return String(text || "").toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-я0-9]+/g, " ").trim()
}

export function yesNo(question, { name = "", day = "" } = {}) {
  const seed = `${day}|${name.trim().toLowerCase()}|${normalizeQuestion(question)}`
  let hash = 2166136261
  for (let i = 0; i < seed.length; i += 1) hash = Math.imul(hash ^ seed.charCodeAt(i), 16777619) >>> 0
  const card = DECK[hash % DECK.length]
  const verdict = VERDICT[card.id] || WAIT
  return { card, verdict, word: VERDICT_WORD[verdict], line: VERDICT_LINE[verdict] }
}

export function verdictOf(id) {
  return VERDICT[id] || WAIT
}
