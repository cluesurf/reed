// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import { synthesizeVowel } from '@/synth'

describe('synthesizeVowel', () => {
  it('produces the requested number of samples', () => {
    const samples = synthesizeVowel({
      vowel: 'a',
      duration: 0.1,
      sampleRate: 24_000,
    })
    expect(samples).toHaveLength(2400)
  })

  it('outputs samples in [-1, 1]', () => {
    const samples = synthesizeVowel({
      vowel: 'a',
      duration: 0.2,
      sampleRate: 24_000,
    })
    let max = 0
    let min = 0
    for (const s of samples) {
      if (s > max) max = s
      if (s < min) min = s
    }
    expect(max).toBeLessThanOrEqual(1)
    expect(min).toBeGreaterThanOrEqual(-1)
  })

  it('produces non-silent output', () => {
    const samples = synthesizeVowel({
      vowel: 'a',
      duration: 0.2,
      sampleRate: 24_000,
    })
    let rms = 0
    for (const s of samples) rms += s * s
    rms = Math.sqrt(rms / samples.length)
    expect(rms).toBeGreaterThan(0.01)
  })

  it('produces different outputs for different vowels', () => {
    const a = synthesizeVowel({
      vowel: 'a',
      duration: 0.2,
      sampleRate: 24_000,
    })
    const i = synthesizeVowel({
      vowel: 'i',
      duration: 0.2,
      sampleRate: 24_000,
    })
    // After both have settled, they should not be
    // identical sample-for-sample.
    let diffCount = 0
    const offset = 2400 // skip 100ms transient
    for (let n = offset; n < a.length; n += 1) {
      if (Math.abs(a[n]! - i[n]!) > 1e-6) diffCount += 1
    }
    expect(diffCount).toBeGreaterThan(a.length * 0.5 - offset)
  })

  it('all output samples are finite', () => {
    const samples = synthesizeVowel({
      vowel: 'a',
      duration: 0.1,
      sampleRate: 24_000,
    })
    for (let n = 0; n < samples.length; n += 1) {
      expect(Number.isFinite(samples[n]!), `non-finite at ${n}`).toBe(true)
    }
  })

  it('ramps in and out (low energy at edges)', () => {
    const samples = synthesizeVowel({
      vowel: 'a',
      duration: 0.5,
      sampleRate: 24_000,
    })
    // First sample is muted by the attack ramp. Final
    // sample has small residual tract ringing after the
    // release ramp brings the source intensity to 0; we
    // only require both to be substantially smaller than
    // the mid-clip amplitude.
    let midRms = 0
    const midStart = Math.floor(samples.length * 0.3)
    const midEnd = Math.floor(samples.length * 0.7)
    for (let n = midStart; n < midEnd; n += 1) {
      midRms += samples[n]! * samples[n]!
    }
    midRms = Math.sqrt(midRms / (midEnd - midStart))
    expect(Math.abs(samples[0]!)).toBeLessThan(midRms * 0.5)
    expect(Math.abs(samples[samples.length - 1]!)).toBeLessThan(midRms * 0.5)
  })
})
