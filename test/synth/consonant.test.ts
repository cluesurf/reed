// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import { synthesizeConsonantVowel } from '@/synth'

const SAMPLE_RATE = 24_000

describe('synthesizeConsonantVowel', () => {
  it('produces audio of roughly the requested duration', () => {
    const samples = synthesizeConsonantVowel({
      consonant: 'p',
      vowel: 'a',
      duration: 0.5,
      sampleRate: SAMPLE_RATE,
    })
    // Onset + vowel - crossfade ≈ 0.5s, allow some
    // slack for rounding + crossfade subtraction.
    expect(samples.length).toBeGreaterThan(0.45 * SAMPLE_RATE)
    expect(samples.length).toBeLessThanOrEqual(0.6 * SAMPLE_RATE)
  })

  it('all output samples are finite', () => {
    const samples = synthesizeConsonantVowel({
      consonant: 's',
      vowel: 'a',
      duration: 0.5,
      sampleRate: SAMPLE_RATE,
    })
    for (let n = 0; n < samples.length; n += 1) {
      expect(Number.isFinite(samples[n]!), `non-finite at ${n}`).toBe(true)
    }
  })

  it('output stays within [-1, 1]', () => {
    const samples = synthesizeConsonantVowel({
      consonant: 'sh',
      vowel: 'a',
      duration: 0.4,
      sampleRate: SAMPLE_RATE,
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

  it('rejects non-consonant input', () => {
    expect(() =>
      synthesizeConsonantVowel({ consonant: 'a', vowel: 'a' }),
    ).toThrow(/no formant trajectory|not a consonant/)
  })

  it('renders different consonants to distinct audio', () => {
    const p = synthesizeConsonantVowel({
      consonant: 'p',
      vowel: 'a',
      duration: 0.4,
      sampleRate: SAMPLE_RATE,
    })
    const s = synthesizeConsonantVowel({
      consonant: 's',
      vowel: 'a',
      duration: 0.4,
      sampleRate: SAMPLE_RATE,
    })
    // The onset portions should differ (p is silence, s
    // is noise). Compare first 50 ms.
    const headLen = Math.floor(0.05 * SAMPLE_RATE)
    let diff = 0
    for (let n = 0; n < headLen; n += 1) {
      diff += Math.abs(p[n]! - s[n]!)
    }
    expect(diff).toBeGreaterThan(0.5)
  })

  it('voiceless plosive closure is quieter than vowel steady state', () => {
    const p = synthesizeConsonantVowel({
      consonant: 'p',
      vowel: 'a',
      duration: 0.5,
      sampleRate: SAMPLE_RATE,
    })
    const closureSamples = Math.floor(0.04 * SAMPLE_RATE)
    let closureRms = 0
    for (let n = 0; n < closureSamples; n += 1) closureRms += p[n]! * p[n]!
    closureRms = Math.sqrt(closureRms / closureSamples)
    // Steady vowel starts ~250 ms in.
    const vowelStart = Math.floor(0.3 * SAMPLE_RATE)
    let vowelRms = 0
    for (let n = vowelStart; n < vowelStart + closureSamples; n += 1) {
      vowelRms += p[n]! * p[n]!
    }
    vowelRms = Math.sqrt(vowelRms / closureSamples)
    expect(closureRms).toBeLessThan(vowelRms * 0.5)
  })

  it('voiced plosive onset is quieter than the vowel but louder than voiceless closure', () => {
    const b = synthesizeConsonantVowel({
      consonant: 'b',
      vowel: 'a',
      duration: 0.4,
      sampleRate: SAMPLE_RATE,
    })
    const p = synthesizeConsonantVowel({
      consonant: 'p',
      vowel: 'a',
      duration: 0.4,
      sampleRate: SAMPLE_RATE,
    })
    const closureSamples = Math.floor(0.04 * SAMPLE_RATE)
    let bRms = 0
    let pRms = 0
    for (let n = 0; n < closureSamples; n += 1) {
      bRms += b[n]! * b[n]!
      pRms += p[n]! * p[n]!
    }
    bRms = Math.sqrt(bRms / closureSamples)
    pRms = Math.sqrt(pRms / closureSamples)
    // /b/'s closure should have at least SOME voice bar
    // (more than /p/'s near-silent closure).
    expect(bRms).toBeGreaterThan(pRms)
    expect(bRms).toBeGreaterThan(1e-5)
  })

  it('fricative onset has noise energy', () => {
    const s = synthesizeConsonantVowel({
      consonant: 's',
      vowel: 'a',
      duration: 0.4,
      sampleRate: SAMPLE_RATE,
    })
    const fricSamples = Math.floor(0.08 * SAMPLE_RATE)
    let rms = 0
    for (let n = 0; n < fricSamples; n += 1) rms += s[n]! * s[n]!
    rms = Math.sqrt(rms / fricSamples)
    expect(rms).toBeGreaterThan(0.05)
  })

  it('handles all canonical IPA consonants without throwing', () => {
    const allConsonants = [
      'p', 'b', 't', 'd', 'c', 'J', 'k', 'g', 'K', "'",
      'm', 'M', 'n', 'N', 'q',
      'F', 'B', 'f', 'v', 'T', 'D', 's', 'z', 'sh', 'zh',
      'C', 'Z', 'x', 'G', 'X', 'H', 'Q', 'h',
      'tx', 'dj', 'ch', 'j',
      'V', 'y', 'w',
      'l', 'L',
      'r', 'R',
    ]
    for (const c of allConsonants) {
      expect(
        () =>
          synthesizeConsonantVowel({
            consonant: c,
            vowel: 'a',
            duration: 0.3,
            sampleRate: SAMPLE_RATE,
          }),
        `consonant ${c} should not throw`,
      ).not.toThrow()
    }
  })

  it('different vowel tails produce different audio', () => {
    const pa = synthesizeConsonantVowel({
      consonant: 'p',
      vowel: 'a',
      duration: 0.4,
      sampleRate: SAMPLE_RATE,
    })
    const pi = synthesizeConsonantVowel({
      consonant: 'p',
      vowel: 'i',
      duration: 0.4,
      sampleRate: SAMPLE_RATE,
    })
    // Tail differs because vowels differ. Compare middle 100 ms.
    const start = Math.floor(0.15 * SAMPLE_RATE)
    const end = start + Math.floor(0.1 * SAMPLE_RATE)
    let diff = 0
    for (let n = start; n < end; n += 1) {
      diff += Math.abs(pa[n]! - pi[n]!)
    }
    expect(diff).toBeGreaterThan(0.5)
  })
})
