// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Klatt-style 2-zero anti-resonator.
 *
 * The transfer function is:
 *
 *   H(z) = A · (1 - B z^-1 - C z^-2)
 *
 * which puts a complex-conjugate pair of ZEROS at the
 * configured frequency with the configured bandwidth.
 * Zeros suppress a band of frequencies, the dual of a
 * resonator's pole peak.
 *
 * Used for:
 *   - Nasal antiformants (oral-cavity side-branch zeros).
 *   - Fricative spectral dips (front-cavity zeros).
 *   - Lateral channel zeros for /l/.
 *
 * Critical to consonant identity: without zeros, /m n ŋ/
 * spectra are identical, /s/ and /ʃ/ collapse into the
 * same single-peak shape, and /l/ has no characteristic
 * antiformant.
 *
 * Coefficient formulas from Klatt 1980, eqs. (3-4):
 *
 *   C = -exp(-2π · BW / fs)
 *   B = 2 · exp(-π · BW / fs) · cos(2π · F / fs)
 *   A = 1 / (1 - B - C)
 *
 * The gain normalization A keeps unity gain at DC.
 */

export class AntiResonator {
  private a = 0
  private b = 0
  private c = 0
  private x1 = 0
  private x2 = 0
  private readonly sampleRate: number
  private cachedFreq = -1
  private cachedBw = -1

  constructor(sampleRate: number) {
    this.sampleRate = sampleRate
  }

  setFrequencyBandwidth(freqHz: number, bandwidthHz: number): void {
    if (freqHz === this.cachedFreq && bandwidthHz === this.cachedBw) return
    this.cachedFreq = freqHz
    this.cachedBw = bandwidthHz
    this.c = -Math.exp((-2 * Math.PI * bandwidthHz) / this.sampleRate)
    this.b =
      2 *
      Math.exp((-Math.PI * bandwidthHz) / this.sampleRate) *
      Math.cos((2 * Math.PI * freqHz) / this.sampleRate)
    const denom = 1 - this.b - this.c
    this.a = denom !== 0 ? 1 / denom : 1
  }

  process(input: number): number {
    // y[n] = A · (x[n] - B · x[n-1] - C · x[n-2])
    const y = this.a * (input - this.b * this.x1 - this.c * this.x2)
    this.x2 = this.x1
    this.x1 = input
    return y
  }

  reset(): void {
    this.x1 = 0
    this.x2 = 0
  }
}
