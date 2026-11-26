/** Замок героев.
 * Оплата подключается снаружи: payments.purchase(sku) должен вернуть { ok: true }.
 * Пока адаптера нет, закрытый герой остаётся закрытым.
 */

const STORAGE_KEY = "tri-okna-unlocks"

export function createUnlocks({ storage, payments } = {}) {
  const memory = storage ?? new Map()
  const store = {
    get(key) {
      if (typeof memory.getItem === "function") return memory.getItem(key)
      return memory.get(key) ?? null
    },
    set(key, value) {
      if (typeof memory.setItem === "function") memory.setItem(key, value)
      else memory.set(key, value)
    },
  }
  const gate = payments ?? {
    async purchase() {
      const error = new Error("Оплата не подключена")
      error.code = "PAYMENTS_NOT_CONNECTED"
      throw error
    },
  }

  function owned() {
    try {
      const raw = store.get(STORAGE_KEY)
      return new Set(raw ? JSON.parse(raw) : [])
    } catch {
      return new Set()
    }
  }

  function save(set) {
    store.set(STORAGE_KEY, JSON.stringify([...set]))
  }

  return {
    canUse(hero) {
      return !hero.locked || owned().has(hero.id)
    },
    async purchase(hero) {
      const result = await gate.purchase(hero.sku)
      if (!result?.ok) {
        const error = new Error("Оплата не подтвердилась")
        error.code = "PAYMENTS_DECLINED"
        throw error
      }
      const set = owned()
      set.add(hero.id)
      save(set)
      return true
    },
  }
}
