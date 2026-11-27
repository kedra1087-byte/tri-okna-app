import test from "node:test"
import assert from "node:assert/strict"
import { DECK } from "./arkanum-data.js"
import { synthesize } from "./synthesis.js"

const card = (id) => DECK.find((item) => item.id === id)
const lay = (roles, ids) => ids.map((id, index) => ({ role: roles[index], card: card(id) }))
const QUESTION = ["Суть вопроса", "Что делать", "К чему идёт"]

test("трудное начало и светлый итог объясняются как движение, а не спор", () => {
  const note = synthesize({ cards: lay(QUESTION, ["pentacles_5", "wands_6", "cups_2"]), question: "Что с работой?" })
  assert.match(note, /^Итог расклада\. /)
  assert.match(note, /Пятёрка Пентаклей: /)
  assert.match(note, /ваш труд заметят/)
  assert.match(note, /Сначала будет труднее, чем в конце/)
  assert.match(note, /Вместе карты складываются/)
  assert.doesNotMatch(note, /Если сложить карты в одну историю|суть вопроса — «|называет карта|показывает карта|Холодно у двери|Вас заметят и похвалят|Встреча и взаимность/)
  assert.match(note, /Что советуют карты — Поднимите голову/)
})

test("разное состояние двоих называется прямо", () => {
  const roles = ["Вы", "Другой человек", "Что между вами", "Что мешает", "Куда идёт"]
  const note = synthesize({ cards: lay(roles, ["cups_5", "sun", "cups_2", "star", "wands_10"]), question: "Что у нас?" })
  assert.match(note, /вы и другой человек сейчас в разном состоянии|вы и другой человек сейчас на разных берегах|чувствуют по-разному/)
  assert.match(note, /Мешает, как ни странно, «Звезда» — и это не плохая карта|Помеха в раскладе — «Звезда», карта светлая/)
  assert.doesNotMatch(note, /Шаг: Верьте|Шаг: /)
  assert.doesNotMatch(note, /карта «|надежда/)
})

test("одна карта даёт тон и шаг, день без вопроса — про день", () => {
  assert.match(synthesize({ cards: lay(["Ответ"], ["hermit"]), question: "Ехать?" }), /^Итог расклада\. Не решайте сгоряча.*Что советует карта — /s)
  assert.doesNotMatch(synthesize({ cards: lay(["Ответ"], ["hermit"]), question: "Ехать?" }), /карта «/)
  const day = synthesize({ cards: lay(["Утро", "День", "Вечер"], ["swords_3", "swords_9", "tower"]) })
  assert.match(day, /^Итог расклада\. День непростой/)
  assert.match(day, /Все карты тяжёлые — в первую очередь «Тройка Мечей»/)
})

test("в описании каждой карты есть совет, что делать", () => {
  const skip = new Set(["видите", "стоите", "хотите", "можете", "знаете", "думаете", "идёте", "несётесь", "позовёте", "будете", "услышите", "слышите", "любите", "справитесь"])
  const re = /(^|[^\p{L}])((?:не\s+)?[\p{L}-]*(?:итесь|йтесь|ьтесь|йте|ите|ьте))(?![\p{L}])/giu
  for (const card of DECK) {
    const verbs = []
    for (const match of card.meaning.matchAll(re)) {
      const verb = match[2].replace(/^не\s+/iu, "").toLowerCase()
      if (!skip.has(verb)) verbs.push(verb)
    }
    assert.ok(verbs.length, `${card.id}: ${card.meaning}`)
  }
})

test("у каждой карты свой вывод без её имени", () => {
  for (const item of DECK) {
    const note = synthesize({ cards: [{ role: "Ответ", card: item }], question: "Как быть?" })
    const name = item.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    assert.match(note, /^Итог расклада\. /)
    assert.doesNotMatch(note, new RegExp(name))
    assert.doesNotMatch(note, /называет карта|показывает карта|говорит карта/)
  }
})

test("нейтральное начало не называется светлым", () => {
  const note = synthesize({ cards: lay(QUESTION, ["swords_king", "cups_page", "swords_3"]), question: "Что с работой?" })
  assert.match(note, /Начало ровное, а к концу становится тяжелее/)
  assert.doesNotMatch(note, /легла карта|боль правды/)
  assert.doesNotMatch(note, /Начало светлое/)
})
