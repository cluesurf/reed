// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Subglottal coupling — source-side pole-zero pair filter.
 *
 * Models the spectral effect of the trachea + bronchi
 * cavity coupling back to the supraglottal tract through
 * the partially-leaky glottis. Natural voices show two
 * characteristic antiformants at:
 *
 *   - Sg1 around 600-700 Hz
 *   - Sg2 around 1400-1700 Hz
 *
 * These manifest as 3-6 dB broad spectral notches in the
 * radiated voice. Without them voices sound "thin" — with
 * them they gain depth.
 *
 * Implementation per Klatt 1980's "subglottal pole pair"
 * convention: two cascaded biquads, each with a complex
 * pole pair AND a complex zero pair. The zero sits just
 * BELOW the pole so the combined response is an
 * asymmetric "lift then dip" → audible antiformant.
 *
 * Critical: this filter is applied SOURCE-SIDE only (to
 * the voicing signal before the supraglottal cascade).
 * Earlier reed iterations tried an output-side notch
 * which killed F1 of mid vowels. Putting it on the source
 * lets all the supraglottal formant gain stay intact —
 * the notch just colors the source spectrum the cascade
 * filters operate on.
 *
 * Reference: Klatt 1980 §III; Cranen & Boves 1987;
 * note/library/reed/topics/subglottal-coupling.md.
 */

type Biquad = {
  b0: number
  b1: number
  b2: number
  a1: number
  a2: number
  x1: number
  x2: number
  y1: number
  y2: number
}

function makePoleZeroBiquad(input: {
  sampleRate: number
  poleHz: number
  poleBwHz: number
  zeroHz: number
  zeroBwHz: number
}): Biquad {
  const { sampleRate, poleHz, poleBwHz, zeroHz, zeroBwHz } = input
  const rp = Math.exp((-Math.PI * poleBwHz) / sampleRate)
  const wp = (2 * Math.PI * poleHz) / sampleRate
  const rz = Math.exp((-Math.PI * zeroBwHz) / sampleRate)
  const wz = (2 * Math.PI * zeroHz) / sampleRate
  return {
    // Numerator (zeros).
    b0: 1,
    b1: -2 * rz * Math.cos(wz),
    b2: rz * rz,
    // Denominator (poles); a0=1 by convention.
    a1: -2 * rp * Math.cos(wp),
    a2: rp * rp,
    x1: 0,
    x2: 0,
    y1: 0,
    y2: 0,
  }
}

function processBiquad(b: Biquad, x: number): number {
  const y = b.b0 * x + b.b1 * b.x1 + b.b2 * b.x2 - b.a1 * b.y1 - b.a2 * b.y2
  b.x2 = b.x1
  b.x1 = x
  b.y2 = b.y1
  b.y1 = y
  return y
}

export class SubglottalFilter {
  private readonly pair1: Biquad
  private readonly pair2: Biquad

  constructor(sampleRate: number) {
    // Klatt's recommended values for adult male voices.
    this.pair1 = makePoleZeroBiquad({
      sampleRate,
      poleHz: 700,
      poleBwHz: 130,
      zeroHz: 600,
      zeroBwHz: 130,
    })
    this.pair2 = makePoleZeroBiquad({
      sampleRate,
      poleHz: 1600,
      poleBwHz: 160,
      zeroHz: 1500,
      zeroBwHz: 160,
    })
  }

  process(sample: number): number {
    return processBiquad(this.pair2, processBiquad(this.pair1, sample))
  }

  reset(): void {
    this.pair1.x1 = this.pair1.x2 = this.pair1.y1 = this.pair1.y2 = 0
    this.pair2.x1 = this.pair2.x2 = this.pair2.y1 = this.pair2.y2 = 0
  }
}
