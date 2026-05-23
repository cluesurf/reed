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

  it('passes 500 Hz with modest gain (Klatt single-zero)', () => {
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
    // |H(f)| = √(1 - 2r·cos(ω) + r²) with r=0.95.
    // At 500 Hz: ω ≈ 0.131, |H| ≈ 0.18 — substantial
    // attenuation of low-mid frequencies, by design.
    expect(peak).toBeGreaterThan(0.1)
    expect(peak).toBeLessThan(0.4)
  })

  it('boosts HF more than LF (+6 dB/octave slope)', () => {
    const r = new LipRadiation({ sampleRate: 24_000 })
    const sampleRate = 24_000
    const freq = 3000 // π/4 at 24 kHz; well below Nyquist
    let peak = 0
    for (let n = 0; n < sampleRate; n += 1) {
      const t = n / sampleRate
      const x = Math.sin(2 * Math.PI * freq * t)
      const y = r.process(x)
      if (n > 500 && Math.abs(y) > peak) peak = Math.abs(y)
    }
    // |H(f)|² = 1 - 2r·cos(ω) + r². At 3kHz with r=0.95,
    // cos(π/4)=0.707, so |H|² = 1 - 1.343 + 0.9025 ≈ 0.56,
    // |H| ≈ 0.75. Substantially higher than the 0.18 at
    // 500 Hz.
    expect(peak).toBeGreaterThan(0.5)
    expect(peak).toBeLessThan(1.0)
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
