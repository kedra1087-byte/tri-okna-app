import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { HEXAGRAMS, explainHex, flipLine, hexFromLines, hexByNumber, hexSvg, layHexagram } from "./hexagrams.js"
import { heroById, HALL_ORDER } from "./heroes.js"
import { laySpread } from "./spreads.js"

test("64 знака, все разные, известные эталоны на месте", () => {
  assert.equal(HEXAGRAMS.length, 64)
  assert.equal(new Set(HEXAGRAMS.map((card) => card.lines.join(""))).size, 64)
  assert.deepEqual(hexByNumber(1).lines, [1, 1, 1, 1, 1, 1])
  assert.deepEqual(hexByNumber(2).lines, [0, 0, 0, 0, 0, 0])
  assert.deepEqual(hexByNumber(11).lines, [1, 1, 1, 0, 0, 0])
  assert.deepEqual(hexByNumber(24).lines, [1, 0, 0, 0, 0, 0])
  assert.notDeepEqual(hexByNumber(9).lines, hexByNumber(44).lines)
  assert.equal(hexByNumber(64).name, "Ещё рано")
  assert.match(hexByNumber(52).meaning, /Останьтесь/)
  assert.doesNotMatch(HEXAGRAMS.map((card) => card.meaning).join("\n"), /Если выбираете/)
  assert.doesNotMatch(HEXAGRAMS.map((card) => card.meaning + card.a).join("\n"), /час без ответа|прокусить|гниль|панцир|хвост тигра/)
})

test("знак Линь — лаковая дощечка, не карта таро", () => {
  assert.equal(hexByNumber(1).img, "assets/hex/1.webp")
  assert.equal(hexByNumber(2).img, "assets/hex/2.webp")
  const svg = hexSvg(hexByNumber(1))
  assert.match(svg, /viewBox="0 0 80 96"/)
  assert.match(svg, /hex-bg/)
  assert.match(svg, /hex-in/)
  const yin = hexSvg(hexByNumber(2))
  assert.match(yin, /x="14"[^>]*width="20"/)
  assert.match(yin, /x="46"[^>]*width="20"/)
  const qian = readFileSync(new URL("../assets/hex/1.webp", import.meta.url))
  const kun = readFileSync(new URL("../assets/hex/2.webp", import.meta.url))
  const empty = readFileSync(new URL("../assets/hex-empty.webp", import.meta.url))
  const yangBar = readFileSync(new URL("../assets/hex-bars/yang-0.webp", import.meta.url))
  const yinBar = readFileSync(new URL("../assets/hex-bars/yin-0.webp", import.meta.url))
  assert.ok(qian.length > 20000)
  assert.ok(kun.length > 20000)
  assert.ok(empty.length > 20000)
  assert.ok(yangBar.length > 2000)
  assert.ok(yinBar.length > 2000)
  assert.notEqual(Buffer.compare(qian, kun), 0)
  assert.notEqual(Buffer.compare(yangBar, yinBar), 0)
})

test("перемена одной черты даёт другой знак", () => {
  const next = hexFromLines(flipLine(hexByNumber(11).lines, 0))
  assert.ok(next && next.n !== 11)
})

test("Линь открыта и кладёт один или два знака", () => {
  const lin = heroById("lin")
  assert.equal(lin.locked, false)
  assert.ok(HALL_ORDER.includes("lin"))
  const one = laySpread(lin, { question: "Уходить?", roles: lin.sizes[0].roles }, () => 0)
  assert.equal(one.cards.length, 1)
  assert.equal(one.cards[0].card.lines.length, 6)
  assert.match(one.reading.lead, /Так знак «.+» отвечает на вопрос «Уходить\?»/)
  assert.doesNotMatch(one.reading.lead, /Красный|кружок|ромб|старш/)
  assert.match(one.reading.note, /Вы спросили: «Уходить\?»/)
  assert.match(one.reading.note, /Итог расклада\./)
  assert.doesNotMatch(one.reading.note, /Знак светлая|карт/)
  const two = laySpread(lin, { question: "Уходить?", roles: lin.sizes[1].roles }, () => 0)
  assert.equal(two.throws.length, 6)
  assert.equal(two.cards.length, 2)
  assert.equal(two.cards[0].role, "Сейчас")
  assert.equal(two.cards[1].role, "Перемена")
  assert.match(lin.sizes[1].gives, /не двенадцать/)
  assert.match(lin.sizes[1].gives, /две дощечки/)
  assert.match(two.reading.lead, /Уходить\?/)
  assert.match(two.reading.lead, /Сейчас:|второго знака нет/)
  assert.doesNotMatch(one.reading.lead, /Сейчас:|второго знака нет/)
  assert.doesNotMatch(two.reading.lead, /Красный кружок/)
  assert.doesNotMatch(two.reading.note, /карт/)
})

test("три монеты: шесть бросков и старшие черты", () => {
  const allOld = layHexagram({ question: "Ждать?", roles: ["Сейчас", "Перемена"] }, () => 0)
  assert.equal(allOld.throws.length, 6)
  assert.ok(allOld.throws.every((row) => row.sum === 6 && row.moving))
  assert.equal(allOld.cards[0].card.n, 2)
  assert.equal(allOld.cards[1].card.n, 1)
  assert.deepEqual(allOld.moving, [0, 1, 2, 3, 4, 5])
  let i = 0
  const young = layHexagram({ question: "Ждать?", roles: ["Сейчас", "Перемена"] }, () => [0.7, 0.1, 0.7][i++ % 3])
  assert.ok(young.throws.every((row) => row.sum === 8 && !row.moving))
  assert.equal(young.cards.length, 2)
  assert.equal(young.cards[1].role, "Перемена")
  assert.equal(young.cards[1].vacant, true)
  assert.equal(young.moving.length, 0)
  assert.match(young.reading.lead, /второго знака нет/)
})

test("тот же вопрос даёт тот же знак", () => {
  const a = layHexagram({ question: "Ждать?", roles: ["Знак"] }, () => 0.31)
  const b = layHexagram({ question: "Ждать?", roles: ["Знак"] }, () => 0.31)
  assert.equal(a.cards[0].card.id, b.cards[0].card.id)
  assert.deepEqual(a.throws.map((row) => row.sum), b.throws.map((row) => row.sum))
})

function readingOf(n, question) {
  return explainHex({
    cards: [{ role: "Знак", card: hexByNumber(n) }],
    question,
  })
}

const JOBBY = /в работе|рабочий шаг|Доведите работу/

test("на уход Линь отвечает выбором, а не работой", () => {
  const q = "Стоит ли уходить или остаться?"
  const mountain = readingOf(52, q)
  assert.match(mountain.lead, /уходить или остаться/)
  assert.match(mountain.lead, /Останьтесь/)
  assert.doesNotMatch(mountain.lead + mountain.note, JOBBY)
  const constant = readingOf(32, q)
  assert.match(constant.lead, /Останьтесь/)
  assert.doesNotMatch(constant.lead + constant.note, JOBBY)
  const modest = readingOf(15, q)
  assert.doesNotMatch(modest.lead + modest.note, JOBBY)
  const free = readingOf(40, q)
  assert.match(free.lead, /Уходите|развязыва/i)
  const job = readingOf(32, "Стоит ли менять работу?")
  assert.match(job.lead, /менять работу/)
  assert.match(job.note, /вчерашний шаг/)
})

function readingText(reading) {
  return [reading.lead, ...(reading.items || []).map((item) => item.body), reading.note].join("\n")
}

function countChunk(hay, needle) {
  const bit = String(needle || "").trim()
  if (bit.length < 12) return 0
  let n = 0
  let i = 0
  while ((i = hay.indexOf(bit, i)) !== -1) {
    n += 1
    i += bit.length
  }
  return n
}

test("Линь не повторяет одно толкование дважды", () => {
  const q = "Уходить из этих отношений или остаться в них?"
  const one = readingOf(52, q)
  const text = readingText(one)
  assert.equal(countChunk(text, hexByNumber(52).meaning), 1)
  assert.equal(countChunk(text, hexByNumber(52).a), 1)
  assert.equal(one.items.length, 0)
  const two = layHexagram({ question: q, roles: ["Сейчас", "Перемена"] }, () => 0)
  const both = readingText(two.reading)
  const now = two.cards[0].card
  const later = two.cards[1].card
  assert.equal(countChunk(both, now.meaning), 1)
  assert.equal(countChunk(both, later.meaning), 1)
  assert.equal(countChunk(both, later.a), 1)
  assert.equal(countChunk(two.reading.lead, later.meaning), 0)
  assert.equal(two.reading.items.length, 1)
  assert.equal(two.reading.items[0].role, "Перемена")
})
