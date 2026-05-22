// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * A tiny 1-D simplex-style noise function for low-rate
 * jitter / vibrato modulation in the glottal source.
 *
 * This is the same role Pink Trombone's SimplexNoise.js
 * plays. We don't need full 2-D simplex noise; just a
 * smooth pseudo-random scalar function of time. We use a
 * stateful sine-mix construction that's deterministic
 * given a seed.
 *
 * Values are roughly in [-1, 1]. Spectrum is dominated by
 * the lowest frequency component, with smaller
 * higher-frequency components — enough to feel "natural"
 * without true noise.
 */

export class Noise1D {
  private readonly offsets: number[]
  private readonly freqs: number[]
  private readonly amps: number[]

  constructor(seed = 1) {
    // Deterministic offsets derived from the seed so two
    // Noise1D instances with the same seed produce
    // identical sequences (useful for tests).
    let s = seed
    const next = () => {
      // Simple LCG; sufficient for offset randomization.
      s = (s * 1103515245 + 12345) & 0x7fffffff
      return s / 0x7fffffff
    }
    this.offsets = [next() * 1000, next() * 1000, next() * 1000]
    // Three sine components with golden-ratio-spaced
    // frequencies so the sum doesn't loop visibly.
    this.freqs = [1.0, 0.618, 0.382]
    this.amps = [0.6, 0.3, 0.1]
  }

  at(t: number): number {
    return (
      this.amps[0]! * Math.sin(2 * Math.PI * this.freqs[0]! * (t + this.offsets[0]!)) +
      this.amps[1]! * Math.sin(2 * Math.PI * this.freqs[1]! * (t + this.offsets[1]!)) +
      this.amps[2]! * Math.sin(2 * Math.PI * this.freqs[2]! * (t + this.offsets[2]!))
    )
  }
}
