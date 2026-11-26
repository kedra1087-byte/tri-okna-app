/** Короткие звуки интерфейса. Музыка таверны не играет, пока её не попросят вернуть.
 * Дорожки в assets/music остаются на месте, startHall их не запускает.
 */

const LOOPS = {
  hall: "assets/music/hall.wav",
  dawn: "assets/music/dawn.wav",
  decan: "assets/music/decan.wav",
  tide: "assets/music/tide.wav",
  ember: "assets/music/ember.wav",
}

const TOSS_SFX = "assets/sfx/coin-toss.mp3"
const LAY_SFX = "assets/sfx/card-lay.mp3?v=144"
// Самая первая запись посадки, около 1,3 с. Играет как есть, со стартом карты.
export const LAY_GAIN = 1
export const LAY_RATE = 1
const FLIP_SFX = "assets/sfx/card-flip.mp3"
const STONE_ONE_SFX = "assets/sfx/stone-one.mp3"
const STONE_THREE_SFX = "assets/sfx/stone-three.mp3"

const noiseCache = new WeakMap()

// Розовый шум звучит как бумага и ткань, белый — как шипение динамика.
function pinkNoise(audio) {
  if (noiseCache.has(audio)) return noiseCache.get(audio)
  const length = audio.sampleRate * 2
  const buffer = audio.createBuffer(1, length, audio.sampleRate)
  const data = buffer.getChannelData(0)
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
  for (let i = 0; i < length; i += 1) {
    const w = Math.random() * 2 - 1
    b0 = 0.99886 * b0 + w * 0.0555179
    b1 = 0.99332 * b1 + w * 0.0750759
    b2 = 0.969 * b2 + w * 0.153852
    b3 = 0.8665 * b3 + w * 0.3104856
    b4 = 0.55 * b4 + w * 0.5329522
    b5 = -0.7616 * b5 - w * 0.016898
    data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11
    b6 = w * 0.115926
  }
  noiseCache.set(audio, buffer)
  return buffer
}

const jitter = (spread) => 1 + (Math.random() * 2 - 1) * spread

function noiseBurst(audio, out, at, { type, freq, q = 0.7, sweepTo, peak, attack, decay }) {
  const source = audio.createBufferSource()
  source.buffer = pinkNoise(audio)
  const filter = audio.createBiquadFilter()
  filter.type = type
  filter.Q.value = q
  filter.frequency.setValueAtTime(freq, at)
  if (sweepTo) filter.frequency.exponentialRampToValueAtTime(sweepTo, at + attack + decay * 0.6)
  const gain = audio.createGain()
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.exponentialRampToValueAtTime(peak, at + attack)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay)
  source.connect(filter)
  filter.connect(gain)
  gain.connect(out)
  source.start(at, Math.random() * 1.5, attack + decay + 0.05)
}

function thud(audio, out, at, { freq, peak, decay }) {
  const osc = audio.createOscillator()
  osc.type = "sine"
  osc.frequency.setValueAtTime(freq * 1.4, at)
  osc.frequency.exponentialRampToValueAtTime(freq, at + 0.03)
  const gain = audio.createGain()
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.exponentialRampToValueAtTime(peak, at + 0.006)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + decay)
  osc.connect(gain)
  gain.connect(out)
  osc.start(at)
  osc.stop(at + decay + 0.02)
}

// Карта долго скользит по сукну и тихо ложится. Касание ближе к концу, без щелчка.
export function layCard(audio, out, at) {
  const k = jitter(0.05)
  noiseBurst(audio, out, at, { type: "bandpass", freq: 1400 * k, sweepTo: 520 * k, q: 0.45, peak: 0.028 * jitter(0.1), attack: 0.12, decay: 0.92 })
  noiseBurst(audio, out, at + 0.18, { type: "lowpass", freq: 900 * k, q: 0.4, peak: 0.02, attack: 0.2, decay: 0.7 })
  const touch = at + 1.12
  noiseBurst(audio, out, touch, { type: "lowpass", freq: 480 * k, q: 0.45, peak: 0.07 * jitter(0.08), attack: 0.012, decay: 0.14 })
  thud(audio, out, touch, { freq: 78 * k, peak: 0.04, decay: 0.18 })
}

// Три бронзовые монеты падают на дерево: короткий металл и тихое дерево.
export function tossCoins(audio, out, at) {
  const k = jitter(0.08)
  for (let i = 0; i < 3; i += 1) {
    const t = at + i * 0.016 * jitter(0.25)
    const ping = audio.createOscillator()
    ping.type = "triangle"
    ping.frequency.setValueAtTime((2100 + i * 380) * k, t)
    ping.frequency.exponentialRampToValueAtTime((780 + i * 90) * k, t + 0.09)
    const tone = audio.createGain()
    tone.gain.setValueAtTime(0.0001, t)
    tone.gain.exponentialRampToValueAtTime(0.055 * jitter(0.2), t + 0.004)
    tone.gain.exponentialRampToValueAtTime(0.0001, t + 0.11)
    ping.connect(tone)
    tone.connect(out)
    ping.start(t)
    ping.stop(t + 0.13)
    noiseBurst(audio, out, t, { type: "bandpass", freq: 4800 * k, sweepTo: 1800 * k, q: 2.2, peak: 0.045 * jitter(0.2), attack: 0.002, decay: 0.05 })
  }
  thud(audio, out, at + 0.03, { freq: 170 * k, peak: 0.035, decay: 0.07 })
}

// Переворот: короткий бумажный взмах вверх по частоте и лёгкий хлопок картона о стол.
export function flipCard(audio, out, at) {
  const k = jitter(0.08)
  noiseBurst(audio, out, at, { type: "bandpass", freq: 700 * k, sweepTo: 3200 * k, q: 1.1, peak: 0.07, attack: 0.05, decay: 0.07 })
  const tap = at + 0.11 * jitter(0.08)
  noiseBurst(audio, out, tap, { type: "bandpass", freq: 1500 * k, q: 0.8, peak: 0.05, attack: 0.003, decay: 0.045 })
  noiseBurst(audio, out, tap, { type: "lowpass", freq: 500 * k, q: 0.5, peak: 0.08, attack: 0.004, decay: 0.06 })
  thud(audio, out, tap, { freq: 120 * k, peak: 0.04, decay: 0.07 })
}

export function createAudioBus() {
  let context = null
  let master = null
  let muted = false
  let current = null
  let request = 0
  const slots = { music: null, theme: "hall" }
  const cache = new Map()
  const inflight = new Map()
  const missing = new Set()

  function ctx() {
    if (!context) context = new AudioContext()
    if (!master) {
      master = context.createGain()
      master.gain.value = 0.95
      master.connect(context.destination)
    }
    return context
  }

  async function ensureRunning() {
    const audio = ctx()
    if (audio.state === "suspended") {
      await Promise.race([
        audio.resume(),
        new Promise((resolve) => setTimeout(resolve, 500)),
      ])
    }
    return audio.state === "running"
  }

  async function playClip(url, delay, fallback, gain = 1) {
    if (muted) return
    const started = performance.now()
    if (!(await ensureRunning()) || muted) return
    let data = null
    if (!missing.has(url)) {
      try {
        data = await bufferFor(url)
      } catch {
        missing.add(url)
      }
    }
    if (muted) return
    const wait = Math.max(0, delay - (performance.now() - started))
    const at = ctx().currentTime + wait / 1000
    if (!data) {
      fallback(ctx(), master, at)
      return
    }
    const source = ctx().createBufferSource()
    source.buffer = data
    if (gain === 1) source.connect(master)
    else {
      const amp = ctx().createGain()
      amp.gain.value = gain
      source.connect(amp)
      amp.connect(master)
    }
    source.start(at)
  }

  async function bufferFor(url) {
    if (cache.has(url)) return cache.get(url)
    if (inflight.has(url)) return inflight.get(url)
    if (missing.has(url)) throw new Error("missing")
    const job = (async () => {
      const audio = ctx()
      const response = await fetch(url)
      if (!response.ok) {
        missing.add(url)
        throw new Error("missing")
      }
      const data = await audio.decodeAudioData(await response.arrayBuffer())
      cache.set(url, data)
      return data
    })()
    inflight.set(url, job)
    try {
      return await job
    } finally {
      inflight.delete(url)
    }
  }

  function trackUrl() {
    return slots.music || LOOPS[slots.theme] || LOOPS.hall
  }

  async function playUrl(url) {
    const token = ++request
    if (!(await ensureRunning())) return
    if (token !== request || muted) return
    const audio = ctx()
    const data = await bufferFor(url)
    if (token !== request || muted) return
    const source = audio.createBufferSource()
    source.buffer = data
    source.loop = true
    const gain = audio.createGain()
    const now = audio.currentTime
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.9, now + 1.2)
    source.connect(gain)
    gain.connect(master)
    source.start()
    if (current) {
      const old = current
      old.gain.gain.cancelScheduledValues(now)
      old.gain.gain.setValueAtTime(Math.max(0.0001, old.gain.gain.value), now)
      old.gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.1)
      setTimeout(() => {
        try { old.source.stop() } catch { /* already stopped */ }
      }, 1200)
    }
    current = { source, gain, url }
  }

  return {
    slots,
    get muted() {
      return muted
    },
    load(manifest = {}) {
      slots.music = manifest.music ?? null
      slots.theme = manifest.theme ?? "hall"
    },
    async startHall() {
      return
    },
    stopRoom() {},
    async playCard() {
      return this.playLay()
    },
    async playLay(delay = 0) {
      return playClip(LAY_SFX, delay, layCard, LAY_GAIN)
    },
    async warmLay() {
      try {
        if (!(await ensureRunning())) return
        await bufferFor(LAY_SFX)
      } catch {
        /* синтетика, если файла нет */
      }
    },
    // Один камень и три камня — разные записи. На три камня файл играет один раз.
    async playStone(delay = 0, count = 1) {
      return playClip(count === 1 ? STONE_ONE_SFX : STONE_THREE_SFX, delay, layCard)
    },
    async warmStone(count = 1) {
      try {
        if (!(await ensureRunning())) return
        await bufferFor(count === 1 ? STONE_ONE_SFX : STONE_THREE_SFX)
      } catch {
        /* синтетика, если файла нет */
      }
    },
    async playStoneFlip() {
      return playClip(STONE_ONE_SFX, 0, layCard)
    },
    async warmStoneFlip() {
      try {
        if (!(await ensureRunning())) return
        await bufferFor(STONE_ONE_SFX)
      } catch {
        /* синтетика, если файла нет */
      }
    },
    async playFlip() {
      return playClip(FLIP_SFX, 0, flipCard, 0.35)
    },
    async warmFlip() {
      try {
        if (!(await ensureRunning())) return
        await bufferFor(FLIP_SFX)
      } catch {
        /* синтетика, если файла нет */
      }
    },
    async warmToss() {
      try {
        if (!(await ensureRunning())) return
        await bufferFor(TOSS_SFX)
      } catch {
        /* синтетика, если файла нет */
      }
    },
    async playToss(delay = 0) {
      if (muted) return
      if (!(await ensureRunning()) || muted) return
      const at = ctx().currentTime + delay / 1000
      try {
        const data = await bufferFor(TOSS_SFX)
        if (muted) return
        const source = ctx().createBufferSource()
        source.buffer = data
        source.connect(master)
        source.start(at)
      } catch {
        tossCoins(ctx(), master, at)
      }
    },
    setMuted(value) {
      muted = Boolean(value)
    },
  }
}
