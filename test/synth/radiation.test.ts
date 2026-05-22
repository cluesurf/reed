// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import { LipRadiation } from '@/synth/radiation'

describe('LipRadiation', () => {
  it('rejects DC over time', () => {
    const r = new LipRadiation({ sampleRate: 24_000 })
    let last = 0
    for (let n = 0; n < 5000; n += 1) {
      last = r.process(0.5)
    }
    // DC leaks away through the HPF.
    expect(Math.abs(last)).toBeLessThan(0.05)
  })

  it('passes mid-band frequencies with reasonable gain', () => {
    const r = new LipRadiation({ sampleRate: 24_000 })
    const sampleRate = 24_000
    const freq = 500
    let peak = 0
    for (let n = 0; n < sampleRate; n += 1) {
      const t = n / sampleRate
      const x = Math.sin(2 * Math.PI * freq * t)
      const y = r.process(x)
      if (n > 500 && Math.abs(y) > peak) peak = Math.abs(y)
    }
    // After HPF (cutoff ~120 Hz) + high-shelf (boost
    // above 1.5 kHz), 500 Hz is in the flat region with
    // near-unity gain.
    expect(peak).toBeGreaterThan(0.7)
    expect(peak).toBeLessThan(1.2)
  })

  it('boosts high frequencies above the shelf corner', () => {
    const r = new LipRadiation({ sampleRate: 24_000 })
    const sampleRate = 24_000
    const freq = 3000 // above the 1.5 kHz boost corner
    let peak = 0
    for (let n = 0; n < sampleRate; n += 1) {
      const t = n / sampleRate
      const x = Math.sin(2 * Math.PI * freq * t)
      const y = r.process(x)
      if (n > 500 && Math.abs(y) > peak) peak = Math.abs(y)
    }
    // +12 dB boost above 1.2 kHz means ~3-4× amplitude
    // at 3 kHz.
    expect(peak).toBeGreaterThan(2.0)
    expect(peak).toBeLessThan(5.0)
  })

  it('attenuates very low frequencies', () => {
    const r = new LipRadiation({ sampleRate: 24_000 })
    const sampleRate = 24_000
    const freq = 30
    let peak = 0
    for (let n = 0; n < sampleRate * 2; n += 1) {
      const t = n / sampleRate
      const x = Math.sin(2 * Math.PI * freq * t)
      const y = r.process(x)
      if (n > 200 && Math.abs(y) > peak) peak = Math.abs(y)
    }
    expect(peak).toBeLessThan(0.5)
  })

  it('reset zeros the internal state', () => {
    const r = new LipRadiation({ sampleRate: 24_000 })
    for (let n = 0; n < 100; n += 1) r.process(0.5)
    r.reset()
    expect(r.process(0)).toBe(0)
  })
})
