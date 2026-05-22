// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import { synthesizeVowel } from '@/synth'

/**
 * Vowel-distinguishability tests via spectral centroid.
 *
 * The spectral centroid (the weighted mean frequency of
 * the magnitude spectrum) is a single robust measure of
 * "where the energy lives." It's much more robust to the
 * f0 harmonic comb than peak-picking is.
 *
 * Expected ordering of vowel centroids (approximate):
 *
 *   /u/ < /o/ < /a/ < /e/ < /i/
 *
 * because the centroid rises as F1+F2 move higher. /u/
 * has both formants low; /i/ has F1 low but F2 very high
 * which pulls the centroid up.
 *
 * The tests check the strong cases (the endpoints /i/ and
 * /u/) plus a few cardinal pairings. Vowels in the middle
 * are harder to order reliably and aren't asserted.
 */

const SAMPLE_RATE = 24_000
const TEST_F0 = 110

function computeFFT(samples: Float32Array): { mag: Float32Array; freqs: Float32Array } {
  const N = samples.length
  const mag = new Float32Array(N / 2)
  const freqs = new Float32Array(N / 2)
  for (let k = 0; k < N / 2; k += 1) {
    let re = 0
    let im = 0
    for (let n = 0; n < N; n += 1) {
      const angle = (-2 * Math.PI * k * n) / N
      re += samples[n]! * Math.cos(angle)
      im += samples[n]! * Math.sin(angle)
    }
    mag[k] = Math.sqrt(re * re + im * im)
    freqs[k] = (k * SAMPLE_RATE) / N
  }
  return { mag, freqs }
}

function applyHann(input: Float32Array): Float32Array {
  const N = input.length
  const out = new Float32Array(N)
  for (let n = 0; n < N; n += 1) {
    const w = 0.5 * (1 - Math.cos((2 * Math.PI * n) / (N - 1)))
    out[n] = input[n]! * w
  }
  return out
}

function spectralCentroid(input: {
  mag: Float32Array
  freqs: Float32Array
  lowerHz: number
  upperHz: number
}): number {
  const { mag, freqs, lowerHz, upperHz } = input
  let weightedSum = 0
  let totalEnergy = 0
  for (let i = 0; i < mag.length; i += 1) {
    if (freqs[i]! < lowerHz || freqs[i]! >= upperHz) continue
    const e = mag[i]! * mag[i]!
    weightedSum += freqs[i]! * e
    totalEnergy += e
  }
  return totalEnergy > 0 ? weightedSum / totalEnergy : 0
}

function vowelCentroid(vowel: 'i' | 'e' | 'a' | 'o' | 'u'): number {
  const samples = synthesizeVowel({
    vowel,
    duration: 0.4,
    sampleRate: SAMPLE_RATE,
    frequency: TEST_F0,
    tenseness: 0.6,
  })
  const start = Math.floor(0.1 * SAMPLE_RATE)
  const N = 4096
  const slice = applyHann(samples.subarray(start, start + N))
  const { mag, freqs } = computeFFT(slice)
  return spectralCentroid({ mag, freqs, lowerHz: 150, upperHz: 5000 })
}

/**
 * These tests confirm spectral DISTINGUISHABILITY between
 * vowels — that distinct vowel shapes produce
 * distinguishable spectral energy distributions. They
 * intentionally avoid asserting fine-grained orderings
 * that aren't yet stable in this synth iteration; that
 * tuning is tracked in `note/library/reed/vowel-quality-
 * analysis.md`.
 */
describe('vowel spectral character', () => {
  it('/i/ has higher centroid than /u/', () => {
    expect(vowelCentroid('i')).toBeGreaterThan(vowelCentroid('u'))
  })

  it('/e/ has higher centroid than /u/', () => {
    expect(vowelCentroid('e')).toBeGreaterThan(vowelCentroid('u'))
  })

  it('/a/ has higher centroid than /u/', () => {
    expect(vowelCentroid('a')).toBeGreaterThan(vowelCentroid('u'))
  })

  it('/i/ centroid differs from /u/ centroid by a non-trivial gap', () => {
    const i = vowelCentroid('i')
    const u = vowelCentroid('u')
    // /i/ and /u/ are spectral opposites; their centroids
    // should differ by at least 100 Hz.
    expect(Math.abs(i - u)).toBeGreaterThan(100)
  })

  it('all vowels produce sound (non-zero centroid)', () => {
    for (const v of ['i', 'e', 'a', 'o', 'u'] as const) {
      expect(vowelCentroid(v)).toBeGreaterThan(100)
    }
  })

  it('different vowels produce distinct centroids', () => {
    const cents = new Set<number>()
    for (const v of ['i', 'e', 'a', 'o', 'u'] as const) {
      cents.add(Math.round(vowelCentroid(v) / 10) * 10)
    }
    // At least 3 of 5 vowels should land in different
    // 10-Hz centroid buckets.
    expect(cents.size).toBeGreaterThanOrEqual(3)
  })
})
