// SPDX-License-Identifier: GPL-3.0-or-later

import { Biquad, type BiquadCoeffs } from '@/synth/spectral-shape'

/**
 * Band-pass-filtered white noise source for fricative
 * onsets.
 *
 * Real fricatives produce turbulent noise at the
 * constriction. The spectral character of that noise
 * depends on the constriction site:
 *
 *   /s/  alveolar:    energy peak ~4-7 kHz
 *   /ʃ/  postalveolar: energy peak ~2-4 kHz
 *   /f/  labiodental: broad band, weaker
 *   /θ/  dental:      broad, weaker than /s/
 *   /x/  velar:       peak ~1-2 kHz
 *   /h/  glottal:     broad, low-amplitude
 *   /ħ/  pharyngeal:  peak ~0.5-1.5 kHz
 *
 * This source produces band-pass-filtered white noise
 * centered at a configurable frequency. Each consonant's
 * `renderFrication` pass instantiates one tuned to its
 * place of articulation.
 *
 * Implementation: two biquads in cascade — a high-pass
 * (lower bound) and a low-pass (upper bound). The
 * intersection is the band.
 */

export type NoiseSourceConfig = {
  sampleRate: number
  lowerHz: number
  upperHz: number
  /** Q for both filters. Default 0.7 (gentle slopes). */
  q?: number
  /** Output amplitude scale. Default 1. */
  amplitude?: number
}

export class NoiseSource {
  private lcg = 0xa5a5a5a5
  private readonly hp: Biquad
  private readonly lp: Biquad
  private readonly amplitude: number

  constructor(config: NoiseSourceConfig) {
    const q = config.q ?? 0.7
    this.amplitude = config.amplitude ?? 1
    this.hp = new Biquad(highpassCoeffs(config.sampleRate, config.lowerHz, q))
    this.lp = new Biquad(lowpassCoeffs(config.sampleRate, config.upperHz, q))
  }

  next(): number {
    this.lcg = (this.lcg * 1664525 + 1013904223) >>> 0
    const white = (this.lcg / 0xffffffff - 0.5) * 2
    return this.amplitude * this.lp.process(this.hp.process(white))
  }
}

/**
 * RBJ-cookbook high-pass biquad coefficients.
 */

function highpassCoeffs(
  sampleRate: number,
  cutoffHz: number,
  q: number,
): BiquadCoeffs {
  const omega = (2 * Math.PI * cutoffHz) / sampleRate
  const cos = Math.cos(omega)
  const sin = Math.sin(omega)
  const alpha = sin / (2 * q)

  const b0 = (1 + cos) / 2
  const b1 = -(1 + cos)
  const b2 = (1 + cos) / 2
  const a0 = 1 + alpha
  const a1 = -2 * cos
  const a2 = 1 - alpha

  return {
    b0: b0 / a0,
    b1: b1 / a0,
    b2: b2 / a0,
    a1: a1 / a0,
    a2: a2 / a0,
  }
}

function lowpassCoeffs(
  sampleRate: number,
  cutoffHz: number,
  q: number,
): BiquadCoeffs {
  const omega = (2 * Math.PI * cutoffHz) / sampleRate
  const cos = Math.cos(omega)
  const sin = Math.sin(omega)
  const alpha = sin / (2 * q)

  const b0 = (1 - cos) / 2
  const b1 = 1 - cos
  const b2 = (1 - cos) / 2
  const a0 = 1 + alpha
  const a1 = -2 * cos
  const a2 = 1 - alpha

  return {
    b0: b0 / a0,
    b1: b1 / a0,
    b2: b2 / a0,
    a1: a1 / a0,
    a2: a2 / a0,
  }
}
