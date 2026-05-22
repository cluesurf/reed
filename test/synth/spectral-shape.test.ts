// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import {
  Biquad,
  SpectralShape,
  buildHighShelfCutCoeffs,
  buildPeakingNotchCoeffs,
} from '@/synth/spectral-shape'

describe('Biquad', () => {
  it('passes DC through an identity coefficient set', () => {
    // Identity: b0=1, b1=b2=a1=a2=0.
    const b = new Biquad({ b0: 1, b1: 0, b2: 0, a1: 0, a2: 0 })
    expect(b.process(0.5)).toBeCloseTo(0.5)
    expect(b.process(0.5)).toBeCloseTo(0.5)
    expect(b.process(-1)).toBeCloseTo(-1)
  })

  it('is stable and finite for a typical filter', () => {
    const coeffs = buildHighShelfCutCoeffs({
      sampleRate: 24_000,
      cornerHz: 6000,
      gainDb: -6,
    })
    const b = new Biquad(coeffs)
    let lastMagnitude = 0
    for (let n = 0; n < 5000; n += 1) {
      const x = Math.sin((2 * Math.PI * 1000 * n) / 24_000)
      const y = b.process(x)
      expect(Number.isFinite(y)).toBe(true)
      lastMagnitude = Math.abs(y)
    }
    expect(lastMagnitude).toBeLessThan(10) // no runaway gain
  })

  it('reset zeros the state', () => {
    const b = new Biquad({ b0: 1, b1: 0.5, b2: 0.5, a1: 0, a2: 0 })
    for (let n = 0; n < 100; n += 1) b.process(0.5)
    b.reset()
    // After reset, processing 0 should produce 0 (no
    // history affecting the output).
    expect(b.process(0)).toBe(0)
  })
})

describe('high-shelf cut coefficients', () => {
  it('attenuates frequencies above the corner', () => {
    const coeffs = buildHighShelfCutCoeffs({
      sampleRate: 24_000,
      cornerHz: 6000,
      gainDb: -6,
    })
    const b = new Biquad(coeffs)
    // Settle, then measure peak at 9 kHz (well above corner).
    const settleSamples = 200
    let peak = 0
    for (let n = 0; n < 12_000; n += 1) {
      const t = n / 24_000
      const y = b.process(Math.sin(2 * Math.PI * 9000 * t))
      if (n > settleSamples) peak = Math.max(peak, Math.abs(y))
    }
    // -6dB shelf above 6kHz, measured at 9kHz → roughly
    // -3 to -6 dB attenuation. So peak should be < 0.85.
    expect(peak).toBeLessThan(0.85)
  })

  it('passes frequencies well below the corner unchanged', () => {
    const coeffs = buildHighShelfCutCoeffs({
      sampleRate: 24_000,
      cornerHz: 6000,
      gainDb: -6,
    })
    const b = new Biquad(coeffs)
    let peak = 0
    for (let n = 0; n < 24_000; n += 1) {
      const t = n / 24_000
      const y = b.process(Math.sin(2 * Math.PI * 500 * t))
      if (n > 200) peak = Math.max(peak, Math.abs(y))
    }
    // At 500 Hz (well below 6 kHz corner), gain ≈ 0 dB.
    expect(peak).toBeGreaterThan(0.9)
    expect(peak).toBeLessThan(1.1)
  })
})

describe('peaking notch coefficients', () => {
  it('attenuates near the center frequency', () => {
    const coeffs = buildPeakingNotchCoeffs({
      sampleRate: 24_000,
      freqHz: 600,
      depthDb: -10,
      q: 2.0,
    })
    const b = new Biquad(coeffs)
    let peak = 0
    for (let n = 0; n < 24_000; n += 1) {
      const t = n / 24_000
      const y = b.process(Math.sin(2 * Math.PI * 600 * t))
      if (n > 500) peak = Math.max(peak, Math.abs(y))
    }
    // -10 dB notch → output at 600 Hz should be ~0.316 of
    // input (assuming Q is moderate so the notch hits hard
    // at the center). Allow some tolerance.
    expect(peak).toBeLessThan(0.5)
  })

  it('passes frequencies far from the center unchanged', () => {
    const coeffs = buildPeakingNotchCoeffs({
      sampleRate: 24_000,
      freqHz: 600,
      depthDb: -10,
      q: 2.0,
    })
    const b = new Biquad(coeffs)
    let peak = 0
    for (let n = 0; n < 24_000; n += 1) {
      const t = n / 24_000
      const y = b.process(Math.sin(2 * Math.PI * 3000 * t))
      if (n > 200) peak = Math.max(peak, Math.abs(y))
    }
    // At 3 kHz (5x notch frequency), gain should be near 0 dB.
    expect(peak).toBeGreaterThan(0.85)
    expect(peak).toBeLessThan(1.15)
  })
})

describe('SpectralShape (composite)', () => {
  it('stays stable on a long noise input', () => {
    const s = new SpectralShape(24_000)
    let peak = 0
    for (let n = 0; n < 24_000; n += 1) {
      const y = s.process(Math.random() * 2 - 1)
      expect(Number.isFinite(y)).toBe(true)
      peak = Math.max(peak, Math.abs(y))
    }
    expect(peak).toBeLessThan(5)
  })
})
