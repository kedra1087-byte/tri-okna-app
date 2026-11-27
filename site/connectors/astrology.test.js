import assert from "node:assert/strict"
import test from "node:test"
import { arcanaByNumber, birthArcana, detectTopic, followupAnswer, layQuestion, personalize, profileFrom, zodiac } from "./arkanum.js"
import { byId, cardCorrespondence, decanCard } from "./arkanum.js"
import { MAJORS } from "./decks.js"
import { decanOf, readSky, sunSign } from "./astrology.js"
import { createUnlocks } from "./unlocks.js"
import { laySpread, explainSpread } from "./spreads.js"
import { HALL_ORDER, heroById, sizeOf } from "./heroes.js"

test("sun sign uses Golden Dawn majors", () => {
  assert.equal(sunSign("1990-03-30").id, "aries")
  assert.equal(sunSign("1990-03-30").major, "emperor")
  assert.equal(sunSign("1990-01-05").id, "capricorn")
})

test("decan names the planetary ruler", () => {
  const decan = decanOf("1990-03-21")
  assert.equal(decan.index, 0)
  assert.equal(decan.ruler, "Марс")
})

test("sky connector leaves a place for a full chart", () => {
  const sky = readSky({ birthDate: "1990-07-25", birthTime: "10:00", birthPlace: "Москва" })
  assert.equal(sky.sun.id, "leo")
  assert.equal(sky.rising, null)
  assert.equal(sky.plug, "ephemeris")
})

const paidSeat = (id) => ({ id, locked: true, sku: `hero-${id}`, price: "место за столом" })

test("every table in the hall is free", () => {
  const unlocks = createUnlocks()
  for (const id of HALL_ORDER) assert.equal(unlocks.canUse(heroById(id)), true)
})

test("locked hero stays locked until payment connector confirms", async () => {
  const unlocks = createUnlocks()
  const hero = paidSeat("nerra")
  assert.equal(unlocks.canUse(hero), false)
  await assert.rejects(() => unlocks.purchase(hero), (error) => error.code === "PAYMENTS_NOT_CONNECTED")
  assert.equal(unlocks.canUse(hero), false)
})

test("payment connector opens only the bought hero", async () => {
  const unlocks = createUnlocks({
    payments: { async purchase(sku) { return { ok: sku === "hero-nerra" } } },
  })
  const hero = paidSeat("nerra")
  await unlocks.purchase(hero)
  assert.equal(unlocks.canUse(hero), true)
  assert.equal(unlocks.canUse(paidSeat("sol")), false)
})

test("two free heroes lay different spreads", () => {
  const iris = laySpread(heroById("iris"), { birthDate: "1990-03-30", name: "Анна", question: "Как поступить с договором?" }, () => 0)
  const cael = laySpread(heroById("cael"), { birthDate: "1990-03-30", question: "Как поступить с договором?" }, () => 0)
  assert.equal(iris.id, "question")
  assert.deepEqual(iris.cards.map((item) => item.role), ["Суть вопроса", "Что делать", "К чему идёт"])
  assert.equal(cael.id, "decan")
  assert.equal(cael.cards.length, 3)
  assert.equal(cael.cards[0].card.id, "emperor")
  assert.deepEqual(cael.cards.slice(1).map((item) => item.role), ["На этот вопрос", "Куда ведёт"])
  assert.equal(iris.reading.title, "Карты ответили")
  assert.equal(iris.reading.layout, "cards")
  assert.equal(iris.reading.lead, "")
  assert.match(iris.reading.items.map((item) => item.open).join(" "), /Суть вопроса называет карта/)
  assert.ok(iris.reading.items.every((item) => item.body.length > 40))
  assert.match(iris.reading.note, /^Вы спросили: «[^»]+»\. Карты легли: /)
  assert.match(iris.reading.note, /Итог расклада\./)
  assert.match(iris.reading.note, /Что советуют карты — /)
  assert.doesNotMatch(iris.reading.note, /Если сложить карты в одну историю/)
  assert.match(cael.reading.note, /Итог расклада\./)
  assert.equal(cael.reading.layout, "cards")
  assert.equal(cael.reading.lead, "")
  assert.match(cael.reading.items[0].body, /декан/)
  assert.ok(cael.reading.items[1].body.length > 40)
  assert.ok(cael.reading.items[2].body.length > 40)
  assert.equal(iris.reading.items.length, 3)
  assert.equal(iris.profile.sign, "Овен")
  assert.equal(iris.profile.arcana, 7)
  assert.equal(cael.reading.items.length, 3)
  const sameSky = { birthDate: "1986-09-07" }
  const path = laySpread(heroById("cael"), { ...sameSky, question: "о себе и своём пути" }, () => 0)
  const raise = laySpread(heroById("cael"), { ...sameSky, question: "когда меня повысят" }, () => 0)
  assert.equal(path.cards[0].card.id, "hermit")
  assert.equal(raise.cards[0].card.id, "hermit")
  assert.notEqual(
    path.cards.slice(1).map((item) => item.card.id).join(","),
    raise.cards.slice(1).map((item) => item.card.id).join(","),
  )
  assert.notEqual(
    path.reading.items.map((item) => item.body).join("\n"),
    raise.reading.items.map((item) => item.body).join("\n"),
  )
  assert.equal(explainSpread(iris).title, "Карты ответили")
})

test("подсказки вопроса остаются на теме стола", () => {
  const nerra = heroById("nerra")
  const love = [...nerra.prompts, nerra.followPrompt].join(" ")
  assert.match(love, /чувств|любит|будущее|встреч/i)
  assert.doesNotMatch(love, /начальник|работ|деньг/i)
  for (const text of nerra.prompts) {
    assert.match(text, /он|люб|отношен|будущ|встреч|чувств/i)
  }
  const sol = heroById("sol")
  const work = [...sol.prompts, sol.followPrompt].join(" ")
  assert.match(work, /работ|деньг|начальник|повышен/)
  assert.doesNotMatch(work, /чувств|встреч|люб/)
  for (const text of sol.prompts) {
    assert.match(text, /работ|деньг|начальник|повышен/)
  }
  const iris = heroById("iris")
  assert.doesNotMatch(iris.prompts.join(" "), /отношен|работ|деньг|начальник/)
  const cael = heroById("cael")
  for (const text of cael.prompts) {
    assert.match(text, /путь|идти|учит|шаг|во мне/)
  }
  assert.doesNotMatch(cael.prompts.join(" "), /отношен|работ|деньг/)
  const einar = heroById("einar")
  for (const text of einar.prompts) {
    assert.match(text, /^Как /)
  }
  for (const id of HALL_ORDER) {
    const person = heroById(id)
    assert.ok(person.prompts.length >= 3 && person.prompts.length <= 5)
    assert.ok(person.followPrompt)
    assert.equal(new Set(person.prompts).size, person.prompts.length)
    for (const text of person.prompts) {
      assert.notEqual(text, "Стоит ли уходить или остаться?")
    }
  }
  const lin = heroById("lin").prompts.join(" ")
  assert.match(lin, /отношен/)
  assert.match(lin, /работ/)
})

test("each table has its own theme and spread sizes", () => {
  const nerra = heroById("nerra")
  const love = laySpread(nerra, { question: "Что он ко мне чувствует?", roles: sizeOf(nerra, 1).roles }, () => 0)
  assert.equal(love.cards.length, 5)
  assert.deepEqual(love.cards.map((item) => item.role), ["Вы", "Другой человек", "Что между вами", "Что мешает", "Куда идёт"])
  assert.equal(love.topic, "l")
  assert.equal(love.reading.items.length, 5)
  const iris = heroById("iris")
  const one = laySpread(iris, { question: "Стоит ли соглашаться?", roles: sizeOf(iris, 0).roles }, () => 0)
  assert.equal(one.cards.length, 1)
  assert.match(one.reading.note, /^Вы спросили: «Стоит ли соглашаться\?»\. Легла карта «[^»]+»\.\n\nИтог расклада\.(?!.*называет карта).*Что советует карта — /s)
  assert.doesNotMatch(one.reading.note, /называет карта|показывает карта/)
  assert.equal(laySpread(iris, { question: "Стоит ли соглашаться?" }, () => 0).cards.length, 3)
  const sol = heroById("sol")
  assert.equal(laySpread(sol, { question: "Что меня ждёт?" }, () => 0).topic, "w")
  assert.equal(laySpread(sol, { question: "Будут ли деньги?" }, () => 0).topic, "m")
  assert.deepEqual(HALL_ORDER, ["nerra", "iris", "sol", "cael", "lin", "einar"])
})

test("follow-up without the reader's voice reuses the same cards", () => {
  const answer = followupAnswer([{ id: "lovers" }, { id: "magician" }], "а что мне сделать на работе?", 1)
  assert.match(answer, /^Отвечает «Маг» —/)
  assert.doesNotMatch(answer, /те же карты|Влюблённые/)
  assert.ok(answer.includes(byId("mag").hint))
})

test("topic stems match only from the start of a word", () => {
  assert.equal(detectTopic("а что насчёт создания приложения?"), "w")
  assert.equal(detectTopic("любой совет на сегодня"), "s")
  assert.equal(detectTopic("что думает моя жена?"), "l")
  assert.equal(detectTopic("сколько я заработаю?"), "m")
})

test("follow-up without its own topic keeps the spread topic and names the position", () => {
  const answer = followupAnswer([{ id: "cups_ace", role: "Суть" }, { id: "fool", role: "Куда идёт" }], "а дальше что?", 0, "w")
  assert.match(answer, /из позиции «Суть»/)
  assert.ok(!/В любви/.test(answer))
})

test("Virgo reads elements by Golden Dawn dignities", () => {
  const virgo = { sign: "Дева", arcana: 0 }
  assert.match(personalize(byId("cups_ace"), virgo), /родственной/)
  assert.match(personalize(byId("swords_ace"), virgo), /противоположной/)
  assert.match(personalize(byId("mag"), virgo), /управителя Девы/)
  assert.match(personalize(byId("hermit"), virgo), /вашего знака/)
})

test("arkanum keeps the original question topics and day spread", () => {
  assert.equal(detectTopic("что будет с деньгами"), "m")
  assert.equal(detectTopic("как дела на работе"), "w")
  assert.equal(zodiac(30, 3), "Овен")
  assert.equal(zodiac(7, 9), "Дева")
  assert.equal(sunSign("1990-09-07").name, "Дева")
  assert.equal(zodiac(20, 3), "Рыбы")
  assert.equal(zodiac(22, 11), "Стрелец")
  assert.equal(birthArcana(30, 3, 1990), 7)
  assert.equal(arcanaByNumber(7).id, "chariot")
  assert.equal(arcanaByNumber(22).name, "Дурак")
  const profile = profileFrom({ name: "Анна", birthDate: "1990-03-30" })
  assert.match(personalize(byId("emperor"), profile), /Овен/)
  assert.match(personalize(byId("chariot"), profile), /аркан судьбы/)
  const day = layQuestion({}, () => 0)
  assert.deepEqual(day.cards.map((item) => item.role), ["Утро", "День", "Вечер"])
  const money = layQuestion({ question: "Где деньги", topic: "m" }, () => 0)
  assert.equal(money.topic, "m")
  assert.ok(money.reading.items[0].body.includes(money.cards[0].card.meaning.slice(0, 24)))
})

const JOBBY = /В работе —|В работе всё|рабочий шаг|Доведите работу/

test("Ирис на уход не отвечает работой", () => {
  const iris = heroById("iris")
  const q = "Стоит ли уходить или остаться?"
  const said = (reading) => [reading.lead, ...reading.items.map((item) => `${item.open}\n${item.body}`), reading.note].join("\n")
  const one = laySpread(iris, { question: q, roles: sizeOf(iris, 0).roles }, () => 0)
  assert.match(said(one.reading), /карта «Маг»/)
  assert.match(said(one.reading), /Вы спросили: «Стоит ли уходить или остаться\?»/)
  assert.doesNotMatch(said(one.reading), JOBBY)
  const three = laySpread(iris, { question: q, roles: sizeOf(iris, 1).roles }, () => 0)
  assert.match(said(three.reading), /Останьтесь|Уходите|уход|Не ломайте/)
  assert.doesNotMatch(said(three.reading), JOBBY)
})

test("Нерра и Соль держат стол, но тоже называют вопрос", () => {
  const said = (reading) => [reading.lead, ...reading.items.map((item) => `${item.open}\n${item.body}`), reading.note].join("\n")
  const love = laySpread(heroById("nerra"), { question: "Что он ко мне чувствует?" }, () => 0)
  assert.equal(love.topic, "l")
  assert.match(said(love.reading), /человек|чувств|между/)
  assert.match(said(love.reading), /Вы спросили: «Что он ко мне чувствует\?»/)
  const work = laySpread(heroById("sol"), { question: "Стоит ли менять работу?" }, () => 0)
  assert.equal(work.topic, "w")
  assert.match(said(work.reading), /работ/)
  const leaveNerra = laySpread(heroById("nerra"), { question: "Стоит ли уходить или остаться?" }, () => 0)
  assert.equal(leaveNerra.topic, "s")
  assert.match(said(leaveNerra.reading), /Останьтесь|Уходите|уход|Не ломайте/)
  assert.doesNotMatch(said(leaveNerra.reading), JOBBY)
  const leaveSol = laySpread(heroById("sol"), { question: "Стоит ли уходить или остаться?" }, () => 0)
  assert.equal(leaveSol.topic, "s")
  assert.doesNotMatch(said(leaveSol.reading), JOBBY)
})

test("Каэль отвечает двумя картами на вопрос, не одной лекцией декана", () => {
  const cael = laySpread(heroById("cael"), { birthDate: "1986-09-07", question: "Стоит ли уходить или остаться?" }, () => 0.3)
  assert.equal(cael.cards[0].card.id, "hermit")
  const said = [cael.reading.lead, ...cael.reading.items.map((item) => `${item.open}\n${item.body}`), cael.reading.note].join("\n")
  assert.match(said, /Останьтесь|Уходите|уход|Не ломайте/)
  assert.match(cael.reading.items[0].body, /декан/)
  assert.match(cael.reading.items[1].open, new RegExp(cael.cards[1].card.name))
  assert.match(cael.reading.items[2].open, new RegExp(cael.cards[2].card.name))
  assert.doesNotMatch(said, JOBBY)
  assert.doesNotMatch(cael.reading.lead, /Так «/)
})

test("Golden Dawn titles and the birth decan card", () => {
  assert.equal(cardCorrespondence("pentacles_9"), "Владыка Материального Приобретения · Венера в Деве")
  assert.equal(cardCorrespondence("hermit"), "буква Йод · Дева")
  assert.equal(cardCorrespondence("wands_ace"), "Корень сил Огня")
  assert.equal(decanCard("Дева", 1).id, "pentacles_9")
  assert.equal(decanCard("Овен", 0).id, "wands_2")
  assert.equal(decanCard("Рыбы", 2).id, "cups_10")
  const cael = laySpread(heroById("cael"), { birthDate: "1986-09-07", question: "Куда мне идти?" }, () => 0.3)
  assert.equal(cael.cards[0].card.id, "hermit")
  assert.equal(cael.cards[0].role, "Карта знака")
  assert.match(cael.cards[0].note, /Второй декан — Венера в Деве.*«Девятка Пентаклей»/)
})

test("both decks call the majors by the same names", () => {
  for (const card of MAJORS) {
    const twin = byId(card.id === "magician" ? "mag" : card.id)
    assert.equal(card.name, twin.name)
  }
})

test("дата рождения не из будущего, не раньше 1900 и существующая", async () => {
  const { birthIssue } = await import("./arkanum.js")
  const now = new Date(2026, 9, 24, 20, 0)
  assert.equal(birthIssue("1990-09-07", now), "")
  assert.equal(birthIssue("2026-10-24", now), "")
  assert.equal(birthIssue("2026-10-25", now), "future")
  assert.equal(birthIssue("2027-01-01", now), "future")
  assert.equal(birthIssue("1899-12-31", now), "too-old")
  assert.equal(birthIssue("0026-05-05", now), "too-old")
  assert.equal(birthIssue("2023-02-29", now), "no-such-day")
  assert.equal(birthIssue("2024-02-29", now), "")
  assert.equal(birthIssue("", now), "incomplete")
  assert.equal(profileFrom({ name: "Юля", birthDate: "2030-01-01" }, now).dob, null)
})

test("возраст считается по полным годам", async () => {
  const { ageOn } = await import("./arkanum.js")
  const now = new Date(2026, 9, 25, 11, 0)
  assert.equal(ageOn("2010-10-25", now), 16)
  assert.equal(ageOn("2010-10-26", now), 15)
  assert.equal(ageOn("2008-10-25", now), 18)
  assert.equal(ageOn("2008-11-01", now), 17)
  assert.equal(ageOn("2030-01-01", now), null)
})
