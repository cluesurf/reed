// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import { Glottis } from '@/synth/glottis'

describe('Glottis', () => {
  it('produces finite samples for a stable input', () => {
    const g = new Glottis()
    const sampleRate = 24_000
    for (let n = 0; n < 1024; n += 1) {
      const t = n / sampleRate
      const s = g.process({
        seconds: t,
        frequency: 120,
        intensity: 1,
        loudness: 1,
        tenseness: 0.6,
        noise: 0,
      })
      expect(Number.isFinite(s), `non-finite at sample ${n}`).toBe(true)
    }
  })

  it('produces a periodic output at the given f0', () => {
    const g = new Glottis()
    const sampleRate = 24_000
    const f0 = 100
    const period = sampleRate / f0 // 240 samples
    const samples = new Float32Array(sampleRate)
    for (let n = 0; n < sampleRate; n += 1) {
      samples[n] = g.process({
        seconds: n / sampleRate,
        frequency: f0,
        intensity: 1,
        loudness: 1,
        tenseness: 0.6,
        noise: 0,
      })
    }
    // After settling, the autocorrelation should peak at
    // the period. Compute autocorrelation at lag = period
    // and compare to lag = period/2 (which should be
    // smaller in magnitude).
    const offset = Math.floor(sampleRate / 4) // skip first 250ms transient
    let corrPeriod = 0
    let corrHalf = 0
    for (let n = 0; n < period * 4; n += 1) {
      corrPeriod += samples[offset + n]! * samples[offset + n + Math.round(period)]!
      corrHalf += samples[offset + n]! * samples[offset + n + Math.round(period / 2)]!
    }
    expect(Math.abs(corrPeriod)).toBeGreaterThan(Math.abs(corrHalf))
  })

  it('amplitude scales roughly with intensity', () => {
    const g1 = new Glottis()
    const g2 = new Glottis()
    const sampleRate = 24_000
    let energyA = 0
    let energyB = 0
    for (let n = 0; n < sampleRate; n += 1) {
      const t = n / sampleRate
      const a = g1.process({
        seconds: t,
        frequency: 120,
        intensity: 0.5,
        loudness: 1,
        tenseness: 0.6,
        noise: 0,
      })
      const b = g2.process({
        seconds: t,
        frequency: 120,
        intensity: 1.0,
        loudness: 1,
        tenseness: 0.6,
        noise: 0,
      })
      energyA += a * a
      energyB += b * b
    }
    expect(energyB).toBeGreaterThan(energyA)
  })
})
