// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Lip radiation impedance — Klatt 1980 textbook form.
 *
 *   H(z) = 1 - r · z^-1
 *
 * A single zero on the positive real axis near z = 1.
 * One subtraction per sample. Produces:
 *
 *   - DC and very-low frequencies: |H| ≈ 0 (correctly
 *     blocks DC and sub-bass that don't radiate from a
 *     small aperture)
 *   - Mid-band (200 Hz - 4 kHz): smooth +6 dB / octave
 *     rise — matches real radiation impedance shape
 *   - Above ~4 kHz: gain saturates around +6 dB
 *
 * This REPLACES the earlier two-stage HPF + high-shelf
 * boost filter, which over-boosted the high band by ~6
 * dB and caused the metallic / shimmering character of
 * synthesized vowels. Per `note/library/reed/topics/
 * lip-radiation.md` and `vowel-warmth-plan.md`.
 *
 * `r` controls the position of the zero:
 *
 *   r = 0.95  — default; standard Klatt setting,
 *               max gain ~+6 dB at Nyquist.
 *   r = 0.97  — slightly less HF emphasis.
 *   r = 0.92  — Klatt's published value, almost identical
 *               audibly.
 *
 * Reference: Klatt 1980 §III; Flanagan 1972 §3.5.
 */

export class LipRadiation {
  private prev = 0
  private readonly r: number

  constructor(
    config: {
      sampleRate?: number
      r?: number
    } = {},
  ) {
    this.r = config.r ?? 0.95
  }

  process(sample: number): number {
    const out = sample - this.r * this.prev
    this.prev = sample
    return out
  }

  reset(): void {
    this.prev = 0
  }
}
