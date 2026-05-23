// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import { Tract } from '@/synth/tract'

describe('Tract', () => {
  it('allocates buffers of the configured length', () => {
    const t = new Tract({ length: 44 })
    expect(t.right).toHaveLength(44)
    expect(t.left).toHaveLength(44)
    expect(t.diameter).toHaveLength(44)
  })

  it('initializes with a non-zero schwa profile', () => {
    const t = new Tract({ length: 44 })
    let sum = 0
    for (let i = 0; i < 44; i += 1) sum += t.diameter[i]!
    expect(sum).toBeGreaterThan(0)
  })

  it('accepts a custom diameter array', () => {
    const t = new Tract({ length: 8 })
    t.setDiameters([1, 1, 1, 1, 1, 1, 1, 1])
    for (let i = 0; i < 8; i += 1) {
      expect(t.diameter[i]).toBe(1)
    }
  })

  it('produces finite output for a steady impulse train input', () => {
    const t = new Tract({ length: 44 })
    for (let n = 0; n < 1024; n += 1) {
      const input = n % 200 === 0 ? 0.5 : 0
      const out = t.step(input)
      expect(Number.isFinite(out)).toBe(true)
    }
  })

  it('responds (non-zero output) to a non-zero input', () => {
    const t = new Tract({ length: 44 })
    let maxAbs = 0
    for (let n = 0; n < 1024; n += 1) {
      const input = Math.sin((n / 48_000) * 2 * Math.PI * 100)
      const out = t.step(input)
      maxAbs = Math.max(maxAbs, Math.abs(out))
    }
    expect(maxAbs).toBeGreaterThan(0)
  })

  it('reset zeroes the state buffers', () => {
    const t = new Tract({ length: 44 })
    for (let n = 0; n < 100; n += 1) t.step(0.5)
    t.reset()
    let sum = 0
    for (let i = 0; i < 44; i += 1) sum += Math.abs(t.right[i]!) + Math.abs(t.left[i]!)
    expect(sum).toBe(0)
  })

  it('frequency-dependent loss attenuates high frequency more than low', () => {
    // Drive a sustained sinusoid into the tract and measure
    // steady-state amplitude at both LF and HF. The per-segment
    // 1-pole LP should damp 6 kHz more than 200 Hz.
    const sampleRate = 24_000
    const run = (freq: number) => {
      const t = new Tract({ length: 44 })
      const totalSamples = sampleRate
      let peak = 0
      for (let n = 0; n < totalSamples; n += 1) {
        const x = Math.sin(2 * Math.PI * freq * (n / sampleRate))
        const y = t.step(x)
        if (n > sampleRate * 0.5 && Math.abs(y) > peak) peak = Math.abs(y)
      }
      return peak
    }
    const peakLow = run(200)
    const peakHigh = run(6000)
    // HF must be more attenuated than LF.
    expect(peakHigh).toBeLessThan(peakLow)
  })

  it('remains stable for 10 000 random samples', () => {
    const t = new Tract({ length: 44 })
    let bad = 0
    for (let n = 0; n < 10_000; n += 1) {
      const x = Math.random() * 2 - 1
      const y = t.step(x)
      if (!Number.isFinite(y)) bad += 1
    }
    expect(bad).toBe(0)
  })
})
