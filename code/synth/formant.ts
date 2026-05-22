// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Klatt-style 2-pole formant resonator.
 *
 * The transfer function is:
 *
 *   H(z) = A / (1 - B z^-1 - C z^-2)
 *
 * where the coefficients are derived from a center
 * frequency F and a bandwidth BW (in Hz):
 *
 *   C = -exp(-2π · BW / fs)
 *   B = 2 · exp(-π · BW / fs) · cos(2π · F / fs)
 *   A = 1 - B - C
 *
 * The resulting filter has a spectral peak at F with
 * half-power bandwidth BW. Klatt 1980 calls this a
 * "resonator". Cascading 5 of them in series produces a
 * full vocal-tract transfer function.
 *
 * State: two samples of delayed output. Updating
 * frequency or bandwidth recomputes the coefficients —
 * the state itself doesn't need to be reset, which is
 * what makes formant TRAJECTORIES (smoothly varying F
 * and BW over time) sound natural.
 */

export class FormantResonator {
  private a = 0
  private b = 0
  private c = 0
  private y1 = 0
  private y2 = 0
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
    this.a = 1 - this.b - this.c
  }

  process(input: number): number {
    const y = this.a * input + this.b * this.y1 + this.c * this.y2
    this.y2 = this.y1
    this.y1 = y
    return y
  }

  reset(): void {
    this.y1 = 0
    this.y2 = 0
  }
}

/**
 * Cascade of N formant resonators. Used for voiced
 * speech (vowels + voiced consonants). The cascade
 * produces a transfer function that's the product of
 * each resonator — the natural shape of a vocal-tract
 * transfer function.
 */

export class CascadeFormantBank {
  private readonly resonators: FormantResonator[]

  constructor(sampleRate: number, count = 5) {
    this.resonators = []
    for (let i = 0; i < count; i += 1) {
      this.resonators.push(new FormantResonator(sampleRate))
    }
  }

  setFormants(input: { freq: number; bandwidth: number }[]): void {
    for (let i = 0; i < this.resonators.length; i += 1) {
      const f = input[i]
      if (f) this.resonators[i]!.setFrequencyBandwidth(f.freq, f.bandwidth)
    }
  }

  process(sample: number): number {
    let s = sample
    for (let i = 0; i < this.resonators.length; i += 1) {
      s = this.resonators[i]!.process(s)
    }
    return s
  }

  reset(): void {
    for (const r of this.resonators) r.reset()
  }
}

/**
 * Parallel formant bank — each resonator processes the
 * source independently, with its own amplitude, and the
 * outputs are summed. Used for fricative noise where
 * different formants contribute different amounts to the
 * radiated spectrum.
 */

export class ParallelFormantBank {
  private readonly resonators: FormantResonator[]
  private readonly amplitudes: number[]

  constructor(sampleRate: number, count = 5) {
    this.resonators = []
    this.amplitudes = []
    for (let i = 0; i < count; i += 1) {
      this.resonators.push(new FormantResonator(sampleRate))
      this.amplitudes.push(0)
    }
  }

  setFormants(
    input: { freq: number; bandwidth: number; amplitude: number }[],
  ): void {
    for (let i = 0; i < this.resonators.length; i += 1) {
      const f = input[i]
      if (f) {
        this.resonators[i]!.setFrequencyBandwidth(f.freq, f.bandwidth)
        this.amplitudes[i] = f.amplitude
      }
    }
  }

  process(sample: number): number {
    let sum = 0
    for (let i = 0; i < this.resonators.length; i += 1) {
      sum += this.amplitudes[i]! * this.resonators[i]!.process(sample)
    }
    return sum
  }

  reset(): void {
    for (const r of this.resonators) r.reset()
  }
}
