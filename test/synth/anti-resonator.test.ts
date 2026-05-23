// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import { AntiResonator } from '@/synth/anti-resonator'

describe('AntiResonator', () => {
  it('preserves DC gain (normalization)', () => {
    const r = new AntiResonator(24_000)
    r.setFrequencyBandwidth(4500, 800)
    // Drive constant 1.0; after a few samples the IIR-less
    // FIR settles. Expect output ≈ 1.0 (unity DC gain).
    let last = 0
    for (let n = 0; n < 100; n += 1) last = r.process(1)
    expect(last).toBeCloseTo(1, 2)
  })

  it('notches energy at the configured center frequency', () => {
    const sampleRate = 24_000
    const fc = 4500
    const measureAt = (freq: number) => {
      const r = new AntiResonator(sampleRate)
      r.setFrequencyBandwidth(fc, 800)
      let peak = 0
      for (let n = 0; n < sampleRate; n += 1) {
        const x = Math.sin(2 * Math.PI * freq * (n / sampleRate))
        const y = r.process(x)
        if (n > sampleRate / 4 && Math.abs(y) > peak) peak = Math.abs(y)
      }
      return peak
    }
    const atNotch = measureAt(fc)
    const belowNotch = measureAt(1500) // safely below
    const aboveNotch = measureAt(8000) // safely above
    expect(atNotch).toBeLessThan(belowNotch)
    expect(atNotch).toBeLessThan(aboveNotch)
  })

  it('reset zeros the internal state', () => {
    const r = new AntiResonator(24_000)
    r.setFrequencyBandwidth(4500, 800)
    for (let n = 0; n < 100; n += 1) r.process(0.5)
    r.reset()
    expect(r.process(0)).toBe(0)
  })
})
