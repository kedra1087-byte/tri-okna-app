import test from "node:test"
import assert from "node:assert/strict"
import { LAY_GAIN, LAY_RATE } from "./audio.js"

test("первый звук посадки играет как записан, без замедления", () => {
  assert.equal(LAY_GAIN, 1)
  assert.equal(LAY_RATE, 1)
})
