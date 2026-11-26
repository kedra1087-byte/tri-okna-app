import test from "node:test"
import assert from "node:assert/strict"
import { HEX_SAMPLE, LIN_WAN } from "./lin-wan.draft.js"

test("черновик Линь Цзин собран как карточка героя", () => {
  assert.equal(LIN_WAN.id, "lin")
  assert.equal(LIN_WAN.school, "Книга перемен")
  assert.equal(LIN_WAN.sizes.length, 2)
  assert.equal(LIN_WAN.locked, false)
  assert.ok(LIN_WAN.sizes.every((size) => size.gives && size.roles.length === size.count))
})

test("десять пробных знаков говорят коротко и без чужих штампов", () => {
  assert.equal(HEX_SAMPLE.length, 10)
  const banned = /вселенн|энерг|мудрост(ь|и) Востока|доверьтесь потоку/i
  for (const sign of HEX_SAMPLE) {
    assert.ok(sign.n >= 1 && sign.n <= 64)
    assert.ok(sign.name && sign.hint && sign.meaning && sign.a)
    assert.doesNotMatch(sign.meaning + sign.a, banned)
  }
})
