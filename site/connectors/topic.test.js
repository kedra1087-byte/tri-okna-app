import test from "node:test"
import assert from "node:assert/strict"
import { applyCard, askKind, bindStep, cardsLeaveCall, detectTopic, hexStance, questionTopic, runeStance } from "./topic.js"
import { DECK, Q } from "./arkanum-data.js"
import { byId } from "./arkanum.js"
import { hexByNumber } from "./hexagrams.js"
import { runeById } from "./runes.js"

test("уход не читается как работа", () => {
  assert.equal(detectTopic("Стоит ли уходить или остаться?"), "s")
  assert.equal(detectTopic("Уходить из этих отношений или остаться в них?"), "l")
  assert.equal(detectTopic("Уходить с этой работы или остаться на месте?"), "w")
  assert.equal(askKind("Стоит ли уходить или остаться?").leave, true)
  assert.equal(askKind("Стоит ли менять работу?").topic, "w")
  assert.equal(askKind("Стоит ли менять работу?").leave, false)
  assert.equal(questionTopic("Стоит ли уходить или остаться?", "w"), "s")
  assert.equal(questionTopic("Что меня ждёт?", "w"), "w")
  assert.equal(questionTopic("Стоит ли менять работу?", "s"), "w")
  assert.equal(questionTopic("Что меня ждёт?", null), null)
  assert.equal(detectTopic("Он мне напишет?"), "l")
  assert.equal(detectTopic("Он вернётся?"), "l")
})

test("шаг знака про работу только на рабочий вопрос", () => {
  const raw = "Повторите вчерашний рабочий шаг, не придумывая новый."
  assert.equal(bindStep(raw, { topic: "s" }), "Повторите вчерашний шаг, не придумывая новый.")
  assert.equal(bindStep(raw, { topic: "w" }), raw)
})

test("лицо знака Гора — остаться", () => {
  assert.equal(hexStance(hexByNumber(52)), "stay")
  assert.equal(hexStance(hexByNumber(1)), "go")
  assert.equal(hexStance(hexByNumber(40)), "go")
})

test("лицо руны Эйваз — опора, Райдо — сдвиг", () => {
  assert.equal(runeStance(runeById("eihwaz")), "stay")
  assert.equal(runeStance(runeById("raidho")), "go")
  assert.equal(runeStance(runeById("isa")), "wait")
})

test("карта на уход не берёт рабочую подсказку и не командует из каждой карточки", () => {
  const mag = byId("mag")
  const leave = applyCard(mag, "Стоит ли уходить или остаться?", "s")
  assert.doesNotMatch(leave.act, /В работе/)
  const stay = applyCard(byId("hermit"), "Стоит ли уходить или остаться?", "s")
  assert.doesNotMatch(stay.act, /Останьтесь\.|Уходите\.|Легла карта/)
  assert.equal(cardsLeaveCall([{ role: "Ответ", card: byId("hermit") }]), "На вопрос, уходить или остаться, карта отвечает: лучше остаться.")
  assert.match(cardsLeaveCall([{ role: "Ответ", card: byId("fool") }]), /пора уходить/)
  assert.match(cardsLeaveCall([{ role: "Суть вопроса", card: byId("moon") }, { role: "Что делать", card: byId("sun") }]), /не решайте сгоряча/)
  const job = applyCard(mag, "Стоит ли менять работу?", "w")
  assert.match(job.act, /работе/)
  const wait = applyCard(mag, "Что меня ждёт?", "w")
  assert.match(wait.act, /ждёт|впереди|перемен/i)
  const work = applyCard(mag, "Что с работой?", "w")
  assert.match(work.act, /работ/)
})

test("любовь отвечает про чувства, целыми предложениями", () => {
  const love = applyCard(byId("mag"), "Он меня любит?", "l")
  assert.equal(love.act, Q.mag.l)
  const money = applyCard(byId("cups_ace"), "Будут ли деньги в этом месяце?", "m")
  assert.match(money.act, /сумм|деньг|доход/i)
})

test("у позиций про людей свой текст, без приставок и без угаданного пола", () => {
  const ask = "Что он ко мне чувствует?"
  for (const card of DECK) {
    const you = applyCard(card, ask, "l", "Вы").act
    const other = applyCard(card, ask, "l", "Другой человек").act
    const between = applyCard(card, ask, "l", "Что между вами").act
    assert.equal(you, Q[card.id].y)
    assert.equal(other, Q[card.id].o)
    assert.equal(between, Q[card.id].b)
    assert.match(other, /человек|с той стороны|там /i, card.id)
    assert.match(between, /между вами/i, card.id)
    for (const text of [you, other, between, Q[card.id].l]) {
      assert.doesNotMatch(text, /Этот человек сейчас:|Между вами сейчас:|(?<![а-яё])(?:муж|жена|мужчина|женщина|парень|девушка)(?![а-яё])/i, card.id)
      assert.doesNotMatch(text, /(?<![а-яё])(?:вы|вам|вас) (?:сам|сама|один|одна|одному|одной)(?![а-яё])/i, card.id)
    }
    assert.doesNotMatch(other, /(?<![а-яё])(?:он|она|ему|ей|у него|у неё|с ним|с ней)(?![а-яё])/i, card.id)
  }
})
