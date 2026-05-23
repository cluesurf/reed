// SPDX-License-Identifier: GPL-3.0-or-later

import { Noise1D } from '@/synth/noise'

/**
 * Liljencrants-Fant glottal source — TS port of Pink
 * Trombone's `Glottis.js`.
 *
 * Each cycle produces a damped-sinusoid open phase up to
 * the closure instant `Te`, then an exponential-decay
 * return phase. Coefficients are derived from a single
 * shape parameter `Rd` per the Fant-Lin-Liljencrants
 * R-parameterization.
 *
 * `tenseness` in [0, 1] maps onto Rd via
 * `Rd = clamp(3 * (1 - tenseness), 0.5, 2.7)`.
 *
 * Additional features:
 *   - Vibrato (sinusoidal + low-frequency noise) on the
 *     fundamental frequency.
 *   - Aspiration noise gated by an open-phase amplitude
 *     window.
 *
 * Per-sample API: caller drives the source by invoking
 * `process(seconds, frequency, intensity, loudness,
 * tenseness, noiseSample)` at the audio rate.
 */

export type GlottisConfig = {
  vibratoRateHz?: number
  vibratoDepth?: number
  vibratoWobble?: number
  /**
   * Per-cycle period perturbation RMS. Each new glottal
   * cycle's period is multiplied by (1 + u) where u is
   * uniform[-jitterRms, +jitterRms]. Natural modal voice:
   * 0.005 (0.5%). Robotic: 0. Rough/pathological: 0.02+.
   */
  jitterRms?: number
  /**
   * Per-cycle amplitude perturbation RMS. Each new cycle's
   * voicing output is multiplied by (1 + u) where u is
   * uniform[-shimmerRms, +shimmerRms]. Natural modal
   * voice: 0.03 (3%). Robotic: 0.
   */
  shimmerRms?: number
}

export type GlottisInputs = {
  /** Absolute time in seconds. */
  seconds: number
  /** Baseline fundamental frequency in Hz. */
  frequency: number
  /** Master amplitude scaling, [0, 1]. */
  intensity: number
  /** Voicing loudness, [0, 1]. */
  loudness: number
  /** Voice-quality knob, [0, 1] (0 = breathy, 1 = pressed). */
  tenseness: number
  /** Caller-supplied noise sample, [-1, 1]. */
  noise: number
}

/**
 * LF cycle coefficients. Recomputed once per period.
 * Identical to the algebraic forms in Pink Trombone.
 */

type Coefficients = {
  alpha: number
  Delta: number
  E0: number
  epsilon: number
  omega: number
  shift: number
  Te: number
}

export class Glottis {
  private coefficients: Coefficients = {
    alpha: 0,
    Delta: 0,
    E0: 0,
    epsilon: 0,
    omega: 0,
    shift: 0,
    Te: 0,
  }
  private startSeconds = 0
  private readonly noise: Noise1D
  private readonly vibratoRateHz: number
  private readonly vibratoDepth: number
  private readonly vibratoWobble: number
  private readonly jitterRms: number
  private readonly shimmerRms: number

  // Sampled fresh once per glottal cycle. Stay constant
  // across the in-between samples so the cycle's period +
  // amplitude are well-defined.
  private currentJitter = 0
  private currentShimmer = 0

  // Seeded LCG for deterministic per-cycle jitter +
  // shimmer (so tests aren't flaky). Reset by reset().
  private jitterLcg = 0x9e3779b1

  /**
   * Set once the first cycle is fired so we don't divide by
   * zero on the very first `process` call.
   */
  private initialized = false

  constructor(config: GlottisConfig = {}) {
    this.noise = new Noise1D(1)
    // Defaults tuned for steady, naturally-textured vowels.
    // Pink Trombone's stronger settings work well in
    // interactive play but sound like "wandering pitch"
    // when sustained offline. Disabled by default; users
    // can opt in via config.
    this.vibratoRateHz = config.vibratoRateHz ?? 5.5
    this.vibratoDepth = config.vibratoDepth ?? 0.003
    this.vibratoWobble = config.vibratoWobble ?? 0
    // Natural modal-voice values per Klatt & Klatt 1990.
    // See note/library/reed/topics/jitter-and-shimmer.md.
    this.jitterRms = config.jitterRms ?? 0.005
    this.shimmerRms = config.shimmerRms ?? 0.03
  }

  process(input: GlottisInputs): number {
    const { seconds, frequency, intensity, loudness, tenseness, noise } = input

    // Vibrato + optional wobble on f0.
    //
    // Pink Trombone's defaults are tuned for interactive
    // dragging where the user keeps changing the pitch by
    // hand; in steady offline rendering the cumulative
    // modulation reads as the speaker's pitch wandering
    // up and down. Constants here are scaled down
    // substantially. Total f0 swing capped at ~1% with
    // wobble off, ~3% with wobble fully on.
    let vibrato =
      this.vibratoDepth *
      Math.sin(2 * Math.PI * seconds * this.vibratoRateHz)
    vibrato += 0.003 * this.noise.at(seconds * 4.07)
    vibrato += 0.005 * this.noise.at(seconds * 2.15)
    if (this.vibratoWobble > 0) {
      let wobble = 0
      wobble += 0.02 * this.noise.at(seconds * 0.98)
      wobble += 0.04 * this.noise.at(seconds * 0.5)
      vibrato += wobble * this.vibratoWobble
    }

    const f0 = frequency * (1 + vibrato)
    // Apply per-cycle jitter: lengthens or shortens THIS
    // cycle's period by ±jitterRms × 100%. Resampled at
    // each new cycle (below).
    const period = (1 / Math.max(f0, 1)) * (1 + this.currentJitter)

    // Tenseness modulation: small additive noise to keep
    // the timbre alive cycle-to-cycle.
    let modulatedTenseness = tenseness
    modulatedTenseness += 0.1 * this.noise.at(seconds * 0.46)
    modulatedTenseness += 0.05 * this.noise.at(seconds * 0.36)
    modulatedTenseness += (3 - modulatedTenseness) * (1 - intensity)

    // Cycle bookkeeping. Each period we recompute the LF
    // coefficients from the (modulated) tenseness AND
    // draw fresh jitter + shimmer samples for the next
    // cycle. Klatt & Klatt 1990: independent draws
    // cycle-to-cycle, NOT correlated drift.
    const secondsOffset = seconds - this.startSeconds
    let interpolation = secondsOffset / period
    if (!this.initialized || interpolation >= 1) {
      this.startSeconds = seconds + (secondsOffset % period)
      interpolation = (seconds - this.startSeconds) / period
      this.updateCoefficients(modulatedTenseness)
      this.currentJitter = this.uniformRandom() * this.jitterRms
      this.currentShimmer = this.uniformRandom() * this.shimmerRms
      this.initialized = true
    }
    if (interpolation < 0) interpolation = 0

    // Open-phase aerodynamic noise modulator: amplifies
    // turbulence when the glottis is open.
    const noiseModulator =
      this.openPhaseNoiseModulator(interpolation) +
      (1 - Math.max(modulatedTenseness, 0) * intensity) * 3

    let aspiration = noise * noiseModulator
    aspiration *= intensity
    aspiration *= intensity
    aspiration *= 1 - Math.sqrt(Math.max(modulatedTenseness, 0))
    aspiration *= 0.02 * this.noise.at(seconds * 1.99) + 0.2

    // Shimmer multiplies the periodic voicing component
    // only; aspiration noise is already aperiodic and
    // doesn't benefit from cycle-to-cycle amplitude scaling.
    const voice =
      this.normalizedWaveform(interpolation) *
      intensity *
      loudness *
      (1 + this.currentShimmer)
    return (voice + aspiration) * intensity
  }

  private updateCoefficients(tenseness: number): void {
    const R = {
      d: clamp(3 * (1 - tenseness), 0.5, 2.7),
      a: 0,
      k: 0,
      g: 0,
    }
    R.a = -0.01 + 0.048 * R.d
    R.k = 0.224 + 0.118 * R.d
    R.g = (R.k / 4) * (0.5 + 1.2 * R.k) / (0.11 * R.d - R.a * (0.5 + 1.2 * R.k))

    const T = {
      a: R.a,
      p: 1 / (2 * R.g),
      e: 0,
    }
    T.e = T.p + T.p * R.k

    const epsilon = 1 / T.a
    const shift = Math.exp(-epsilon * (1 - T.e))
    const Delta = 1 - shift

    const rhs =
      ((1 / epsilon) * (shift - 1) + (1 - T.e) * shift) / Delta
    const lowerTotal = -(T.e - T.p) / 2 + rhs
    const upperTotal = -lowerTotal

    const omega = Math.PI / T.p
    const s = Math.sin(omega * T.e)
    const y = (-Math.PI * s * upperTotal) / (T.p * 2)
    const z = Math.log(Math.max(y, 1e-9))
    const alpha = z / (T.p / 2 - T.e)
    const E0 = -1 / (s * Math.exp(alpha * T.e))

    this.coefficients = {
      alpha,
      Delta,
      E0,
      epsilon,
      omega,
      shift,
      Te: T.e,
    }
  }

  private normalizedWaveform(t: number): number {
    const { alpha, Delta, E0, epsilon, omega, shift, Te } = this.coefficients
    if (t > Te) {
      return (-Math.exp(-epsilon * (t - Te)) + shift) / Delta
    }
    return E0 * Math.exp(alpha * t) * Math.sin(omega * t)
  }

  /**
   * Seeded uniform sample in [-1, +1]. Used for jitter +
   * shimmer so identical renders produce identical audio.
   */
  private uniformRandom(): number {
    this.jitterLcg = (this.jitterLcg * 1664525 + 1013904223) >>> 0
    return (this.jitterLcg / 0xffffffff) * 2 - 1
  }

  private openPhaseNoiseModulator(t: number): number {
    const angle = 2 * Math.PI * t
    const amplitude = Math.sin(angle)
    const positive = Math.max(0, amplitude)
    const gain = 0.2
    const offset = 0.1
    return positive * gain + offset
  }
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(Math.max(value, lo), hi)
}
