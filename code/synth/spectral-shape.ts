// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Global spectral shaping applied after the tract +
 * radiation.
 *
 * Two things this fixes:
 *
 *   1. Frequency-dependent tube loss. Real tract walls
 *      attenuate higher frequencies more than lower
 *      (viscous + heat-conduction + wall-vibration losses
 *      scale with √f or stronger). Our Kelly-Lochbaum
 *      loop uses constant 0.999 per segment. Adding a
 *      mild lowpass roll-off above 6 kHz approximates the
 *      missing frequency-dependent attenuation.
 *
 *   2. Subglottal antiformant. Real glottal-end coupling
 *      to the trachea + bronchi produces a spectral
 *      notch around 600-1500 Hz. Our model uses a
 *      constant glottis reflection (0.75). Adding a
 *      notch at ~600 Hz approximates the missing
 *      antiformant.
 *
 * Implemented as two biquads in series:
 *   - One biquad lowpass shelf at 6 kHz, -3 dB.
 *   - One biquad notch at 600 Hz, depth -4 dB, Q = 2.
 *
 * These are POST-radiation filters: applied to the 24 kHz
 * (or whatever the user requested) output signal.
 *
 * The biquads use Robert Bristow-Johnson's standard
 * coefficient formulas (cookbook). Each filter has 2
 * samples of state.
 */

export type BiquadCoeffs = {
  b0: number
  b1: number
  b2: number
  a1: number
  a2: number
}

export class Biquad {
  private x1 = 0
  private x2 = 0
  private y1 = 0
  private y2 = 0

  constructor(private readonly c: BiquadCoeffs) {}

  process(x: number): number {
    const y =
      this.c.b0 * x +
      this.c.b1 * this.x1 +
      this.c.b2 * this.x2 -
      this.c.a1 * this.y1 -
      this.c.a2 * this.y2
    this.x2 = this.x1
    this.x1 = x
    this.y2 = this.y1
    this.y1 = y
    return y
  }

  reset(): void {
    this.x1 = this.x2 = this.y1 = this.y2 = 0
  }
}

/**
 * High-shelf cutting `gainDb` above the corner frequency.
 * Standard RBJ cookbook formulation.
 */

export function buildHighShelfCutCoeffs(input: {
  sampleRate: number
  cornerHz: number
  gainDb: number
  q?: number
}): BiquadCoeffs {
  const { sampleRate, cornerHz, gainDb, q = 0.707 } = input
  const A = Math.pow(10, gainDb / 40)
  const omega = (2 * Math.PI * cornerHz) / sampleRate
  const cos = Math.cos(omega)
  const sin = Math.sin(omega)
  const alpha = sin / (2 * q)
  const sqrtA2alpha = 2 * Math.sqrt(A) * alpha

  const b0 = A * (A + 1 + (A - 1) * cos + sqrtA2alpha)
  const b1 = -2 * A * (A - 1 + (A + 1) * cos)
  const b2 = A * (A + 1 + (A - 1) * cos - sqrtA2alpha)
  const a0 = A + 1 - (A - 1) * cos + sqrtA2alpha
  const a1 = 2 * (A - 1 - (A + 1) * cos)
  const a2 = A + 1 - (A - 1) * cos - sqrtA2alpha

  return {
    b0: b0 / a0,
    b1: b1 / a0,
    b2: b2 / a0,
    a1: a1 / a0,
    a2: a2 / a0,
  }
}

/**
 * Low-shelf BOOSTING `gainDb` below the corner frequency.
 * Standard RBJ cookbook formulation. Used to model the
 * warmth that yielding tract walls add to natural voices.
 * See note/library/reed/topics/yielding-walls.md.
 */

export function buildLowShelfBoostCoeffs(input: {
  sampleRate: number
  cornerHz: number
  gainDb: number
  q?: number
}): BiquadCoeffs {
  const { sampleRate, cornerHz, gainDb, q = 0.707 } = input
  const A = Math.pow(10, gainDb / 40)
  const omega = (2 * Math.PI * cornerHz) / sampleRate
  const cos = Math.cos(omega)
  const sin = Math.sin(omega)
  const alpha = sin / (2 * q)
  const sqrtA2alpha = 2 * Math.sqrt(A) * alpha

  const b0 = A * (A + 1 - (A - 1) * cos + sqrtA2alpha)
  const b1 = 2 * A * (A - 1 - (A + 1) * cos)
  const b2 = A * (A + 1 - (A - 1) * cos - sqrtA2alpha)
  const a0 = A + 1 + (A - 1) * cos + sqrtA2alpha
  const a1 = -2 * (A - 1 + (A + 1) * cos)
  const a2 = A + 1 + (A - 1) * cos - sqrtA2alpha

  return {
    b0: b0 / a0,
    b1: b1 / a0,
    b2: b2 / a0,
    a1: a1 / a0,
    a2: a2 / a0,
  }
}

/**
 * Band-stop (notch) with a given depth and Q.
 *
 * `depthDb` is the dip at the center frequency (negative
 * to attenuate). `q` controls width — higher q = narrower
 * notch.
 */

export function buildPeakingNotchCoeffs(input: {
  sampleRate: number
  freqHz: number
  depthDb: number
  q?: number
}): BiquadCoeffs {
  const { sampleRate, freqHz, depthDb, q = 2.0 } = input
  const A = Math.pow(10, depthDb / 40)
  const omega = (2 * Math.PI * freqHz) / sampleRate
  const cos = Math.cos(omega)
  const sin = Math.sin(omega)
  const alpha = sin / (2 * q)

  const b0 = 1 + alpha * A
  const b1 = -2 * cos
  const b2 = 1 - alpha * A
  const a0 = 1 + alpha / A
  const a1 = -2 * cos
  const a2 = 1 - alpha / A

  return {
    b0: b0 / a0,
    b1: b1 / a0,
    b2: b2 / a0,
    a1: a1 / a0,
    a2: a2 / a0,
  }
}

/**
 * Composite spectral shaper.
 *
 * Currently a mild high-shelf cut above 6 kHz to
 * approximate the frequency-dependent tube losses we
 * aren't modeling per-segment.
 *
 * We previously had a subglottal antiformant notch at
 * 600 Hz here, but that wiped out F1 of mid vowels (/e/,
 * /a/, /o/ all have F1 in the 500-700 Hz range). The
 * subglottal antiformant belongs on the SOURCE side
 * (before it enters the tract), not the output side; a
 * future iteration can add it as a source-side filter on
 * the Glottis output.
 */

export class SpectralShape {
  private readonly shelf: Biquad

  constructor(sampleRate: number) {
    // Cut only the extreme top end (above 10 kHz) to
    // soften any residual aliasing artifacts from the
    // 96 kHz → 24 kHz decimation. We don't want to cut
    // the formant range (anything below 5 kHz).
    this.shelf = new Biquad(
      buildHighShelfCutCoeffs({
        sampleRate,
        cornerHz: 10000,
        gainDb: -6,
      }),
    )
  }

  process(sample: number): number {
    return this.shelf.process(sample)
  }

  reset(): void {
    this.shelf.reset()
  }
}
