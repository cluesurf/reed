// SPDX-License-Identifier: GPL-3.0-or-later

import {
  STORY_DIAMETERS,
  resampleDiameters,
} from '@/synth/data/vowel-area-functions'

/**
 * Vocal-tract diameter shaping for the cardinal vowels.
 *
 * Direct port of Pink Trombone's `_updateDiameterRest`
 * algorithm, with vowel-specific (tongueIndex,
 * tongueDiameter, lipDiameter) presets from the Pink
 * Trombone community.
 *
 * Pipeline:
 *   1. Build piecewise rest profile (0.6 / 1.1 / 1.5 cm).
 *   2. Apply tongue curve over segments [bladeStart,
 *      lipStart-1] using Pink Trombone's exact cosine-on-
 *      grid formula. UNCONDITIONAL assign — the curve can
 *      both narrow and widen relative to the 1.5 cm rest.
 *   3. Pinch lip segments to `lipDiameter` for rounded
 *      vowels.
 *
 * Two bugs in the previous build that this fixes:
 *   - Wrong loop range — `[bladeStart-2, lipStart-1]`
 *     overran into the pharynx (segments 8-9 in length=44),
 *     widening it inappropriately.
 *   - Conditional `if (value < d[i])` was preventing the
 *     tongue curve from WIDENING segments where the cosine
 *     goes negative (the far-from-tongueIndex side). This
 *     suppressed the wider oral cavity that /a/, /e/, /o/
 *     need.
 *
 * Reference: zakaton/Pink-Trombone Tract.js
 * `_updateDiameterRest`.
 */

export type VowelKey = 'a' | 'e' | 'i' | 'o' | 'u' | 'schwa'

export type VowelShape = {
  tongueIndex: number      // float, segment position of tongue center
  tongueDiameter: number   // [2.05, 3.5]; lower = higher tongue
  lipDiameter: number      // cm, aperture of the last 4 segments
}

/**
 * Pink Trombone vowel presets at length=44.
 *
 * `tongueIndex` ∈ [bladeStart+2, tipStart-3] = [12, 29].
 * `tongueDiameter` ∈ [2.05, 3.5]. Lower means higher tongue
 * → narrower oral constriction → lower F1.
 *
 * Lip rounding is done via the trailing `lipDiameter`
 * pinch on segments 39-43. Front vowels keep lipDiameter
 * = 1.5 (no pinch); back rounded vowels narrow it.
 */

export const VOWEL_PRESETS: Record<VowelKey, VowelShape> = {
  // /a/: low back. High F1, low F2.
  a: { tongueIndex: 13.0, tongueDiameter: 3.43, lipDiameter: 1.5 },
  // /e/: mid-high front. Mid F1, high F2.
  e: { tongueIndex: 27.0, tongueDiameter: 2.6, lipDiameter: 1.5 },
  // /i/: high front. Low F1, very high F2.
  i: { tongueIndex: 29.0, tongueDiameter: 2.05, lipDiameter: 1.5 },
  // /o/: mid back, rounded. Mid F1, low F2.
  o: { tongueIndex: 17.0, tongueDiameter: 2.9, lipDiameter: 0.85 },
  // /u/: high back, strongly rounded. Low F1, low F2.
  u: { tongueIndex: 22.0, tongueDiameter: 2.05, lipDiameter: 0.5 },
  // schwa: neutral.
  schwa: { tongueIndex: 12.9, tongueDiameter: 2.43, lipDiameter: 1.5 },
}

export function vowelDiameters(vowel: VowelKey, segments = 44): number[] {
  return buildDiameters({ ...VOWEL_PRESETS[vowel], segments })
}

/**
 * Story 1996 measured area functions converted to
 * diameters. Per-vowel anatomically-grounded shapes —
 * narrow pharynx for /a/, narrow palatal constriction
 * for /i/, narrow velar + lips for /u/. See note/library/
 * reed/topics/vocal-tract-area-functions.md.
 */

export function storyDiameters(vowel: VowelKey, segments = 44): number[] {
  return resampleDiameters(STORY_DIAMETERS[vowel]!, segments)
}

export function buildDiameters(input: VowelShape & { segments: number }): number[] {
  const { tongueIndex, lipDiameter, segments: N } = input
  // Clamp tongueDiameter to Pink Trombone's accepted range.
  const tongueDiameter = clamp(input.tongueDiameter, 2.05, 3.5)
  const d: number[] = new Array(N)

  const bladeStart = Math.floor((10 / 44) * N)
  const tipStart = Math.floor((32 / 44) * N)
  const lipStart = Math.floor((39 / 44) * N)
  const gridOffset = 1.7

  // 1. Base rest profile (narrow pharynx → wide oral cavity).
  for (let i = 0; i < N; i += 1) {
    let value: number
    if (i < (7 / 44) * N - 0.5) value = 0.6
    else if (i < (12 / 44) * N) value = 1.1
    else value = 1.5
    d[i] = value
  }

  // 2. Tongue curve. Pink Trombone's EXACT loop range +
  // EXACT unconditional assignment. The curve can be
  // positive (narrow) at the tongueIndex side or negative
  // (widen) at the opposite side — both directions matter
  // for distinguishing vowels.
  const tongueSpan = tipStart - bladeStart
  const tongueGain = 2 + (tongueDiameter - 2) / 1.5
  for (let i = bladeStart; i < lipStart; i += 1) {
    const interpolation = (tongueIndex - i) / tongueSpan
    const angle = 1.1 * Math.PI * interpolation
    let curve = (1.5 - tongueGain + gridOffset) * Math.cos(angle)
    if (i === bladeStart - 2 || i === lipStart - 1) curve *= 0.8
    if (i === bladeStart + 0 || i === lipStart - 2) curve *= 0.94
    d[i] = 1.5 - curve
  }

  // 3. Lip aperture pinch for rounded vowels.
  for (let i = lipStart; i < N; i += 1) {
    if (d[i]! > lipDiameter) d[i] = lipDiameter
  }

  return d
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(Math.max(value, lo), hi)
}
