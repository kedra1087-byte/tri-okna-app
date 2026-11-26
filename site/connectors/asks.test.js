import test from "node:test"
import assert from "node:assert/strict"
import { DECK } from "./arkanum-data.js"
import { HEROES } from "./heroes.js"
import { applyCard, boundLot } from "./topic.js"
import { faceLine, faceVerdict, preparedFace } from "./asks.js"
import { synthesize } from "./synthesis.js"
import { phraseWindow } from "./echo.js"

const ROLES = ["", "Вы", "Другой человек", "Что между вами", "Суть вопроса", "Что делать", "К чему идёт", "Деньги"]

function shared(left, right) {
  const bag = phraseWindow(left)
  for (const phrase of phraseWindow(right)) {
    if (bag.has(phrase)) return phrase
  }
  return ""
}

test("у каждого заготовленного вопроса карт свой ответ", () => {
  const prompts = HEROES.filter((hero) => ["iris", "nerra", "sol", "cael"].includes(hero.id)).flatMap((hero) => hero.prompts)
  assert.equal(prompts.length, 20)
  for (const prompt of prompts) {
    const face = preparedFace(prompt)
    assert.ok(face, prompt)
    const seen = new Set()
    for (const turn of [0, 1, 2, 3, 4, 5, 6, 7]) {
      const texts = new Map()
      for (const card of DECK) {
        for (const role of ROLES) {
          const line = faceLine(card, face, role, turn)
          assert.ok(line, `${prompt} ${card.id} ${role}`)
          assert.match(line, /[а-яё]/i, line)
          assert.doesNotMatch(line, /(?<![а-яё])(?:он|она|муж|жена|мужчина|женщина|парень|девушка)(?![а-яё])/i, line)
          const owner = texts.get(line)
          if (owner && !owner.startsWith(`${card.id} `)) assert.fail(`${card.id} ${role} повторяет ${owner}: ${line}`)
          if (!owner) texts.set(line, `${card.id} ${role}`)
          seen.add(line)
        }
      }
      const lines = [...texts.keys()]
      for (let i = 0; i < lines.length; i += 1) {
        for (let j = i + 1; j < lines.length; j += 1) {
          const hit = shared(lines[i], lines[j])
          assert.equal(hit, "", `${lines[i]} || ${lines[j]} → ${hit}`)
        }
      }
    }
    for (const score of [2, 0, -2]) {
      const verdict = faceVerdict(face, score, "На вопрос, уходить или остаться, карты отвечают: лучше остаться.")
      assert.ok(verdict, face)
      for (const line of seen) {
        const hit = shared(line, verdict)
        assert.equal(hit, "", `${face} ${score}: ${hit}\n${line}\n${verdict}`)
      }
    }
  }
})

test("новая раскладка берёт другую фразу той же карты", () => {
  const card = DECK.find((item) => item.id === "mag")
  const lines = new Set([0, 1, 2, 3, 4, 5].map((turn) => faceLine(card, "agree", "", turn)))
  assert.ok(lines.size >= 3, [...lines].join(" | "))
})

test("спор остаётся спором и может быть внутренним конфликтом", () => {
  const line = applyCard(DECK.find((card) => card.id === "wands_5"), "Стоит ли соглашаться?", "s").act
  assert.match(line, /спор/)
  assert.match(line, /внутренн/)
})

test("срок и месяц в ответе не назначаются", () => {
  for (const turn of [0, 1, 2, 3, 4, 5, 6, 7]) {
    for (const card of DECK) {
      const meet = faceLine(card, "meet", "Другой человек", turn)
      const money = faceLine(card, "money", "", turn)
      const ahead = faceLine(card, "ahead", "", turn)
      const job = faceLine(card, "job", "", turn)
      assert.match(meet, /срок|дат/i, meet)
      assert.doesNotMatch(meet, /январ|феврал|март|апрел|ма[йя]|июн|июл|август|сентябр|октябр|ноябр|декабр|в этот день/i, meet)
      assert.match(money, /месяц/i, money)
      assert.match(money, /деньг/i, money)
      assert.doesNotMatch(money, /в этом месяце будут/i, money)
      assert.match(ahead, /ждёт|впереди|перемен/i, ahead)
      assert.match(job, /работе/, job)
    }
  }
})

test("оранжевый вывод отвечает на заготовленный вопрос и не повторяет карту", () => {
  const samples = [
    ["Меня любят?", ["Вы", "Другой человек", "Что между вами"], ["sun", "hermit", "lovers"], /люб/i],
    ["Что этот человек ко мне чувствует?", ["Вы", "Другой человек", "Что между вами"], ["cups_2", "moon", "tower"], /чувств|тепл|холод/i],
    ["Есть ли у нас будущее?", ["Вы", "Другой человек", "Что между вами"], ["world", "death", "temperance"], /будущ/i],
    ["Уходить из отношений или остаться?", ["Вы", "Другой человек", "Что между вами"], ["hermit", "fool", "moon"], /остать|уход/i],
    ["Как мне поступить?", ["Суть вопроса", "Что делать", "К чему идёт"], ["mag", "hanged", "star"], /поступ|ход|действ/i],
    ["Стоит ли менять работу?", ["Суть вопроса", "Что делать", "К чему идёт"], ["wands_8", "pentacles_4", "fool"], /работ/i],
    ["Будут ли деньги в этом месяце?", ["Где вы сейчас", "Деньги", "Куда идёт"], ["pentacles_ace", "cups_4", "pentacles_king"], /деньг|месяц/i],
    ["Куда мне идти дальше?", ["Карта знака", "Куда идёт", "Что делать"], ["chariot", "hermit", "wheel"], /идти|сторон|дальше/i],
  ]
  for (const [question, roles, ids, expect] of samples) {
    const cards = ids.map((id, index) => boundLot({ role: roles[index], card: DECK.find((card) => card.id === id) }, question, "s"))
    const note = synthesize({ cards, question })
    assert.match(note, /^Итог расклада\. /, note)
    assert.match(note, expect, note)
    for (const item of cards) assert.equal(shared(item.card.meaning, note), "", `${item.card.meaning} || ${note}`)
  }
})
