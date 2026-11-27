import test from "node:test"
import assert from "node:assert/strict"
import { FUTHARK, explainHow, explainRunes, layRunes, runeBackSvg, runeById, runeSvg } from "./runes.js"
import { HALL_ORDER, heroById } from "./heroes.js"
import { laySpread } from "./spreads.js"

const banned = /вселенн|энерг|мудрост(ь|и)|доверьтесь потоку|диагноз|предк/i

test("24 руны старшего футарка, все разные", () => {
  assert.equal(FUTHARK.length, 24)
  assert.equal(new Set(FUTHARK.map((rune) => rune.id)).size, 24)
  assert.equal(new Set(FUTHARK.map((rune) => rune.mark)).size, 24)
  assert.equal(FUTHARK[0].name, "Феху")
  assert.equal(FUTHARK[23].name, "Отал")
  for (const rune of FUTHARK) {
    assert.equal(rune.kind, "rune")
    assert.ok(rune.how && rune.meaning && rune.a && rune.hint && rune.mark)
    assert.match(rune.meaning, /[А-ЯЁ]/)
    assert.ok(rune.meaning.length > 120, rune.id)
    assert.match(rune.meaning, /\. .+\./)
    assert.doesNotMatch(rune.meaning, /Как это будет/)
    assert.doesNotMatch(`${rune.meaning} ${rune.how} ${rune.a}`, banned)
    assert.match(rune.meaning, /\n\nПростыми словами:/)
    const [image, gloss] = rune.meaning.split("Простыми словами:")
    assert.ok(image.trim().length > 40, rune.id)
    assert.ok(gloss.trim().length > 80, rune.id)
    assert.doesNotMatch(rune.meaning, /— нет|рот — |ход пойдёт|вас уже протянули|таран —/)
    assert.doesNotMatch(rune.meaning, /(?<![\p{L}])(скот\p{L}*|стад\p{L}*|бык\p{L}*|рога|рогом|лосин\p{L}*|на рожон)/u)
  }
})

test("норны отвечают способом", () => {
  const line = explainHow([runeById("isa"), runeById("raidho"), runeById("sowilo")])
  assert.match(line, /льдом/)
  assert.match(line, /дорогой/)
  assert.match(line, /напрямую, при свете/)
  assert.match(line, /Откуда это уже движется/)
  assert.doesNotMatch(line, /Откуда:/)
})

test("Эйнар открыт и кладёт одну или три руны", () => {
  const einar = heroById("einar")
  assert.equal(einar.locked, false)
  assert.ok(HALL_ORDER.includes("einar"))
  const one = laySpread(einar, { question: "Как пойдёт?", roles: einar.sizes[0].roles }, () => 0)
  assert.equal(one.cards.length, 1)
  assert.equal(one.cards[0].card.kind, "rune")
  assert.equal(one.reading.title, "Руны ответили")
  assert.equal(one.reading.layout, "runes")
  assert.equal(one.reading.lead, "")
  assert.match(one.reading.items[0].open, /говорит руна/)
  assert.match(one.reading.note, /^Вы спросили: «Как пойдёт\?»\. Легла руна «[^»]+»\./)
  assert.match(one.reading.note, /Что советуют руны — /)
  assert.doesNotMatch(one.reading.note, /Как это будет|карты|карта /)
  const three = laySpread(einar, { question: "Как пойдёт?", roles: einar.sizes[1].roles }, () => 0)
  assert.equal(three.cards.length, 3)
  assert.deepEqual(three.cards.map((item) => item.role), ["Откуда идёт", "Как идёт", "Как придёт"])
  assert.equal(new Set(three.cards.map((item) => item.card.id)).size, 3)
})

test("рубашка руны переворачивается как карта", () => {
  assert.match(runeBackSvg(), /class="rune-face back"/)
  assert.match(runeBackSvg(), /rune-bg/)
})

test("руна — только камень", () => {
  assert.equal(runeById("fehu").img, "assets/runes/fehu.webp")
  assert.equal(runeById("isa").img, "assets/runes/isa.webp")
  const svg = runeSvg(runeById("fehu"))
  assert.match(svg, /class="rune-face"/)
  assert.match(svg, /rune-mark/)
  assert.doesNotMatch(svg, /rect /)
})

test("руна нарисована линией, у каждой свой знак", () => {
  for (const rune of FUTHARK) {
    const svg = runeSvg(rune)
    assert.match(svg, /<path class="rune-mark"/)
    assert.doesNotMatch(svg, /<text/)
  }
  assert.notEqual(runeSvg(runeById("isa")), runeSvg(runeById("fehu")))
})

test("тот же вопрос даёт те же руны", () => {
  const a = layRunes({ question: "Как он вернётся?", roles: ["Ход"] }, () => 0.31)
  const b = layRunes({ question: "Как он вернётся?", roles: ["Ход"] }, () => 0.31)
  assert.equal(a.cards[0].card.id, b.cards[0].card.id)
})

function readingOf(id, question, roles = ["Ход"]) {
  const rune = runeById(id)
  return explainRunes({
    cards: roles.map((role) => ({ role, card: rune })),
    question,
  })
}

const JOBBY = /в работе|рабочий шаг|Доведите работу/

test("на уход Эйнар отвечает ходом, а не работой и не да/нет", () => {
  const q = "Стоит ли уходить или остаться?"
  const said = (reading) => [reading.lead, ...reading.items.map((item) => `${item.open}\n${item.body}`), reading.note].join("\n")
  const ice = readingOf("isa", q)
  assert.match(said(ice), /не сдвинется|льдом|Иса/)
  assert.match(said(ice), /уход/)
  assert.match(said(ice), /Вы спросили: «Стоит ли уходить или остаться\?»\. Легла руна «Иса»/)
  assert.doesNotMatch(said(ice), JOBBY)
  const road = readingOf("raidho", q)
  assert.match(said(road), /дорогой|Сдвиг/)
  assert.doesNotMatch(said(road), /\bда\b|\bнет\b/)
  const stay = readingOf("eihwaz", q)
  assert.match(said(stay), /опор|не в уходе/)
  const craft = readingOf("kenaz", q)
  assert.doesNotMatch(said(craft), JOBBY)
  const job = readingOf("kenaz", "Как пойдёт на работе?")
  assert.match(job.items[0].body, /Простыми словами/)
  assert.equal(job.lead, "")
})

test("оранжевый вывод Эйнара пересказывает смысл другими словами", () => {
  const image = /(?<![\p{L}])(лёд|льдом|оттепел\p{L}*|град\p{L}*|шип\p{L}*|факел\p{L}*|конь\p{L}*|берёз\p{L}*|зерн\p{L}*|солнц\p{L}*|оград\p{L}*|копь\p{L}*|рек\p{L}*|колёс\p{L}*|чаш\p{L}*|тис\p{L}*|искр\p{L}*|рассвет\p{L}*|порог\p{L}*|кров\p{L}*|урожа\p{L}*|ворот\p{L}*|седл\p{L}*|щит\p{L}*)/u
  const words = (text) => text.toLowerCase().replace(/[^\p{L}\s]/gu, " ").split(/\s+/).filter(Boolean)
  const shared = (left, right, n = 5) => {
    const bag = new Set()
    const a = words(left)
    const b = words(right)
    for (let i = 0; i + n <= a.length; i += 1) bag.add(a.slice(i, i + n).join(" "))
    for (let i = 0; i + n <= b.length; i += 1) {
      const row = b.slice(i, i + n).join(" ")
      if (bag.has(row)) return row
    }
    return ""
  }
  for (const rune of FUTHARK) {
    const note = explainRunes({ cards: [{ role: "Ход", card: rune }], question: "Как пойдёт?" }).note
    const plain = rune.meaning.split("Простыми словами:")[1]
    assert.match(note, /^Вы спросили: «Как пойдёт\?»\. Легла руна «[^»]+»\./)
    assert.match(note, /Что советуют руны — /)
    const tail = note.split("\n\n").slice(1).join("\n\n")
    assert.doesNotMatch(tail, /руна|Простыми словами/)
    assert.doesNotMatch(note, image, rune.id)
    assert.equal(shared(plain, tail), "", `${rune.id}: ${shared(plain, tail)}`)
    assert.equal(shared(rune.a, note.split("Что советуют руны — ")[1] || ""), "", rune.id)
  }
  const three = explainRunes({
    cards: [
      { role: "Откуда идёт", card: runeById("isa") },
      { role: "Как идёт", card: runeById("raidho") },
      { role: "Как придёт", card: runeById("sowilo") },
    ],
    question: "Как пойдёт?",
  })
  const from = three.note.indexOf("стоит на месте")
  const now = three.note.indexOf("Само это к вам не придёт")
  const toward = three.note.indexOf("Скрыть шаг не получится")
  assert.ok(from >= 0 && now > from && toward > now)
  assert.doesNotMatch(three.note, /говорит руна|слушайте первую/)
})

test("пояснение Эйнара говорит целыми фразами", () => {
  const ice = readingOf("isa", "Как он вернётся?")
  assert.equal(ice.lead, "")
  assert.ok(ice.items[0].body.length > 180)
  assert.match(ice.items[0].body, /льдом/)
  assert.match(ice.note, /стоит на месте/)
  const iceTail = ice.note.split("\n\n").slice(1).join("\n\n")
  assert.doesNotMatch(iceTail, /руна|Простыми словами|оттепел|льдом|лёд/)
  assert.match(ice.items[0].body, /оттепел|не сдвинется/)
  const norns = explainHow([runeById("isa"), runeById("raidho"), runeById("sowilo")])
  assert.match(norns, /Пока лёд держит/)
  assert.match(norns, /сдвинуться/)
  assert.ok(norns.length > 280)
})
