// SPDX-License-Identifier: GPL-3.0-or-later

import type { VowelKey } from '@/synth/vowel-shapes'

/**
 * Per-CV formant trajectory tables.
 *
 * Source values draw from Klatt 1980 ("Software for a
 * cascade/parallel formant synthesizer"), Stevens 1998
 * ("Acoustic Phonetics"), and Peterson & Barney 1952
 * formant tables. Adult-male reference; all values in Hz.
 *
 * The trajectory has up to four phases per CV:
 *
 *   - hold:       closure (stops) or steady frication
 *                 (fricatives) or murmur (nasals).
 *   - release:    the brief transition from consonant to
 *                 vowel — this is where most place
 *                 information lives.
 *   - transition: the first ~30-50 ms of the vowel,
 *                 during which formants finish moving
 *                 from consonant locus to vowel target.
 *   - steady:    the rest of the vowel.
 *
 * Each phase has F1, F2, F3 values + bandwidths, voicing
 * amplitude, and noise amplitude. The synthesizer
 * linearly interpolates between adjacent keyframes.
 */

export type FormantFrame = {
  /** Time in seconds from the start of the CV. */
  time: number
  /** Voicing source amplitude in [0, 1]. */
  voiced: number
  /** Frication noise amplitude in [0, 1]. */
  noise: number
  /** Frication noise spectral peak (Hz), for fricatives. */
  noisePeakHz?: number
  /** Frication noise bandwidth around the peak (Hz). */
  noiseBandwidthHz?: number
  /** Formant frequencies in Hz. */
  f1: number
  f2: number
  f3: number
  f4: number
  /** Formant bandwidths in Hz. */
  bw1: number
  bw2: number
  bw3: number
  bw4: number
}

/**
 * Canonical adult-male vowel steady-state targets.
 * Peterson & Barney 1952 values.
 */

const VOWEL_TARGETS: Record<
  VowelKey,
  { f1: number; f2: number; f3: number; f4: number }
> = {
  i:     { f1: 270, f2: 2290, f3: 3010, f4: 3700 },
  e:     { f1: 530, f2: 1840, f3: 2480, f4: 3500 },
  a:     { f1: 730, f2: 1090, f3: 2440, f4: 3400 },
  o:     { f1: 570, f2: 840,  f3: 2410, f4: 3400 },
  u:     { f1: 300, f2: 870,  f3: 2240, f4: 3300 },
  schwa: { f1: 500, f2: 1500, f3: 2500, f4: 3500 },
}

const VOWEL_BWS = { bw1: 60, bw2: 90, bw3: 150, bw4: 200 }

/**
 * Each consonant's formant LOCUS — where F1/F2/F3 "start"
 * just before the release. The vowel formants are then
 * targets that F1/F2/F3 glide TOWARD over the transition
 * window.
 *
 * Locus values are place-specific and roughly vowel-
 * independent. Bandwidths are wider during the closure /
 * transition than during steady vowels.
 *
 * Stops have F1 locus ~200 Hz (very low, because the
 * tract is closed → no first-formant resonance).
 */

type ConsonantSpec = {
  // Locus formants just before release.
  f1Locus: number
  f2Locus: number
  f3Locus: number
  // Bandwidths during the closure / transition.
  bwLocus: number
  // Source mix during the consonant body.
  voicedDuringHold: number
  noiseDuringHold: number
  noiseDuringRelease: number
  // Noise spectral peak — defines the fricative quality.
  noisePeakHz: number
  noiseBandwidthHz: number
  // Timing.
  holdDuration: number
  releaseDuration: number
  transitionDuration: number
  // Whether the formant bank should be drived in cascade
  // (voicing path) or parallel (noise path) for this
  // segment. Affricates and voiced fricatives drive both.
  source: 'voiced' | 'voiceless' | 'mixed'
}

const CONSONANT_SPECS: Record<string, ConsonantSpec> = {
  // ----- PLOSIVES -----
  // Voiceless stops: long-VOT English style. Strong burst
  // at release, aspiration through transition.
  p: {
    f1Locus: 200, f2Locus: 800, f3Locus: 2000,
    bwLocus: 200,
    voicedDuringHold: 0,
    noiseDuringHold: 0,
    noiseDuringRelease: 0.7,
    noisePeakHz: 700, noiseBandwidthHz: 1500,
    holdDuration: 0.08, releaseDuration: 0.06, transitionDuration: 0.05,
    source: 'voiceless',
  },
  t: {
    f1Locus: 200, f2Locus: 1800, f3Locus: 2700,
    bwLocus: 200,
    voicedDuringHold: 0,
    noiseDuringHold: 0,
    noiseDuringRelease: 0.75,
    noisePeakHz: 4000, noiseBandwidthHz: 2500,
    holdDuration: 0.08, releaseDuration: 0.06, transitionDuration: 0.05,
    source: 'voiceless',
  },
  k: {
    f1Locus: 200, f2Locus: 2000, f3Locus: 2500,
    bwLocus: 250,
    voicedDuringHold: 0,
    noiseDuringHold: 0,
    noiseDuringRelease: 0.7,
    noisePeakHz: 2500, noiseBandwidthHz: 1800,
    holdDuration: 0.08, releaseDuration: 0.06, transitionDuration: 0.05,
    source: 'voiceless',
  },
  K: {
    // /q/ — uvular. Lower F2/F3 than /k/.
    f1Locus: 200, f2Locus: 1300, f3Locus: 2200,
    bwLocus: 250,
    voicedDuringHold: 0,
    noiseDuringHold: 0,
    noiseDuringRelease: 0.65,
    noisePeakHz: 1500, noiseBandwidthHz: 1500,
    holdDuration: 0.08, releaseDuration: 0.07, transitionDuration: 0.05,
    source: 'voiceless',
  },
  // Voiced stops: voice bar during closure, short VOT.
  b: {
    f1Locus: 200, f2Locus: 800, f3Locus: 2000,
    bwLocus: 150,
    voicedDuringHold: 0.4,
    noiseDuringHold: 0,
    noiseDuringRelease: 0.3,
    noisePeakHz: 700, noiseBandwidthHz: 1500,
    holdDuration: 0.07, releaseDuration: 0.03, transitionDuration: 0.05,
    source: 'voiced',
  },
  d: {
    f1Locus: 200, f2Locus: 1800, f3Locus: 2700,
    bwLocus: 150,
    voicedDuringHold: 0.4,
    noiseDuringHold: 0,
    noiseDuringRelease: 0.35,
    noisePeakHz: 4000, noiseBandwidthHz: 2500,
    holdDuration: 0.07, releaseDuration: 0.03, transitionDuration: 0.05,
    source: 'voiced',
  },
  g: {
    f1Locus: 200, f2Locus: 2000, f3Locus: 2500,
    bwLocus: 150,
    voicedDuringHold: 0.4,
    noiseDuringHold: 0,
    noiseDuringRelease: 0.35,
    noisePeakHz: 2500, noiseBandwidthHz: 1800,
    holdDuration: 0.07, releaseDuration: 0.03, transitionDuration: 0.05,
    source: 'voiced',
  },
  c: {
    // Palatal stop.
    f1Locus: 200, f2Locus: 2200, f3Locus: 2800,
    bwLocus: 200,
    voicedDuringHold: 0,
    noiseDuringHold: 0,
    noiseDuringRelease: 0.7,
    noisePeakHz: 3500, noiseBandwidthHz: 2000,
    holdDuration: 0.08, releaseDuration: 0.06, transitionDuration: 0.05,
    source: 'voiceless',
  },
  J: {
    // Voiced palatal stop.
    f1Locus: 200, f2Locus: 2200, f3Locus: 2800,
    bwLocus: 150,
    voicedDuringHold: 0.4,
    noiseDuringHold: 0,
    noiseDuringRelease: 0.3,
    noisePeakHz: 3500, noiseBandwidthHz: 2000,
    holdDuration: 0.07, releaseDuration: 0.03, transitionDuration: 0.05,
    source: 'voiced',
  },
  "'": {
    // Glottal stop.
    f1Locus: 200, f2Locus: 1500, f3Locus: 2500,
    bwLocus: 300,
    voicedDuringHold: 0,
    noiseDuringHold: 0,
    noiseDuringRelease: 0.5,
    noisePeakHz: 800, noiseBandwidthHz: 2500,
    holdDuration: 0.08, releaseDuration: 0.02, transitionDuration: 0.04,
    source: 'voiceless',
  },
  // ----- NASALS -----
  // Nasal murmur: F1 around 250 Hz (long nasal cavity),
  // weak higher formants, place gives different F2 transition.
  m: {
    f1Locus: 250, f2Locus: 800, f3Locus: 2200,
    bwLocus: 100,
    voicedDuringHold: 0.6,
    noiseDuringHold: 0,
    noiseDuringRelease: 0,
    noisePeakHz: 0, noiseBandwidthHz: 0,
    holdDuration: 0.10, releaseDuration: 0.04, transitionDuration: 0.05,
    source: 'voiced',
  },
  n: {
    f1Locus: 250, f2Locus: 1700, f3Locus: 2700,
    bwLocus: 100,
    voicedDuringHold: 0.6,
    noiseDuringHold: 0,
    noiseDuringRelease: 0,
    noisePeakHz: 0, noiseBandwidthHz: 0,
    holdDuration: 0.10, releaseDuration: 0.04, transitionDuration: 0.05,
    source: 'voiced',
  },
  q: {
    // /ŋ/ velar nasal.
    f1Locus: 250, f2Locus: 2100, f3Locus: 2500,
    bwLocus: 100,
    voicedDuringHold: 0.6,
    noiseDuringHold: 0,
    noiseDuringRelease: 0,
    noisePeakHz: 0, noiseBandwidthHz: 0,
    holdDuration: 0.10, releaseDuration: 0.04, transitionDuration: 0.05,
    source: 'voiced',
  },
  N: {
    // /ɲ/ palatal nasal.
    f1Locus: 250, f2Locus: 2300, f3Locus: 2800,
    bwLocus: 100,
    voicedDuringHold: 0.6,
    noiseDuringHold: 0,
    noiseDuringRelease: 0,
    noisePeakHz: 0, noiseBandwidthHz: 0,
    holdDuration: 0.10, releaseDuration: 0.04, transitionDuration: 0.05,
    source: 'voiced',
  },
  M: {
    // /ɱ/ labiodental nasal — close to /m/.
    f1Locus: 250, f2Locus: 900, f3Locus: 2300,
    bwLocus: 100,
    voicedDuringHold: 0.6,
    noiseDuringHold: 0,
    noiseDuringRelease: 0,
    noisePeakHz: 0, noiseBandwidthHz: 0,
    holdDuration: 0.10, releaseDuration: 0.04, transitionDuration: 0.05,
    source: 'voiced',
  },
  // ----- FRICATIVES -----
  // Sibilants: strong noise; non-sibilants quieter.
  s: {
    f1Locus: 400, f2Locus: 1500, f3Locus: 2700,
    bwLocus: 200,
    voicedDuringHold: 0,
    noiseDuringHold: 0.9,
    noiseDuringRelease: 0.8,
    noisePeakHz: 5500, noiseBandwidthHz: 1500,
    holdDuration: 0.14, releaseDuration: 0.05, transitionDuration: 0.04,
    source: 'voiceless',
  },
  z: {
    f1Locus: 400, f2Locus: 1500, f3Locus: 2700,
    bwLocus: 150,
    voicedDuringHold: 0.4,
    noiseDuringHold: 0.6,
    noiseDuringRelease: 0.5,
    noisePeakHz: 5500, noiseBandwidthHz: 1500,
    holdDuration: 0.12, releaseDuration: 0.04, transitionDuration: 0.04,
    source: 'mixed',
  },
  sh: {
    f1Locus: 400, f2Locus: 1700, f3Locus: 2500,
    bwLocus: 200,
    voicedDuringHold: 0,
    noiseDuringHold: 0.85,
    noiseDuringRelease: 0.75,
    noisePeakHz: 3000, noiseBandwidthHz: 1500,
    holdDuration: 0.14, releaseDuration: 0.05, transitionDuration: 0.04,
    source: 'voiceless',
  },
  zh: {
    f1Locus: 400, f2Locus: 1700, f3Locus: 2500,
    bwLocus: 150,
    voicedDuringHold: 0.4,
    noiseDuringHold: 0.55,
    noiseDuringRelease: 0.45,
    noisePeakHz: 3000, noiseBandwidthHz: 1500,
    holdDuration: 0.12, releaseDuration: 0.04, transitionDuration: 0.04,
    source: 'mixed',
  },
  f: {
    f1Locus: 400, f2Locus: 1200, f3Locus: 2500,
    bwLocus: 250,
    voicedDuringHold: 0,
    noiseDuringHold: 0.5,
    noiseDuringRelease: 0.45,
    noisePeakHz: 3500, noiseBandwidthHz: 3000,
    holdDuration: 0.14, releaseDuration: 0.05, transitionDuration: 0.04,
    source: 'voiceless',
  },
  v: {
    f1Locus: 400, f2Locus: 1200, f3Locus: 2500,
    bwLocus: 150,
    voicedDuringHold: 0.5,
    noiseDuringHold: 0.3,
    noiseDuringRelease: 0.25,
    noisePeakHz: 3500, noiseBandwidthHz: 3000,
    holdDuration: 0.12, releaseDuration: 0.04, transitionDuration: 0.04,
    source: 'mixed',
  },
  T: {
    // /θ/ dental.
    f1Locus: 400, f2Locus: 1500, f3Locus: 2700,
    bwLocus: 250,
    voicedDuringHold: 0,
    noiseDuringHold: 0.5,
    noiseDuringRelease: 0.45,
    noisePeakHz: 5500, noiseBandwidthHz: 2500,
    holdDuration: 0.14, releaseDuration: 0.05, transitionDuration: 0.04,
    source: 'voiceless',
  },
  D: {
    // /ð/ dental voiced.
    f1Locus: 400, f2Locus: 1500, f3Locus: 2700,
    bwLocus: 150,
    voicedDuringHold: 0.5,
    noiseDuringHold: 0.3,
    noiseDuringRelease: 0.25,
    noisePeakHz: 5500, noiseBandwidthHz: 2500,
    holdDuration: 0.12, releaseDuration: 0.04, transitionDuration: 0.04,
    source: 'mixed',
  },
  x: {
    // /x/ velar fricative.
    f1Locus: 500, f2Locus: 1900, f3Locus: 2500,
    bwLocus: 250,
    voicedDuringHold: 0,
    noiseDuringHold: 0.6,
    noiseDuringRelease: 0.55,
    noisePeakHz: 1500, noiseBandwidthHz: 1500,
    holdDuration: 0.14, releaseDuration: 0.05, transitionDuration: 0.04,
    source: 'voiceless',
  },
  G: {
    // /ɣ/ velar voiced fricative.
    f1Locus: 500, f2Locus: 1900, f3Locus: 2500,
    bwLocus: 150,
    voicedDuringHold: 0.5,
    noiseDuringHold: 0.35,
    noiseDuringRelease: 0.3,
    noisePeakHz: 1500, noiseBandwidthHz: 1500,
    holdDuration: 0.12, releaseDuration: 0.04, transitionDuration: 0.04,
    source: 'mixed',
  },
  X: {
    // /χ/ uvular fricative.
    f1Locus: 600, f2Locus: 1500, f3Locus: 2200,
    bwLocus: 250,
    voicedDuringHold: 0,
    noiseDuringHold: 0.6,
    noiseDuringRelease: 0.55,
    noisePeakHz: 1200, noiseBandwidthHz: 1200,
    holdDuration: 0.14, releaseDuration: 0.05, transitionDuration: 0.04,
    source: 'voiceless',
  },
  H: {
    // /ħ/ pharyngeal.
    f1Locus: 700, f2Locus: 1200, f3Locus: 2200,
    bwLocus: 250,
    voicedDuringHold: 0,
    noiseDuringHold: 0.45,
    noiseDuringRelease: 0.4,
    noisePeakHz: 900, noiseBandwidthHz: 1500,
    holdDuration: 0.14, releaseDuration: 0.05, transitionDuration: 0.04,
    source: 'voiceless',
  },
  Q: {
    // /ʕ/ voiced pharyngeal.
    f1Locus: 700, f2Locus: 1200, f3Locus: 2200,
    bwLocus: 150,
    voicedDuringHold: 0.7,
    noiseDuringHold: 0.15,
    noiseDuringRelease: 0.15,
    noisePeakHz: 900, noiseBandwidthHz: 1500,
    holdDuration: 0.12, releaseDuration: 0.04, transitionDuration: 0.04,
    source: 'mixed',
  },
  C: {
    // /ç/ palatal voiceless.
    f1Locus: 300, f2Locus: 2200, f3Locus: 2800,
    bwLocus: 200,
    voicedDuringHold: 0,
    noiseDuringHold: 0.5,
    noiseDuringRelease: 0.45,
    noisePeakHz: 4000, noiseBandwidthHz: 2000,
    holdDuration: 0.14, releaseDuration: 0.05, transitionDuration: 0.04,
    source: 'voiceless',
  },
  Z: {
    // /ʝ/ palatal voiced.
    f1Locus: 300, f2Locus: 2200, f3Locus: 2800,
    bwLocus: 150,
    voicedDuringHold: 0.5,
    noiseDuringHold: 0.3,
    noiseDuringRelease: 0.25,
    noisePeakHz: 4000, noiseBandwidthHz: 2000,
    holdDuration: 0.12, releaseDuration: 0.04, transitionDuration: 0.04,
    source: 'mixed',
  },
  F: {
    // /ɸ/ bilabial.
    f1Locus: 400, f2Locus: 1200, f3Locus: 2500,
    bwLocus: 250,
    voicedDuringHold: 0,
    noiseDuringHold: 0.4,
    noiseDuringRelease: 0.35,
    noisePeakHz: 1500, noiseBandwidthHz: 2500,
    holdDuration: 0.14, releaseDuration: 0.05, transitionDuration: 0.04,
    source: 'voiceless',
  },
  B: {
    // /β/ bilabial voiced.
    f1Locus: 400, f2Locus: 1200, f3Locus: 2500,
    bwLocus: 150,
    voicedDuringHold: 0.5,
    noiseDuringHold: 0.25,
    noiseDuringRelease: 0.2,
    noisePeakHz: 1500, noiseBandwidthHz: 2500,
    holdDuration: 0.12, releaseDuration: 0.04, transitionDuration: 0.04,
    source: 'mixed',
  },
  h: {
    // /h/ — glottal "fricative", essentially aspiration.
    f1Locus: 500, f2Locus: 1500, f3Locus: 2500,
    bwLocus: 300,
    voicedDuringHold: 0,
    noiseDuringHold: 0.3,
    noiseDuringRelease: 0.25,
    noisePeakHz: 1500, noiseBandwidthHz: 3000,
    holdDuration: 0.12, releaseDuration: 0.06, transitionDuration: 0.05,
    source: 'voiceless',
  },
  // ----- AFFRICATES -----
  // Stop closure + sustained frication.
  ch: {
    f1Locus: 300, f2Locus: 1700, f3Locus: 2500,
    bwLocus: 200,
    voicedDuringHold: 0,
    noiseDuringHold: 0.0,
    noiseDuringRelease: 0.85,
    noisePeakHz: 3000, noiseBandwidthHz: 1500,
    holdDuration: 0.06, releaseDuration: 0.10, transitionDuration: 0.04,
    source: 'voiceless',
  },
  j: {
    // /dʒ/.
    f1Locus: 300, f2Locus: 1700, f3Locus: 2500,
    bwLocus: 150,
    voicedDuringHold: 0.4,
    noiseDuringHold: 0,
    noiseDuringRelease: 0.55,
    noisePeakHz: 3000, noiseBandwidthHz: 1500,
    holdDuration: 0.05, releaseDuration: 0.08, transitionDuration: 0.04,
    source: 'mixed',
  },
  tx: {
    // /ts/.
    f1Locus: 300, f2Locus: 1700, f3Locus: 2700,
    bwLocus: 200,
    voicedDuringHold: 0,
    noiseDuringHold: 0,
    noiseDuringRelease: 0.85,
    noisePeakHz: 5000, noiseBandwidthHz: 1500,
    holdDuration: 0.05, releaseDuration: 0.10, transitionDuration: 0.04,
    source: 'voiceless',
  },
  dj: {
    // /dz/.
    f1Locus: 300, f2Locus: 1700, f3Locus: 2700,
    bwLocus: 150,
    voicedDuringHold: 0.4,
    noiseDuringHold: 0,
    noiseDuringRelease: 0.55,
    noisePeakHz: 5000, noiseBandwidthHz: 1500,
    holdDuration: 0.05, releaseDuration: 0.08, transitionDuration: 0.04,
    source: 'mixed',
  },
  // ----- APPROXIMANTS -----
  // /j/ — high palatal: very high F2.
  y: {
    f1Locus: 240, f2Locus: 2300, f3Locus: 3000,
    bwLocus: 90,
    voicedDuringHold: 0.8,
    noiseDuringHold: 0,
    noiseDuringRelease: 0,
    noisePeakHz: 0, noiseBandwidthHz: 0,
    holdDuration: 0.07, releaseDuration: 0.04, transitionDuration: 0.04,
    source: 'voiced',
  },
  // /w/ — labial-velar: very low F2.
  w: {
    f1Locus: 290, f2Locus: 610, f3Locus: 2150,
    bwLocus: 90,
    voicedDuringHold: 0.8,
    noiseDuringHold: 0,
    noiseDuringRelease: 0,
    noisePeakHz: 0, noiseBandwidthHz: 0,
    holdDuration: 0.07, releaseDuration: 0.04, transitionDuration: 0.04,
    source: 'voiced',
  },
  V: {
    // /ʋ/ — labiodental approximant.
    f1Locus: 350, f2Locus: 1200, f3Locus: 2200,
    bwLocus: 90,
    voicedDuringHold: 0.8,
    noiseDuringHold: 0,
    noiseDuringRelease: 0,
    noisePeakHz: 0, noiseBandwidthHz: 0,
    holdDuration: 0.07, releaseDuration: 0.04, transitionDuration: 0.04,
    source: 'voiced',
  },
  // ----- LATERALS -----
  l: {
    // /l/ — alveolar lateral. Mid F2.
    f1Locus: 360, f2Locus: 1300, f3Locus: 2700,
    bwLocus: 90,
    voicedDuringHold: 0.8,
    noiseDuringHold: 0,
    noiseDuringRelease: 0,
    noisePeakHz: 0, noiseBandwidthHz: 0,
    holdDuration: 0.08, releaseDuration: 0.04, transitionDuration: 0.04,
    source: 'voiced',
  },
  L: {
    // /ʎ/ palatal lateral. Higher F2.
    f1Locus: 300, f2Locus: 2000, f3Locus: 2700,
    bwLocus: 90,
    voicedDuringHold: 0.8,
    noiseDuringHold: 0,
    noiseDuringRelease: 0,
    noisePeakHz: 0, noiseBandwidthHz: 0,
    holdDuration: 0.08, releaseDuration: 0.04, transitionDuration: 0.04,
    source: 'voiced',
  },
  // ----- TRILLS -----
  r: {
    // /r/ — alveolar trill. We modulate amplitude at ~28 Hz.
    f1Locus: 350, f2Locus: 1300, f3Locus: 2500,
    bwLocus: 120,
    voicedDuringHold: 0.6,
    noiseDuringHold: 0,
    noiseDuringRelease: 0,
    noisePeakHz: 0, noiseBandwidthHz: 0,
    holdDuration: 0.14, releaseDuration: 0.04, transitionDuration: 0.04,
    source: 'voiced',
  },
  R: {
    // /ʀ/ uvular trill. Lower F2.
    f1Locus: 400, f2Locus: 900, f3Locus: 2200,
    bwLocus: 120,
    voicedDuringHold: 0.6,
    noiseDuringHold: 0,
    noiseDuringRelease: 0,
    noisePeakHz: 0, noiseBandwidthHz: 0,
    holdDuration: 0.14, releaseDuration: 0.04, transitionDuration: 0.04,
    source: 'voiced',
  },
}

/**
 * Build a four-keyframe trajectory for a CV pair.
 * Time-0 keyframe is the closure / hold state; subsequent
 * keyframes interpolate to the vowel's steady state.
 */

export function buildTrajectory(input: {
  consonant: string
  vowel: VowelKey
}): { spec: ConsonantSpec; frames: FormantFrame[] } {
  const { consonant, vowel } = input
  const spec = CONSONANT_SPECS[consonant]
  if (!spec) {
    throw new Error(`No formant trajectory defined for consonant '${consonant}'`)
  }
  const vowelTarget = VOWEL_TARGETS[vowel] ?? VOWEL_TARGETS.a

  const t0 = 0
  const t1 = spec.holdDuration
  const t2 = t1 + spec.releaseDuration
  const t3 = t2 + spec.transitionDuration

  // F4 is roughly constant across the CV.
  const f4 = vowelTarget.f4

  const frames: FormantFrame[] = [
    {
      time: t0,
      voiced: spec.voicedDuringHold,
      noise: spec.noiseDuringHold,
      noisePeakHz: spec.noisePeakHz,
      noiseBandwidthHz: spec.noiseBandwidthHz,
      f1: spec.f1Locus,
      f2: spec.f2Locus,
      f3: spec.f3Locus,
      f4,
      bw1: spec.bwLocus,
      bw2: spec.bwLocus,
      bw3: spec.bwLocus + 50,
      bw4: VOWEL_BWS.bw4,
    },
    {
      time: t1,
      voiced: spec.voicedDuringHold,
      noise: spec.noiseDuringRelease,
      noisePeakHz: spec.noisePeakHz,
      noiseBandwidthHz: spec.noiseBandwidthHz,
      f1: spec.f1Locus,
      f2: spec.f2Locus,
      f3: spec.f3Locus,
      f4,
      bw1: spec.bwLocus,
      bw2: spec.bwLocus,
      bw3: spec.bwLocus + 50,
      bw4: VOWEL_BWS.bw4,
    },
    {
      time: t2,
      voiced: 1.0,
      noise: 0,
      noisePeakHz: spec.noisePeakHz,
      noiseBandwidthHz: spec.noiseBandwidthHz,
      f1: (spec.f1Locus + vowelTarget.f1) * 0.5,
      f2: (spec.f2Locus + vowelTarget.f2) * 0.5,
      f3: (spec.f3Locus + vowelTarget.f3) * 0.5,
      f4,
      bw1: (spec.bwLocus + VOWEL_BWS.bw1) * 0.5,
      bw2: (spec.bwLocus + VOWEL_BWS.bw2) * 0.5,
      bw3: VOWEL_BWS.bw3,
      bw4: VOWEL_BWS.bw4,
    },
    {
      time: t3,
      voiced: 1.0,
      noise: 0,
      noisePeakHz: spec.noisePeakHz,
      noiseBandwidthHz: spec.noiseBandwidthHz,
      f1: vowelTarget.f1,
      f2: vowelTarget.f2,
      f3: vowelTarget.f3,
      f4,
      bw1: VOWEL_BWS.bw1,
      bw2: VOWEL_BWS.bw2,
      bw3: VOWEL_BWS.bw3,
      bw4: VOWEL_BWS.bw4,
    },
  ]

  return { spec, frames }
}

/**
 * Linearly interpolate a frame at time `t` between two
 * adjacent keyframes.
 */

export function interpolateFrame(input: {
  frames: FormantFrame[]
  t: number
}): FormantFrame {
  const { frames, t } = input
  if (t <= frames[0]!.time) return frames[0]!
  for (let i = 1; i < frames.length; i += 1) {
    if (t <= frames[i]!.time) {
      const a = frames[i - 1]!
      const b = frames[i]!
      const span = b.time - a.time
      const u = span > 0 ? (t - a.time) / span : 0
      return {
        time: t,
        voiced: lerp(a.voiced, b.voiced, u),
        noise: lerp(a.noise, b.noise, u),
        noisePeakHz: a.noisePeakHz,
        noiseBandwidthHz: a.noiseBandwidthHz,
        f1: lerp(a.f1, b.f1, u),
        f2: lerp(a.f2, b.f2, u),
        f3: lerp(a.f3, b.f3, u),
        f4: lerp(a.f4, b.f4, u),
        bw1: lerp(a.bw1, b.bw1, u),
        bw2: lerp(a.bw2, b.bw2, u),
        bw3: lerp(a.bw3, b.bw3, u),
        bw4: lerp(a.bw4, b.bw4, u),
      }
    }
  }
  // Past the last keyframe — hold the last frame.
  return frames[frames.length - 1]!
}

function lerp(a: number, b: number, u: number): number {
  return a + (b - a) * u
}

export function hasTrajectory(consonant: string): boolean {
  return consonant in CONSONANT_SPECS
}
