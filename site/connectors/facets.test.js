import assert from "node:assert/strict"
import test from "node:test"
import { DECK } from "./arkanum-data.js"
import { FACETS, cardFacets } from "./facets.js"

const JARGON = /(Венера|Марс|Сатурн|Юпитер|Меркурий|Луна в|Солнце в|корень |стихия|режет договор|ломает праздник)/
const LEAK = {
  l: /работ|коллег|начальн|зарплат|офис|ваканс|квартир|ипотек|аренда|недвижим|бизнес|карьер/,
  w: /свидан|замуж|поцел|ревн|бывш|невест|жених/,
  m: /свидан|замуж|поцел|ревн|бывш|коллег|начальн|ваканс|карьер/,
  s: /свидан|замуж|зарплат|квартир|коллег|ипотек|аренда|ваканс/,
}

test("every topic of every card stays inside its sphere", () => {
  assert.equal(Object.keys(FACETS).length, 78)
  for (const card of DECK) {
    for (const topic of ["l", "w", "m", "s"]) {
      const facets = cardFacets(card.id, topic)
      assert.ok(facets.length >= 5, `${card.id} ${topic}`)
      assert.equal(new Set(facets).size, facets.length, `${card.id} ${topic}`)
      for (const facet of facets) {
        assert.ok(facet.length >= 20, `${card.id} ${topic}: ${facet}`)
        assert.ok(!facet.includes(card.meaning), `${card.id} ${topic}`)
        assert.equal(JARGON.test(facet), false, `${card.id}: ${facet}`)
        assert.equal(LEAK[topic].test(facet), false, `${card.id} ${topic}: ${facet}`)
      }
    }
  }
})

test("love five of swords splits the quarrel and stays with the couple", () => {
  const text = cardFacets("swords_5", "l").join(" ")
  assert.match(text, /ссор/)
  assert.match(text, /недомолвк/)
  assert.match(text, /не высказано/)
  assert.match(text, /позиц/)
  assert.match(text, /[Хх]арактер/)
  assert.match(text, /Вы можете быть просто разными\./)
  assert.equal(/дожимать|вырос/.test(text), false)
  assert.equal(/работ|коллег|квартир|аренда/.test(text), false)
})

test("work eight of wands is distance inside the job, love eight is a meeting", () => {
  const love = cardFacets("wands_8", "l").join(" ")
  const work = cardFacets("wands_8", "w").join(" ")
  assert.match(love, /сообщен|разговор/)
  assert.match(love, /поездк/)
  assert.equal(/учёб/.test(love), false)
  assert.match(work, /онлайн-учёб/)
  assert.match(work, /онлайн-встреч/)
  assert.match(work, /поездк/)
})
