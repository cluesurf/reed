// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import { SubglottalFilter } from '@/synth/subglottal'

describe('SubglottalFilter', () => {
  const sampleRate = 24_000

  const measurePeak = (f: SubglottalFilter, freq: number) => {
    let peak = 0
    for (let n = 0; n < sampleRate; n += 1) {
      const x = Math.sin(2 * Math.PI * freq * (n / sampleRate))
      const y = f.process(x)
      if (n > sampleRate / 4 && Math.abs(y) > peak) peak = Math.abs(y)
    }
    return peak
  }

  it('attenuates around the first subglottal antiformant (~600 Hz)', () => {
    const peakNotch = measurePeak(new SubglottalFilter(sampleRate), 600)
    const peakBelow = measurePeak(new SubglottalFilter(sampleRate), 200)
    const peakAbove = measurePeak(new SubglottalFilter(sampleRate), 1000)
    // 600 Hz should be more attenuated than nearby pass bands.
    expect(peakNotch).toBeLessThan(peakBelow)
    expect(peakNotch).toBeLessThan(peakAbove)
  })

  it('attenuates around the second subglottal antiformant (~1500 Hz)', () => {
    const peakNotch = measurePeak(new SubglottalFilter(sampleRate), 1500)
    const peakAbove = measurePeak(new SubglottalFilter(sampleRate), 3000)
    expect(peakNotch).toBeLessThan(peakAbove)
  })

  it('remains stable for 10 000 random samples', () => {
    const f = new SubglottalFilter(sampleRate)
    let bad = 0
    for (let n = 0; n < 10_000; n += 1) {
      const y = f.process(Math.random() * 2 - 1)
      if (!Number.isFinite(y)) bad += 1
    }
    expect(bad).toBe(0)
  })

  it('reset zeros the internal state', () => {
    const f = new SubglottalFilter(sampleRate)
    for (let n = 0; n < 100; n += 1) f.process(0.5)
    f.reset()
    // After reset, a single zero in should produce zero out
    // because all delay-line memory is gone.
    expect(f.process(0)).toBe(0)
  })
})
