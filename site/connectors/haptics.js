/** Короткий отклик телефона. Только в ответ на касание. iPhone в браузере молчит, это нормально. */

export const BUZZ = {
  tap: 8,
  toss: [8, 40, 14],
  coin: 7,
  flip: 12,
  landed: 16,
  rest: [10, 60, 10],
}

let enabled = true

export function setHaptics(value) {
  enabled = Boolean(value)
}

export function canBuzz() {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function"
}

function calm() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches
  } catch {
    return false
  }
}

export function buzz(pattern) {
  if (!enabled || !canBuzz()) return
  if (calm()) return
  try {
    navigator.vibrate(pattern)
  } catch {
    /* часть браузеров запрещает вибрацию до первого касания */
  }
}
