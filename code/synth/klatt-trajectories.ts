// SPDX-License-Identifier: GPL-3.0-or-later

import type { VowelKey } from '@/synth/vowel-shapes'

/**
 * Full Klatt 1980 per-CV parameter trajectories.
 *
 * Values draw from:
 *   - Klatt 1980 Tables III-V (consonant + vowel parameters)
 *   - Stevens 1998 Acoustic Phonetics, Ch. 7-10
 *   - Peterson & Barney 1952 (vowel formants)
 *
 * Each consonant has a Klatt parameter spec — locus
 * formants, parallel-bank amplitudes, anti-resonances,
 * source mix, timing. The trajectory builder composes
 * the consonant's spec with the vowel's spec into a
 * sequence of keyframes the synth interpolates between.
 */

export type FormantSpec = {
  freq: number
  bw: number
}

export type ParallelFormantSpec = FormantSpec & {
  /** Amplitude for this formant in the parallel bank (linear, 0-1). */
  amp: number
}

export type SourceMix = {
  av: number // voicing → cascade
  avs: number // voicing → parallel
  ah: number // aspiration → cascade
  af: number // frication → parallel
  ab: number // bypass noise
  an: number // nasal pole
}

export type KlattFrame = {
  /** Time in seconds from CV start. */
  time: number
  /** Source amplitude mix. */
  source: SourceMix
  /** Spectral tilt (dB attenuation at 3 kHz). */
  tl: number
  /** Cascade formant positions (F1-F5). */
  cascade: FormantSpec[]
  /** Parallel formant positions + amplitudes (A2-A6, A1 typically inactive). */
  parallel: ParallelFormantSpec[]
  /** Nasal pole position (active when source.an > 0). */
  nasalPole: FormantSpec
  /** Nasal zero position (active when source.an > 0). */
  nasalZero: FormantSpec
}

/**
 * Vowel steady-state targets — full Klatt set.
 *
 * F1-F5 with realistic bandwidths. F4 is around 3300-3500
 * for adult male; F5 around 4200-4500. Parallel-bank
 * amplitudes for vowels are zero (voiced sounds route
 * through the cascade only).
 */

type VowelTarget = {
  cascade: FormantSpec[]
  parallel: ParallelFormantSpec[]
}

const VOWEL_BWS = [60, 90, 150, 200, 200]

const VOWEL_TARGETS: Record<VowelKey, VowelTarget> = {
  i: {
    cascade: [
      { freq: 270, bw: 60 },
      { freq: 2290, bw: 90 },
      { freq: 3010, bw: 150 },
      { freq: 3700, bw: 200 },
      { freq: 4500, bw: 200 },
    ],
    parallel: [],
  },
  e: {
    cascade: [
      { freq: 530, bw: 60 },
      { freq: 1840, bw: 90 },
      { freq: 2480, bw: 150 },
      { freq: 3500, bw: 200 },
      { freq: 4500, bw: 200 },
    ],
    parallel: [],
  },
  a: {
    cascade: [
      { freq: 730, bw: 60 },
      { freq: 1090, bw: 90 },
      { freq: 2440, bw: 150 },
      { freq: 3400, bw: 200 },
      { freq: 4500, bw: 200 },
    ],
    parallel: [],
  },
  o: {
    cascade: [
      { freq: 570, bw: 60 },
      { freq: 840, bw: 90 },
      { freq: 2410, bw: 150 },
      { freq: 3400, bw: 200 },
      { freq: 4500, bw: 200 },
    ],
    parallel: [],
  },
  u: {
    cascade: [
      { freq: 300, bw: 60 },
      { freq: 870, bw: 90 },
      { freq: 2240, bw: 150 },
      { freq: 3300, bw: 200 },
      { freq: 4500, bw: 200 },
    ],
    parallel: [],
  },
  schwa: {
    cascade: [
      { freq: 500, bw: 60 },
      { freq: 1500, bw: 90 },
      { freq: 2500, bw: 150 },
      { freq: 3500, bw: 200 },
      { freq: 4500, bw: 200 },
    ],
    parallel: [],
  },
}

const VOWEL_SOURCE: SourceMix = {
  av: 1.0,
  avs: 0,
  ah: 0,
  af: 0,
  ab: 0,
  an: 0,
}

/**
 * The vowel's neutral nasal pole-zero pair — heavily
 * damped (high bandwidth) so it's effectively inactive.
 */

const VOWEL_NASAL_POLE: FormantSpec = { freq: 270, bw: 200 }
const VOWEL_NASAL_ZERO: FormantSpec = { freq: 270, bw: 200 }

/**
 * Per-consonant Klatt parameter spec.
 */

type KlattConsonantSpec = {
  // Cascade formant positions at the hold/closure point.
  // F1 is suppressed (low + wide) for stops + fricatives;
  // present for sonorants.
  cascade: FormantSpec[]

  // Parallel formant positions + amplitudes for the
  // parallel-bank path. KEY for fricative spectra. Values
  // for /s/ have A4-A6 high; /ʃ/ has A3-A4 high; /f/ is
  // broadband-low; etc.
  parallel: ParallelFormantSpec[]

  // Nasal pole-zero pair. For nasals, AN is high and the
  // pole-zero positions vary with place. For non-nasals,
  // an=0 and the pole-zero is dormant.
  nasalPole: FormantSpec
  nasalZero: FormantSpec

  // Source amplitude mix during the consonant hold.
  source: SourceMix

  // Source spectral tilt during the consonant hold.
  tl: number

  // Timing.
  holdDuration: number
  releaseDuration: number
  transitionDuration: number

  // Source amplitudes during the release/burst phase.
  // For voiceless stops, this is where the burst noise
  // lives.
  burstSource?: SourceMix
  burstTl?: number
}

const SILENT_SOURCE: SourceMix = {
  av: 0,
  avs: 0,
  ah: 0,
  af: 0,
  ab: 0,
  an: 0,
}

/**
 * Parallel-bank amplitude defaults for vowel-formant
 * positions (used for fricatives to put energy at the
 * right frequencies). The frequencies are independent of
 * the cascade formants — fricatives use specific
 * front-cavity resonance frequencies.
 */

function makeParallelBank(amps: {
  a2?: number
  a3?: number
  a4?: number
  a5?: number
  a6?: number
  f2?: number
  f3?: number
  f4?: number
  f5?: number
  f6?: number
}): ParallelFormantSpec[] {
  return [
    { freq: amps.f2 ?? 1500, bw: 200, amp: amps.a2 ?? 0 },
    { freq: amps.f3 ?? 2500, bw: 250, amp: amps.a3 ?? 0 },
    { freq: amps.f4 ?? 3500, bw: 300, amp: amps.a4 ?? 0 },
    { freq: amps.f5 ?? 4800, bw: 500, amp: amps.a5 ?? 0 },
    { freq: amps.f6 ?? 6000, bw: 800, amp: amps.a6 ?? 0 },
  ]
}

/**
 * The big table.
 *
 * Each entry calibrated from Klatt 1980 Table V + Stevens
 * 1998 chapter-end tables. F1 locus = 200-300 Hz for
 * stops (closed tract, F1 low). Parallel-bank amplitudes
 * concentrate the noise at the consonant's characteristic
 * front-cavity resonance.
 */

export const KLATT_CONSONANTS: Record<string, KlattConsonantSpec> = {
  // ====================== STOPS ======================
  // Voiceless stops — silent closure, then burst with
  // parallel-bank noise at the place-specific frequency,
  // then aspiration during VOT.
  p: {
    cascade: [
      { freq: 200, bw: 200 }, // F1 suppressed
      { freq: 600, bw: 150 }, // F2 bilabial locus (Stevens 1998)
      { freq: 2000, bw: 200 }, // F3 bilabial locus
      { freq: 3300, bw: 250 },
      { freq: 4500, bw: 300 },
    ],
    parallel: makeParallelBank({ a2: 0, a3: 0, a4: 0, a5: 0 }),
    nasalPole: VOWEL_NASAL_POLE,
    nasalZero: VOWEL_NASAL_ZERO,
    source: SILENT_SOURCE,
    tl: 0,
    holdDuration: 0.10,
    releaseDuration: 0.025,
    transitionDuration: 0.08,
    burstSource: {
      av: 0,
      avs: 0,
      ah: 0.7, // aspiration in cascade — bilabial diffuses
      af: 0.4,
      ab: 0,
      an: 0,
    },
    burstTl: 5,
  },
  t: {
    cascade: [
      { freq: 200, bw: 200 },
      { freq: 1800, bw: 150 },
      { freq: 2700, bw: 200 },
      { freq: 3600, bw: 250 },
      { freq: 4800, bw: 300 },
    ],
    parallel: makeParallelBank({
      // /t/ burst: broad high-frequency
      f4: 4000, a4: 0.6,
      f5: 5500, a5: 0.7,
      f6: 7000, a6: 0.5,
    }),
    nasalPole: VOWEL_NASAL_POLE,
    nasalZero: VOWEL_NASAL_ZERO,
    source: SILENT_SOURCE,
    tl: 0,
    holdDuration: 0.08,
    releaseDuration: 0.015,
    transitionDuration: 0.06,
    burstSource: {
      av: 0,
      avs: 0,
      ah: 0.5,
      af: 0.9,
      ab: 0,
      an: 0,
    },
    burstTl: 0,
  },
  k: {
    cascade: [
      { freq: 200, bw: 200 },
      { freq: 2000, bw: 150 },
      { freq: 2500, bw: 200 },
      { freq: 3500, bw: 250 },
      { freq: 4500, bw: 300 },
    ],
    parallel: makeParallelBank({
      // /k/ burst: compact mid-frequency
      f3: 2300, a3: 0.7,
      f4: 3000, a4: 0.5,
    }),
    nasalPole: VOWEL_NASAL_POLE,
    nasalZero: VOWEL_NASAL_ZERO,
    source: SILENT_SOURCE,
    tl: 0,
    holdDuration: 0.08,
    releaseDuration: 0.020,
    transitionDuration: 0.06,
    burstSource: {
      av: 0,
      avs: 0,
      ah: 0.6,
      af: 0.85,
      ab: 0,
      an: 0,
    },
    burstTl: 2,
  },
  // Voiced stops — voice bar (low F1 voicing) during
  // closure, brief burst at release, short VOT.
  b: {
    cascade: [
      { freq: 250, bw: 100 }, // voice bar
      { freq: 600, bw: 150 }, // bilabial F2 locus
      { freq: 2000, bw: 200 },
      { freq: 3300, bw: 250 },
      { freq: 4500, bw: 300 },
    ],
    parallel: makeParallelBank({}),
    nasalPole: VOWEL_NASAL_POLE,
    nasalZero: VOWEL_NASAL_ZERO,
    source: { av: 0.4, avs: 0, ah: 0, af: 0, ab: 0, an: 0 },
    tl: 12,
    holdDuration: 0.07,
    releaseDuration: 0.010,
    transitionDuration: 0.05,
    burstSource: {
      av: 0.7,
      avs: 0,
      ah: 0.1,
      af: 0.3,
      ab: 0,
      an: 0,
    },
    burstTl: 8,
  },
  d: {
    cascade: [
      { freq: 250, bw: 100 },
      { freq: 1800, bw: 150 },
      { freq: 2700, bw: 200 },
      { freq: 3600, bw: 250 },
      { freq: 4800, bw: 300 },
    ],
    parallel: makeParallelBank({
      f4: 4000, a4: 0.3,
      f5: 5500, a5: 0.3,
    }),
    nasalPole: VOWEL_NASAL_POLE,
    nasalZero: VOWEL_NASAL_ZERO,
    source: { av: 0.4, avs: 0, ah: 0, af: 0, ab: 0, an: 0 },
    tl: 12,
    holdDuration: 0.07,
    releaseDuration: 0.010,
    transitionDuration: 0.05,
    burstSource: {
      av: 0.7,
      avs: 0,
      ah: 0.05,
      af: 0.5,
      ab: 0,
      an: 0,
    },
    burstTl: 4,
  },
  g: {
    cascade: [
      { freq: 250, bw: 100 },
      { freq: 2000, bw: 150 },
      { freq: 2500, bw: 200 },
      { freq: 3500, bw: 250 },
      { freq: 4500, bw: 300 },
    ],
    parallel: makeParallelBank({
      f3: 2300, a3: 0.4,
      f4: 3000, a4: 0.3,
    }),
    nasalPole: VOWEL_NASAL_POLE,
    nasalZero: VOWEL_NASAL_ZERO,
    source: { av: 0.4, avs: 0, ah: 0, af: 0, ab: 0, an: 0 },
    tl: 12,
    holdDuration: 0.07,
    releaseDuration: 0.015,
    transitionDuration: 0.05,
    burstSource: {
      av: 0.7,
      avs: 0,
      ah: 0.05,
      af: 0.5,
      ab: 0,
      an: 0,
    },
    burstTl: 5,
  },
  // /c/ /J/ palatal stops
  c: {
    cascade: [
      { freq: 200, bw: 200 },
      { freq: 2200, bw: 150 },
      { freq: 2800, bw: 200 },
      { freq: 3600, bw: 250 },
      { freq: 4500, bw: 300 },
    ],
    parallel: makeParallelBank({ f3: 2800, a3: 0.7, f4: 3500, a4: 0.5 }),
    nasalPole: VOWEL_NASAL_POLE,
    nasalZero: VOWEL_NASAL_ZERO,
    source: SILENT_SOURCE,
    tl: 0,
    holdDuration: 0.08,
    releaseDuration: 0.020,
    transitionDuration: 0.06,
    burstSource: { av: 0, avs: 0, ah: 0.5, af: 0.85, ab: 0, an: 0 },
    burstTl: 2,
  },
  J: {
    cascade: [
      { freq: 250, bw: 100 },
      { freq: 2200, bw: 150 },
      { freq: 2800, bw: 200 },
      { freq: 3600, bw: 250 },
      { freq: 4500, bw: 300 },
    ],
    parallel: makeParallelBank({ f3: 2800, a3: 0.4 }),
    nasalPole: VOWEL_NASAL_POLE,
    nasalZero: VOWEL_NASAL_ZERO,
    source: { av: 0.4, avs: 0, ah: 0, af: 0, ab: 0, an: 0 },
    tl: 12,
    holdDuration: 0.07,
    releaseDuration: 0.015,
    transitionDuration: 0.05,
    burstSource: { av: 0.7, avs: 0, ah: 0.05, af: 0.4, ab: 0, an: 0 },
    burstTl: 5,
  },
  // /K/ uvular stop
  K: {
    cascade: [
      { freq: 200, bw: 200 },
      { freq: 1300, bw: 150 },
      { freq: 2200, bw: 200 },
      { freq: 3300, bw: 250 },
      { freq: 4500, bw: 300 },
    ],
    parallel: makeParallelBank({ f2: 1500, a2: 0.6, f3: 2200, a3: 0.5 }),
    nasalPole: VOWEL_NASAL_POLE,
    nasalZero: VOWEL_NASAL_ZERO,
    source: SILENT_SOURCE,
    tl: 0,
    holdDuration: 0.08,
    releaseDuration: 0.020,
    transitionDuration: 0.06,
    burstSource: { av: 0, avs: 0, ah: 0.5, af: 0.7, ab: 0, an: 0 },
    burstTl: 6,
  },
  // Glottal stop
  "'": {
    cascade: [
      { freq: 250, bw: 200 },
      { freq: 1500, bw: 200 },
      { freq: 2500, bw: 250 },
      { freq: 3500, bw: 300 },
      { freq: 4500, bw: 300 },
    ],
    parallel: makeParallelBank({}),
    nasalPole: VOWEL_NASAL_POLE,
    nasalZero: VOWEL_NASAL_ZERO,
    source: SILENT_SOURCE,
    tl: 0,
    holdDuration: 0.06,
    releaseDuration: 0.005,
    transitionDuration: 0.05,
    burstSource: { av: 0, avs: 0, ah: 0.4, af: 0.3, ab: 0, an: 0 },
    burstTl: 10,
  },
  // ====================== NASALS ======================
  // Real nasals get their identity from the place-specific
  // ANTI-FORMANT (nasalZero), not from any other cue. The
  // nasal pole at ~270 Hz is the SAME for all nasals; the
  // distinction is the zero's location.
  m: {
    cascade: [
      { freq: 480, bw: 100 }, // F1 damped
      { freq: 1100, bw: 120 }, // bilabial F2 locus
      { freq: 2400, bw: 200 },
      { freq: 3300, bw: 300 },
      { freq: 4500, bw: 400 },
    ],
    parallel: makeParallelBank({}),
    nasalPole: { freq: 270, bw: 100 },
    nasalZero: { freq: 750, bw: 100 }, // long oral side branch
    source: { av: 0.8, avs: 0, ah: 0, af: 0, ab: 0, an: 0.9 },
    tl: 6,
    holdDuration: 0.10,
    releaseDuration: 0.030,
    transitionDuration: 0.06,
  },
  n: {
    cascade: [
      { freq: 480, bw: 100 },
      { freq: 1700, bw: 120 },
      { freq: 2700, bw: 200 },
      { freq: 3600, bw: 300 },
      { freq: 4500, bw: 400 },
    ],
    parallel: makeParallelBank({}),
    nasalPole: { freq: 270, bw: 100 },
    nasalZero: { freq: 1450, bw: 150 }, // shorter oral side branch
    source: { av: 0.8, avs: 0, ah: 0, af: 0, ab: 0, an: 0.9 },
    tl: 6,
    holdDuration: 0.10,
    releaseDuration: 0.030,
    transitionDuration: 0.06,
  },
  q: {
    // /ŋ/ velar nasal — very short side branch
    cascade: [
      { freq: 480, bw: 100 },
      { freq: 2200, bw: 150 },
      { freq: 2700, bw: 200 },
      { freq: 3500, bw: 300 },
      { freq: 4500, bw: 400 },
    ],
    parallel: makeParallelBank({}),
    nasalPole: { freq: 270, bw: 100 },
    nasalZero: { freq: 2900, bw: 200 }, // very short side branch → high zero
    source: { av: 0.8, avs: 0, ah: 0, af: 0, ab: 0, an: 0.9 },
    tl: 6,
    holdDuration: 0.10,
    releaseDuration: 0.030,
    transitionDuration: 0.06,
  },
  N: {
    // /ɲ/ palatal nasal
    cascade: [
      { freq: 480, bw: 100 },
      { freq: 2300, bw: 150 },
      { freq: 2800, bw: 200 },
      { freq: 3500, bw: 300 },
      { freq: 4500, bw: 400 },
    ],
    parallel: makeParallelBank({}),
    nasalPole: { freq: 270, bw: 100 },
    nasalZero: { freq: 2100, bw: 180 },
    source: { av: 0.8, avs: 0, ah: 0, af: 0, ab: 0, an: 0.9 },
    tl: 6,
    holdDuration: 0.10,
    releaseDuration: 0.030,
    transitionDuration: 0.06,
  },
  M: {
    // /ɱ/ labiodental nasal — close to /m/
    cascade: [
      { freq: 480, bw: 100 },
      { freq: 1200, bw: 120 },
      { freq: 2400, bw: 200 },
      { freq: 3300, bw: 300 },
      { freq: 4500, bw: 400 },
    ],
    parallel: makeParallelBank({}),
    nasalPole: { freq: 270, bw: 100 },
    nasalZero: { freq: 850, bw: 100 },
    source: { av: 0.8, avs: 0, ah: 0, af: 0, ab: 0, an: 0.9 },
    tl: 6,
    holdDuration: 0.10,
    releaseDuration: 0.030,
    transitionDuration: 0.06,
  },
  // ====================== FRICATIVES ======================
  // Fricatives: AF drives the parallel bank with place-
  // specific amplitudes. NO cascade voicing for voiceless;
  // BOTH cascade voicing + parallel noise for voiced.
  s: {
    cascade: [
      { freq: 400, bw: 200 },
      { freq: 1700, bw: 250 },
      { freq: 2700, bw: 300 },
      { freq: 3700, bw: 350 },
      { freq: 5000, bw: 400 },
    ],
    parallel: makeParallelBank({
      // /s/ has a HUGE peak at 5-7 kHz from the short
      // front cavity. A5+A6 dominate.
      f4: 4000, a4: 0.3,
      f5: 5500, a5: 0.9,
      f6: 7000, a6: 0.8,
    }),
    nasalPole: VOWEL_NASAL_POLE,
    nasalZero: VOWEL_NASAL_ZERO,
    source: { av: 0, avs: 0, ah: 0, af: 0.95, ab: 0, an: 0 },
    tl: 0,
    holdDuration: 0.14,
    releaseDuration: 0.040,
    transitionDuration: 0.05,
  },
  z: {
    cascade: [
      { freq: 400, bw: 150 },
      { freq: 1700, bw: 200 },
      { freq: 2700, bw: 250 },
      { freq: 3700, bw: 300 },
      { freq: 5000, bw: 350 },
    ],
    parallel: makeParallelBank({
      f4: 4000, a4: 0.2,
      f5: 5500, a5: 0.6,
      f6: 7000, a6: 0.5,
    }),
    nasalPole: VOWEL_NASAL_POLE,
    nasalZero: VOWEL_NASAL_ZERO,
    source: { av: 0.4, avs: 0.4, ah: 0, af: 0.7, ab: 0, an: 0 },
    tl: 6,
    holdDuration: 0.12,
    releaseDuration: 0.035,
    transitionDuration: 0.05,
  },
  sh: {
    cascade: [
      { freq: 400, bw: 200 },
      { freq: 1700, bw: 250 },
      { freq: 2500, bw: 300 },
      { freq: 3700, bw: 350 },
      { freq: 5000, bw: 400 },
    ],
    parallel: makeParallelBank({
      // /ʃ/ has peak at 2-4 kHz from longer front cavity.
      // A3+A4 dominate. A5+A6 lower than /s/.
      f3: 2500, a3: 0.7,
      f4: 3500, a4: 0.9,
      f5: 4800, a5: 0.5,
      f6: 6000, a6: 0.3,
    }),
    nasalPole: VOWEL_NASAL_POLE,
    nasalZero: VOWEL_NASAL_ZERO,
    source: { av: 0, avs: 0, ah: 0, af: 0.9, ab: 0, an: 0 },
    tl: 0,
    holdDuration: 0.14,
    releaseDuration: 0.040,
    transitionDuration: 0.05,
  },
  zh: {
    cascade: [
      { freq: 400, bw: 150 },
      { freq: 1700, bw: 200 },
      { freq: 2500, bw: 250 },
      { freq: 3700, bw: 300 },
      { freq: 5000, bw: 350 },
    ],
    parallel: makeParallelBank({
      f3: 2500, a3: 0.5,
      f4: 3500, a4: 0.6,
      f5: 4800, a5: 0.3,
    }),
    nasalPole: VOWEL_NASAL_POLE,
    nasalZero: VOWEL_NASAL_ZERO,
    source: { av: 0.4, avs: 0.4, ah: 0, af: 0.65, ab: 0, an: 0 },
    tl: 6,
    holdDuration: 0.12,
    releaseDuration: 0.035,
    transitionDuration: 0.05,
  },
  f: {
    cascade: [
      { freq: 400, bw: 200 },
      { freq: 1200, bw: 250 },
      { freq: 2500, bw: 300 },
      { freq: 3500, bw: 350 },
      { freq: 4500, bw: 400 },
    ],
    parallel: makeParallelBank({
      // /f/ has no front cavity — broadband weak noise
      f2: 1500, a2: 0.2,
      f3: 2500, a3: 0.3,
      f4: 3500, a4: 0.35,
      f5: 4800, a5: 0.3,
      f6: 6000, a6: 0.2,
    }),
    nasalPole: VOWEL_NASAL_POLE,
    nasalZero: VOWEL_NASAL_ZERO,
    source: { av: 0, avs: 0, ah: 0, af: 0.5, ab: 0, an: 0 },
    tl: 0,
    holdDuration: 0.14,
    releaseDuration: 0.040,
    transitionDuration: 0.05,
  },
  v: {
    cascade: [
      { freq: 400, bw: 150 },
      { freq: 1200, bw: 200 },
      { freq: 2500, bw: 250 },
      { freq: 3500, bw: 300 },
      { freq: 4500, bw: 350 },
    ],
    parallel: makeParallelBank({
      f3: 2500, a3: 0.2,
      f4: 3500, a4: 0.25,
      f5: 4800, a5: 0.2,
    }),
    nasalPole: VOWEL_NASAL_POLE,
    nasalZero: VOWEL_NASAL_ZERO,
    source: { av: 0.5, avs: 0.5, ah: 0, af: 0.4, ab: 0, an: 0 },
    tl: 6,
    holdDuration: 0.12,
    releaseDuration: 0.035,
    transitionDuration: 0.05,
  },
  T: {
    // /θ/ dental
    cascade: [
      { freq: 400, bw: 200 },
      { freq: 1500, bw: 250 },
      { freq: 2700, bw: 300 },
      { freq: 3500, bw: 350 },
      { freq: 4500, bw: 400 },
    ],
    parallel: makeParallelBank({
      // /θ/ — broader high-frequency, weaker than /s/
      f4: 4000, a4: 0.35,
      f5: 5500, a5: 0.45,
      f6: 7000, a6: 0.4,
    }),
    nasalPole: VOWEL_NASAL_POLE,
    nasalZero: VOWEL_NASAL_ZERO,
    source: { av: 0, avs: 0, ah: 0, af: 0.5, ab: 0, an: 0 },
    tl: 0,
    holdDuration: 0.14,
    releaseDuration: 0.040,
    transitionDuration: 0.05,
  },
  D: {
    // /ð/ dental voiced
    cascade: [
      { freq: 400, bw: 150 },
      { freq: 1500, bw: 200 },
      { freq: 2700, bw: 250 },
      { freq: 3500, bw: 300 },
      { freq: 4500, bw: 350 },
    ],
    parallel: makeParallelBank({
      f4: 4000, a4: 0.2,
      f5: 5500, a5: 0.3,
    }),
    nasalPole: VOWEL_NASAL_POLE,
    nasalZero: VOWEL_NASAL_ZERO,
    source: { av: 0.5, avs: 0.5, ah: 0, af: 0.35, ab: 0, an: 0 },
    tl: 6,
    holdDuration: 0.12,
    releaseDuration: 0.035,
    transitionDuration: 0.05,
  },
  x: {
    // /x/ velar fricative
    cascade: [
      { freq: 500, bw: 200 },
      { freq: 1900, bw: 250 },
      { freq: 2500, bw: 300 },
      { freq: 3500, bw: 350 },
      { freq: 4500, bw: 400 },
    ],
    parallel: makeParallelBank({
      f2: 1500, a2: 0.5,
      f3: 2500, a3: 0.4,
      f4: 3500, a4: 0.2,
    }),
    nasalPole: VOWEL_NASAL_POLE,
    nasalZero: VOWEL_NASAL_ZERO,
    source: { av: 0, avs: 0, ah: 0.2, af: 0.55, ab: 0, an: 0 },
    tl: 4,
    holdDuration: 0.14,
    releaseDuration: 0.040,
    transitionDuration: 0.05,
  },
  G: {
    // /ɣ/ velar voiced
    cascade: [
      { freq: 500, bw: 150 },
      { freq: 1900, bw: 200 },
      { freq: 2500, bw: 250 },
      { freq: 3500, bw: 300 },
      { freq: 4500, bw: 350 },
    ],
    parallel: makeParallelBank({
      f2: 1500, a2: 0.3,
      f3: 2500, a3: 0.25,
    }),
    nasalPole: VOWEL_NASAL_POLE,
    nasalZero: VOWEL_NASAL_ZERO,
    source: { av: 0.5, avs: 0.5, ah: 0, af: 0.3, ab: 0, an: 0 },
    tl: 8,
    holdDuration: 0.12,
    releaseDuration: 0.035,
    transitionDuration: 0.05,
  },
  X: {
    // /χ/ uvular fricative
    cascade: [
      { freq: 600, bw: 200 },
      { freq: 1500, bw: 250 },
      { freq: 2200, bw: 300 },
      { freq: 3300, bw: 350 },
      { freq: 4500, bw: 400 },
    ],
    parallel: makeParallelBank({
      f2: 1200, a2: 0.6,
      f3: 2200, a3: 0.4,
    }),
    nasalPole: VOWEL_NASAL_POLE,
    nasalZero: VOWEL_NASAL_ZERO,
    source: { av: 0, avs: 0, ah: 0.15, af: 0.55, ab: 0, an: 0 },
    tl: 5,
    holdDuration: 0.14,
    releaseDuration: 0.040,
    transitionDuration: 0.05,
  },
  H: {
    // /ħ/ pharyngeal
    cascade: [
      { freq: 700, bw: 250 },
      { freq: 1200, bw: 300 },
      { freq: 2200, bw: 350 },
      { freq: 3300, bw: 400 },
      { freq: 4500, bw: 400 },
    ],
    parallel: makeParallelBank({
      f2: 1000, a2: 0.5,
      f3: 2200, a3: 0.3,
    }),
    nasalPole: VOWEL_NASAL_POLE,
    nasalZero: VOWEL_NASAL_ZERO,
    source: { av: 0, avs: 0, ah: 0.15, af: 0.4, ab: 0, an: 0 },
    tl: 8,
    holdDuration: 0.14,
    releaseDuration: 0.040,
    transitionDuration: 0.05,
  },
  Q: {
    // /ʕ/ voiced pharyngeal
    cascade: [
      { freq: 700, bw: 200 },
      { freq: 1200, bw: 250 },
      { freq: 2200, bw: 300 },
      { freq: 3300, bw: 350 },
      { freq: 4500, bw: 400 },
    ],
    parallel: makeParallelBank({
      f2: 1000, a2: 0.2,
    }),
    nasalPole: VOWEL_NASAL_POLE,
    nasalZero: VOWEL_NASAL_ZERO,
    source: { av: 0.7, avs: 0.3, ah: 0, af: 0.15, ab: 0, an: 0 },
    tl: 10,
    holdDuration: 0.12,
    releaseDuration: 0.035,
    transitionDuration: 0.05,
  },
  C: {
    // /ç/ palatal voiceless
    cascade: [
      { freq: 300, bw: 200 },
      { freq: 2200, bw: 250 },
      { freq: 2800, bw: 300 },
      { freq: 3600, bw: 350 },
      { freq: 4800, bw: 400 },
    ],
    parallel: makeParallelBank({
      f3: 2800, a3: 0.5,
      f4: 4000, a4: 0.6,
      f5: 5500, a5: 0.4,
    }),
    nasalPole: VOWEL_NASAL_POLE,
    nasalZero: VOWEL_NASAL_ZERO,
    source: { av: 0, avs: 0, ah: 0, af: 0.5, ab: 0, an: 0 },
    tl: 0,
    holdDuration: 0.14,
    releaseDuration: 0.040,
    transitionDuration: 0.05,
  },
  Z: {
    // /ʝ/ palatal voiced
    cascade: [
      { freq: 300, bw: 150 },
      { freq: 2200, bw: 200 },
      { freq: 2800, bw: 250 },
      { freq: 3600, bw: 300 },
      { freq: 4800, bw: 350 },
    ],
    parallel: makeParallelBank({
      f3: 2800, a3: 0.3,
      f4: 4000, a4: 0.35,
    }),
    nasalPole: VOWEL_NASAL_POLE,
    nasalZero: VOWEL_NASAL_ZERO,
    source: { av: 0.5, avs: 0.5, ah: 0, af: 0.3, ab: 0, an: 0 },
    tl: 6,
    holdDuration: 0.12,
    releaseDuration: 0.035,
    transitionDuration: 0.05,
  },
  F: {
    // /ɸ/ bilabial fricative
    cascade: [
      { freq: 400, bw: 200 },
      { freq: 1200, bw: 250 },
      { freq: 2500, bw: 300 },
      { freq: 3500, bw: 350 },
      { freq: 4500, bw: 400 },
    ],
    parallel: makeParallelBank({
      f2: 1500, a2: 0.25,
      f3: 2500, a3: 0.25,
      f4: 3500, a4: 0.25,
    }),
    nasalPole: VOWEL_NASAL_POLE,
    nasalZero: VOWEL_NASAL_ZERO,
    source: { av: 0, avs: 0, ah: 0, af: 0.4, ab: 0, an: 0 },
    tl: 0,
    holdDuration: 0.14,
    releaseDuration: 0.040,
    transitionDuration: 0.05,
  },
  B: {
    // /β/ bilabial voiced
    cascade: [
      { freq: 400, bw: 150 },
      { freq: 1200, bw: 200 },
      { freq: 2500, bw: 250 },
      { freq: 3500, bw: 300 },
      { freq: 4500, bw: 350 },
    ],
    parallel: makeParallelBank({}),
    nasalPole: VOWEL_NASAL_POLE,
    nasalZero: VOWEL_NASAL_ZERO,
    source: { av: 0.6, avs: 0.4, ah: 0, af: 0.25, ab: 0, an: 0 },
    tl: 6,
    holdDuration: 0.12,
    releaseDuration: 0.035,
    transitionDuration: 0.05,
  },
  h: {
    // /h/ — pure aspiration; glottal noise through the
    // cascade with the FOLLOWING vowel's formants.
    cascade: [
      { freq: 500, bw: 300 },
      { freq: 1500, bw: 350 },
      { freq: 2500, bw: 400 },
      { freq: 3500, bw: 400 },
      { freq: 4500, bw: 400 },
    ],
    parallel: makeParallelBank({}),
    nasalPole: VOWEL_NASAL_POLE,
    nasalZero: VOWEL_NASAL_ZERO,
    source: { av: 0, avs: 0, ah: 0.5, af: 0, ab: 0, an: 0 },
    tl: 0,
    holdDuration: 0.10,
    releaseDuration: 0.040,
    transitionDuration: 0.05,
  },
  // ====================== AFFRICATES ======================
  ch: {
    // /tʃ/
    cascade: [
      { freq: 300, bw: 200 },
      { freq: 1700, bw: 250 },
      { freq: 2500, bw: 300 },
      { freq: 3700, bw: 350 },
      { freq: 4800, bw: 400 },
    ],
    parallel: makeParallelBank({
      f3: 2500, a3: 0.6,
      f4: 3500, a4: 0.85,
      f5: 4800, a5: 0.5,
    }),
    nasalPole: VOWEL_NASAL_POLE,
    nasalZero: VOWEL_NASAL_ZERO,
    source: SILENT_SOURCE,
    tl: 0,
    holdDuration: 0.04,
    releaseDuration: 0.08,
    transitionDuration: 0.04,
    burstSource: { av: 0, avs: 0, ah: 0.1, af: 0.9, ab: 0, an: 0 },
    burstTl: 0,
  },
  j: {
    // /dʒ/
    cascade: [
      { freq: 300, bw: 150 },
      { freq: 1700, bw: 200 },
      { freq: 2500, bw: 250 },
      { freq: 3700, bw: 300 },
      { freq: 4800, bw: 350 },
    ],
    parallel: makeParallelBank({
      f3: 2500, a3: 0.4,
      f4: 3500, a4: 0.6,
    }),
    nasalPole: VOWEL_NASAL_POLE,
    nasalZero: VOWEL_NASAL_ZERO,
    source: { av: 0.4, avs: 0, ah: 0, af: 0, ab: 0, an: 0 },
    tl: 12,
    holdDuration: 0.04,
    releaseDuration: 0.07,
    transitionDuration: 0.04,
    burstSource: { av: 0.7, avs: 0.3, ah: 0.05, af: 0.6, ab: 0, an: 0 },
    burstTl: 5,
  },
  tx: {
    // /ts/
    cascade: [
      { freq: 300, bw: 200 },
      { freq: 1700, bw: 250 },
      { freq: 2700, bw: 300 },
      { freq: 3700, bw: 350 },
      { freq: 5000, bw: 400 },
    ],
    parallel: makeParallelBank({
      f5: 5500, a5: 0.85,
      f6: 7000, a6: 0.7,
    }),
    nasalPole: VOWEL_NASAL_POLE,
    nasalZero: VOWEL_NASAL_ZERO,
    source: SILENT_SOURCE,
    tl: 0,
    holdDuration: 0.04,
    releaseDuration: 0.08,
    transitionDuration: 0.04,
    burstSource: { av: 0, avs: 0, ah: 0.1, af: 0.9, ab: 0, an: 0 },
    burstTl: 0,
  },
  dj: {
    // /dz/
    cascade: [
      { freq: 300, bw: 150 },
      { freq: 1700, bw: 200 },
      { freq: 2700, bw: 250 },
      { freq: 3700, bw: 300 },
      { freq: 5000, bw: 350 },
    ],
    parallel: makeParallelBank({
      f5: 5500, a5: 0.55,
      f6: 7000, a6: 0.4,
    }),
    nasalPole: VOWEL_NASAL_POLE,
    nasalZero: VOWEL_NASAL_ZERO,
    source: { av: 0.4, avs: 0, ah: 0, af: 0, ab: 0, an: 0 },
    tl: 12,
    holdDuration: 0.04,
    releaseDuration: 0.07,
    transitionDuration: 0.04,
    burstSource: { av: 0.7, avs: 0.3, ah: 0.05, af: 0.6, ab: 0, an: 0 },
    burstTl: 5,
  },
  // ====================== APPROXIMANTS ======================
  // Approximants are voiced sonorants — they go through
  // the cascade with their own formant trajectories.
  y: {
    // /j/ — palatal: very high F2
    cascade: [
      { freq: 240, bw: 60 },
      { freq: 2300, bw: 90 },
      { freq: 3000, bw: 150 },
      { freq: 3700, bw: 200 },
      { freq: 4500, bw: 200 },
    ],
    parallel: makeParallelBank({}),
    nasalPole: VOWEL_NASAL_POLE,
    nasalZero: VOWEL_NASAL_ZERO,
    source: { av: 0.9, avs: 0, ah: 0, af: 0, ab: 0, an: 0 },
    tl: 0,
    holdDuration: 0.07,
    releaseDuration: 0.060,
    transitionDuration: 0.04,
  },
  w: {
    // /w/ — labio-velar: very low F1 + F2
    cascade: [
      { freq: 290, bw: 60 },
      { freq: 610, bw: 90 },
      { freq: 2150, bw: 150 },
      { freq: 3300, bw: 200 },
      { freq: 4500, bw: 200 },
    ],
    parallel: makeParallelBank({}),
    nasalPole: VOWEL_NASAL_POLE,
    nasalZero: VOWEL_NASAL_ZERO,
    source: { av: 0.9, avs: 0, ah: 0, af: 0, ab: 0, an: 0 },
    tl: 0,
    holdDuration: 0.07,
    releaseDuration: 0.060,
    transitionDuration: 0.04,
  },
  V: {
    // /ʋ/ — labiodental approximant
    cascade: [
      { freq: 350, bw: 60 },
      { freq: 1200, bw: 90 },
      { freq: 2200, bw: 150 },
      { freq: 3300, bw: 200 },
      { freq: 4500, bw: 200 },
    ],
    parallel: makeParallelBank({}),
    nasalPole: VOWEL_NASAL_POLE,
    nasalZero: VOWEL_NASAL_ZERO,
    source: { av: 0.9, avs: 0, ah: 0, af: 0, ab: 0, an: 0 },
    tl: 0,
    holdDuration: 0.07,
    releaseDuration: 0.060,
    transitionDuration: 0.04,
  },
  l: {
    // /l/ — alveolar lateral. The lateral channel
    // contributes an ANTIFORMANT around 2500 Hz which we
    // approximate using the nasal-zero machinery (zero is
    // a zero is a zero from the cascade's point of view).
    cascade: [
      { freq: 360, bw: 60 },
      { freq: 1300, bw: 90 },
      { freq: 2700, bw: 200 },
      { freq: 3600, bw: 200 },
      { freq: 4500, bw: 200 },
    ],
    parallel: makeParallelBank({}),
    // Use the nasal pole-zero as a lateral pole-zero pair.
    nasalPole: { freq: 270, bw: 250 }, // weak lateral pole
    nasalZero: { freq: 2500, bw: 250 }, // lateral antiformant
    source: { av: 0.9, avs: 0, ah: 0, af: 0, ab: 0, an: 0.3 },
    tl: 0,
    holdDuration: 0.08,
    releaseDuration: 0.040,
    transitionDuration: 0.04,
  },
  L: {
    // /ʎ/ palatal lateral
    cascade: [
      { freq: 300, bw: 60 },
      { freq: 2000, bw: 90 },
      { freq: 2700, bw: 200 },
      { freq: 3500, bw: 200 },
      { freq: 4500, bw: 200 },
    ],
    parallel: makeParallelBank({}),
    nasalPole: { freq: 270, bw: 250 },
    nasalZero: { freq: 2900, bw: 250 },
    source: { av: 0.9, avs: 0, ah: 0, af: 0, ab: 0, an: 0.3 },
    tl: 0,
    holdDuration: 0.08,
    releaseDuration: 0.040,
    transitionDuration: 0.04,
  },
  // ====================== TRILLS ======================
  r: {
    // /r/ — alveolar trill. The trill itself is amplitude-
    // modulated voicing at ~28 Hz. Bandwidth wider during
    // trill than steady state.
    cascade: [
      { freq: 350, bw: 100 },
      { freq: 1300, bw: 150 },
      { freq: 2500, bw: 250 },
      { freq: 3500, bw: 300 },
      { freq: 4500, bw: 300 },
    ],
    parallel: makeParallelBank({}),
    nasalPole: VOWEL_NASAL_POLE,
    nasalZero: VOWEL_NASAL_ZERO,
    source: { av: 0.7, avs: 0, ah: 0, af: 0, ab: 0, an: 0 },
    tl: 4,
    holdDuration: 0.14,
    releaseDuration: 0.040,
    transitionDuration: 0.04,
  },
  R: {
    // /ʀ/ uvular trill
    cascade: [
      { freq: 400, bw: 100 },
      { freq: 900, bw: 150 },
      { freq: 2200, bw: 250 },
      { freq: 3300, bw: 300 },
      { freq: 4500, bw: 300 },
    ],
    parallel: makeParallelBank({}),
    nasalPole: VOWEL_NASAL_POLE,
    nasalZero: VOWEL_NASAL_ZERO,
    source: { av: 0.7, avs: 0, ah: 0, af: 0, ab: 0, an: 0 },
    tl: 4,
    holdDuration: 0.14,
    releaseDuration: 0.040,
    transitionDuration: 0.04,
  },
}

/**
 * talk.js IPA-canonical aliases.
 *
 * The KLATT_CONSONANTS table above is keyed by internal
 * labels that match the original wind-era naming. The
 * canonical talk.js mapping (per
 * `deck/talk.js/make/ipa.ts`) routes a different set of
 * Talk symbols to the same IPA phonemes:
 *
 *   talk.js 'j' → /ʒ/ (we had 'zh' for this)
 *   talk.js 'x' → /ʃ/ (we had 'sh' for this)
 *   talk.js 'c' → /θ/ (we had 'T' for this)
 *   talk.js 'C' → /ð/ (we had 'D' for this)
 *
 * Add these as aliases so the canonical talk.js Talk
 * symbols also resolve to the right parameter set.
 *
 * NOTE: We don't overwrite the original entries — 'T'
 * stays bound to /θ/ params for back-compat. The
 * canonical talk.js semantic for 'T' is /ʈ/ (retroflex
 * stop), and a future refactor can re-tune the params
 * for that meaning.
 */

KLATT_CONSONANTS.j = KLATT_CONSONANTS.zh! // /ʒ/
KLATT_CONSONANTS.x = KLATT_CONSONANTS.sh! // /ʃ/
KLATT_CONSONANTS.c = KLATT_CONSONANTS.T! // /θ/
KLATT_CONSONANTS.C = KLATT_CONSONANTS.D! // /ð/

/**
 * Build a 4-keyframe trajectory for a CV pair.
 *
 * Keyframes:
 *   0 — start of consonant hold (closure / sustained
 *       frication). Source + filter at consonant spec.
 *   1 — end of hold / start of release. If burstSource is
 *       defined, switch to it (the burst happens at
 *       release start, not hold).
 *   2 — end of release. Cascade formants midway between
 *       consonant locus and vowel target. Source ramps
 *       toward full voicing.
 *   3 — end of transition / start of steady vowel. Full
 *       vowel parameters.
 */

export function buildKlattTrajectory(input: {
  consonant: string
  vowel: VowelKey
}): { spec: KlattConsonantSpec; frames: KlattFrame[]; trajectoryEnd: number } {
  const { consonant, vowel } = input
  const spec = KLATT_CONSONANTS[consonant]
  if (!spec) {
    throw new Error(
      `klatt: no parameter spec for consonant '${consonant}'`,
    )
  }
  const vowelTarget = VOWEL_TARGETS[vowel]

  const t0 = 0
  const t1 = spec.holdDuration
  const t2 = t1 + spec.releaseDuration
  const t3 = t2 + spec.transitionDuration

  const release = spec.burstSource ?? spec.source
  const releaseTl = spec.burstTl ?? spec.tl

  const frames: KlattFrame[] = [
    // Keyframe 0 — closure / hold begins.
    {
      time: t0,
      source: spec.source,
      tl: spec.tl,
      cascade: spec.cascade,
      parallel: spec.parallel,
      nasalPole: spec.nasalPole,
      nasalZero: spec.nasalZero,
    },
    // Keyframe 1 — release begins, with burst source.
    {
      time: t1,
      source: release,
      tl: releaseTl,
      cascade: spec.cascade,
      parallel: spec.parallel,
      nasalPole: spec.nasalPole,
      nasalZero: spec.nasalZero,
    },
    // Keyframe 2 — release ends. Formants halfway to vowel.
    // Source has voicing rising and noise falling.
    {
      time: t2,
      source: midSource({ source: release, target: VOWEL_SOURCE, t: 0.5 }),
      tl: releaseTl * 0.5,
      cascade: midFormants({
        from: spec.cascade,
        to: vowelTarget.cascade,
        t: 0.5,
      }),
      parallel: dampParallel(spec.parallel, 0.3),
      nasalPole: spec.nasalPole,
      nasalZero: spec.nasalZero,
    },
    // Keyframe 3 — steady vowel.
    {
      time: t3,
      source: VOWEL_SOURCE,
      tl: 0,
      cascade: vowelTarget.cascade,
      parallel: vowelTarget.parallel.length
        ? vowelTarget.parallel
        : dampParallel(spec.parallel, 0),
      nasalPole: VOWEL_NASAL_POLE,
      nasalZero: VOWEL_NASAL_ZERO,
    },
  ]

  return { spec, frames, trajectoryEnd: t3 }
}

/**
 * Linearly interpolate a KlattFrame at time `t` between
 * the two surrounding keyframes.
 */

export function interpolateKlattFrame(input: {
  frames: KlattFrame[]
  t: number
}): KlattFrame {
  const { frames, t } = input
  if (t <= frames[0]!.time) return frames[0]!
  for (let i = 1; i < frames.length; i += 1) {
    if (t <= frames[i]!.time) {
      const a = frames[i - 1]!
      const b = frames[i]!
      const span = b.time - a.time
      const u = span > 0 ? (t - a.time) / span : 0
      return mixFrames({ a, b, u })
    }
  }
  return frames[frames.length - 1]!
}

function mixFrames(input: { a: KlattFrame; b: KlattFrame; u: number }): KlattFrame {
  const { a, b, u } = input
  return {
    time: lerp(a.time, b.time, u),
    source: midSource({ source: a.source, target: b.source, t: u }),
    tl: lerp(a.tl, b.tl, u),
    cascade: midFormants({ from: a.cascade, to: b.cascade, t: u }),
    parallel: midParallel({ from: a.parallel, to: b.parallel, t: u }),
    nasalPole: {
      freq: lerp(a.nasalPole.freq, b.nasalPole.freq, u),
      bw: lerp(a.nasalPole.bw, b.nasalPole.bw, u),
    },
    nasalZero: {
      freq: lerp(a.nasalZero.freq, b.nasalZero.freq, u),
      bw: lerp(a.nasalZero.bw, b.nasalZero.bw, u),
    },
  }
}

function midSource(input: { source: SourceMix; target: SourceMix; t: number }): SourceMix {
  const { source, target, t } = input
  return {
    av: lerp(source.av, target.av, t),
    avs: lerp(source.avs, target.avs, t),
    ah: lerp(source.ah, target.ah, t),
    af: lerp(source.af, target.af, t),
    ab: lerp(source.ab, target.ab, t),
    an: lerp(source.an, target.an, t),
  }
}

function midFormants(input: {
  from: FormantSpec[]
  to: FormantSpec[]
  t: number
}): FormantSpec[] {
  const { from, to, t } = input
  const n = Math.max(from.length, to.length)
  const out: FormantSpec[] = []
  for (let i = 0; i < n; i += 1) {
    const a = from[i] ?? { freq: 500, bw: 100 }
    const b = to[i] ?? { freq: 500, bw: 100 }
    out.push({ freq: lerp(a.freq, b.freq, t), bw: lerp(a.bw, b.bw, t) })
  }
  return out
}

function midParallel(input: {
  from: ParallelFormantSpec[]
  to: ParallelFormantSpec[]
  t: number
}): ParallelFormantSpec[] {
  const { from, to, t } = input
  const n = Math.max(from.length, to.length)
  const out: ParallelFormantSpec[] = []
  for (let i = 0; i < n; i += 1) {
    const a = from[i] ?? { freq: 2000, bw: 250, amp: 0 }
    const b = to[i] ?? { freq: 2000, bw: 250, amp: 0 }
    out.push({
      freq: lerp(a.freq, b.freq, t),
      bw: lerp(a.bw, b.bw, t),
      amp: lerp(a.amp, b.amp, t),
    })
  }
  return out
}

function dampParallel(parallel: ParallelFormantSpec[], factor: number): ParallelFormantSpec[] {
  return parallel.map(p => ({ ...p, amp: p.amp * factor }))
}

function lerp(a: number, b: number, u: number): number {
  return a + (b - a) * u
}

export function hasKlattSpec(consonant: string): boolean {
  return consonant in KLATT_CONSONANTS
}
