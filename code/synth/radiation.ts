// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Lip radiation impedance — two-stage filter.
 *
 * Stage 1: 1-pole HPF (DC rejection without HF boost).
 *   y[n] = α (y[n-1] + x[n] - x[n-1])
 *   At α = 0.97, cutoff ≈ 115 Hz at 24 kHz.
 *
 * Stage 2: High-shelf BOOST (+6 dB above 1.5 kHz).
 *   Compensates the LF source's natural 12 dB/octave HF
 *   rolloff so F2 and F3 are audible in the output. This
 *   is what gives the vowel its "ring" — without it the
 *   sound is dominated by F1 and the vowels collapse
 *   into mush.
 *
 * Two stages in series give:
 *   - DC: heavily attenuated
 *   - 200 Hz - 1 kHz: near-unity
 *   - 1.5 kHz - 8 kHz: roughly +6 dB
 *   - Above 8 kHz: still roughly +6 dB (no Nyquist boost)
 *
 * This shape is what makes vowels distinguishable. With
 * just the HPF or just the boost, you get a dull or
 * harsh sound respectively.
 */

export class LipRadiation {
  // Stage 1 — 1-pole HPF state.
  private hpfPrevIn = 0
  private hpfPrevOut = 0
  private readonly alpha: number

  // Stage 2 — biquad high-shelf boost state.
  private x1 = 0
  private x2 = 0
  private y1 = 0
  private y2 = 0
  private readonly b0: number
  private readonly b1: number
  private readonly b2: number
  private readonly a1: number
  private readonly a2: number

  constructor(
    config: {
      sampleRate?: number
      hpfAlpha?: number
      boostFreq?: number
      boostDb?: number
    } = {},
  ) {
    const sampleRate = config.sampleRate ?? 24_000
    this.alpha = config.hpfAlpha ?? 0.97

    // RBJ-cookbook high-shelf BOOST coefficients.
    // +12 dB above ~1 kHz mimics the rising radiation
    // impedance and compensates the LF source's HF
    // rolloff so F2 and F3 are audible.
    const A = Math.pow(10, (config.boostDb ?? 12) / 40)
    const omega = (2 * Math.PI * (config.boostFreq ?? 1200)) / sampleRate
    const cos = Math.cos(omega)
    const sin = Math.sin(omega)
    const q = 0.707
    const alpha = sin / (2 * q)
    const sqrtA2alpha = 2 * Math.sqrt(A) * alpha

    const b0n = A * (A + 1 + (A - 1) * cos + sqrtA2alpha)
    const b1n = -2 * A * (A - 1 + (A + 1) * cos)
    const b2n = A * (A + 1 + (A - 1) * cos - sqrtA2alpha)
    const a0n = A + 1 - (A - 1) * cos + sqrtA2alpha
    const a1n = 2 * (A - 1 - (A + 1) * cos)
    const a2n = A + 1 - (A - 1) * cos - sqrtA2alpha

    this.b0 = b0n / a0n
    this.b1 = b1n / a0n
    this.b2 = b2n / a0n
    this.a1 = a1n / a0n
    this.a2 = a2n / a0n
  }

  process(sample: number): number {
    // Stage 1: HPF.
    const hp =
      this.alpha * (this.hpfPrevOut + sample - this.hpfPrevIn)
    this.hpfPrevIn = sample
    this.hpfPrevOut = hp

    // Stage 2: high-shelf boost biquad.
    const y =
      this.b0 * hp +
      this.b1 * this.x1 +
      this.b2 * this.x2 -
      this.a1 * this.y1 -
      this.a2 * this.y2
    this.x2 = this.x1
    this.x1 = hp
    this.y2 = this.y1
    this.y1 = y
    return y
  }

  reset(): void {
    this.hpfPrevIn = 0
    this.hpfPrevOut = 0
    this.x1 = this.x2 = this.y1 = this.y2 = 0
  }
}
