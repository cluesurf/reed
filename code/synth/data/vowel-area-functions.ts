// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Vocal-tract diameter arrays per vowel, 44 sections from
 * glottis (index 0) to lips (index 43). Adult-male tract,
 * total length ~17.5 cm, section length ~3.97 mm.
 *
 * Shapes reconstructed from Story, Titze & Hoffman 1996
 * "Vocal tract area functions from magnetic resonance
 * imaging" (JASA 100:537-554) Table 1, converted from
 * cm² area to cm diameter via d = 2·√(A/π).
 *
 * IMPORTANT: The values committed here are approximated
 * from cited secondary-source reproductions of Story 1996
 * (Stevens 1998 Ch. 6 figures; Story's web-published
 * Matlab demos) — they preserve the QUALITATIVE shape
 * (narrow-pharynx /ɑ/, narrow-palatal /i/, narrow-velar
 * /u/, etc.) and have quantitatively-plausible magnitudes
 * (~0.2 to ~3.5 cm) matching adult-male anatomy. Use
 * `storyDiameters()` to get them; the calibration step
 * (compare synthesized F1/F2 against Story 1996 Table 2)
 * is left as a future tightening pass that can swap in
 * exact JASA Table 1 values.
 *
 * Vowel mapping:
 *   /a/    → Story's /ɑ/ (low back unrounded)
 *   /e/    → Story's /ɛ/ (mid-high front)
 *   /i/    → Story's /i/ (high front)
 *   /o/    → Story's /o/ (mid back rounded)
 *   /u/    → Story's /u/ (high back rounded)
 *   schwa  → Story's /ʌ/ (neutral central)
 */

import type { VowelKey } from '@/synth/vowel-shapes'

// Each entry is exactly 44 floats, diameters in cm,
// glottis-first → lips-last.
export const STORY_DIAMETERS: Record<VowelKey, number[]> = {
  // /ɑ/ — narrow pharyngeal cavity (tongue body back + low
  // → constriction in lower pharynx). Wide oral cavity.
  // F1 high, F2 low.
  a: [
    0.76, 0.50, 0.56, 0.52, 0.62, 0.62, 0.65, 1.16, 1.20, 1.04,
    0.90, 0.71, 0.58, 0.60, 0.54, 0.64, 0.61, 0.60, 0.71, 0.92,
    1.24, 1.16, 1.44, 1.63, 1.81, 1.88, 1.91, 1.96, 2.18, 2.42,
    2.55, 2.77, 2.89, 2.83, 2.83, 2.75, 2.59, 2.45, 2.22, 2.30,
    2.33, 2.33, 2.45, 2.53,
  ],
  // /ɛ/ — mid-front. Slight palatal constriction, wider
  // pharynx than /ɑ/. F1 mid, F2 mid-high.
  e: [
    0.82, 0.86, 0.94, 0.98, 1.04, 1.10, 1.18, 1.26, 1.36, 1.46,
    1.54, 1.60, 1.66, 1.70, 1.72, 1.72, 1.68, 1.62, 1.52, 1.40,
    1.26, 1.10, 0.94, 0.82, 0.76, 0.72, 0.74, 0.80, 0.92, 1.06,
    1.22, 1.40, 1.58, 1.74, 1.86, 1.94, 1.96, 1.92, 1.84, 1.74,
    1.62, 1.50, 1.40, 1.32,
  ],
  // /i/ — high front. Wide back cavity, very narrow front
  // (palatal) constriction. F1 very low, F2 very high.
  i: [
    0.96, 1.20, 1.40, 1.58, 1.74, 1.86, 1.96, 2.04, 2.10, 2.14,
    2.16, 2.16, 2.14, 2.10, 2.04, 1.96, 1.86, 1.74, 1.58, 1.40,
    1.18, 0.96, 0.74, 0.56, 0.42, 0.32, 0.28, 0.30, 0.36, 0.46,
    0.60, 0.78, 0.98, 1.20, 1.42, 1.62, 1.80, 1.94, 2.04, 2.10,
    2.12, 2.10, 2.04, 1.94,
  ],
  // /o/ — mid back rounded. Pharyngeal slight wide-narrow
  // variation, lip aperture narrowed. F1 mid, F2 low.
  o: [
    0.82, 0.90, 1.00, 1.08, 1.16, 1.24, 1.32, 1.40, 1.48, 1.56,
    1.64, 1.70, 1.76, 1.80, 1.82, 1.82, 1.78, 1.70, 1.58, 1.42,
    1.22, 1.00, 0.82, 0.70, 0.62, 0.58, 0.60, 0.66, 0.78, 0.92,
    1.10, 1.30, 1.50, 1.68, 1.82, 1.90, 1.92, 1.86, 1.74, 1.56,
    1.34, 1.10, 0.88, 0.70,
  ],
  // /u/ — high back rounded. Narrow velar (near segment
  // ~20) AND narrow lip (last ~5 segments). F1 low, F2 low.
  u: [
    0.84, 1.00, 1.18, 1.34, 1.48, 1.60, 1.70, 1.76, 1.80, 1.82,
    1.80, 1.74, 1.66, 1.54, 1.40, 1.22, 1.04, 0.86, 0.68, 0.54,
    0.44, 0.40, 0.42, 0.50, 0.62, 0.78, 0.96, 1.16, 1.36, 1.54,
    1.68, 1.78, 1.82, 1.80, 1.72, 1.60, 1.42, 1.22, 1.00, 0.80,
    0.62, 0.50, 0.44, 0.42,
  ],
  // /ʌ/ (schwa) — neutral central. Near-uniform tube with
  // slight pharyngeal narrowing.
  schwa: [
    0.78, 0.86, 0.96, 1.06, 1.14, 1.22, 1.28, 1.34, 1.40, 1.44,
    1.48, 1.50, 1.52, 1.52, 1.52, 1.50, 1.48, 1.46, 1.44, 1.42,
    1.42, 1.42, 1.44, 1.46, 1.50, 1.52, 1.54, 1.56, 1.58, 1.58,
    1.58, 1.56, 1.54, 1.52, 1.50, 1.48, 1.46, 1.44, 1.42, 1.42,
    1.42, 1.44, 1.46, 1.48,
  ],
}

/**
 * Linearly resample a diameter array to a different length.
 * Used when the K-L tract is configured with non-44 segments.
 */

export function resampleDiameters(diameters: number[], segments: number): number[] {
  if (segments === diameters.length) return [...diameters]
  const out = new Array<number>(segments)
  const last = diameters.length - 1
  for (let i = 0; i < segments; i += 1) {
    const u = (i / (segments - 1)) * last
    const lo = Math.floor(u)
    const hi = Math.min(lo + 1, last)
    const t = u - lo
    out[i] = diameters[lo]! * (1 - t) + diameters[hi]! * t
  }
  return out
}
