// SPDX-License-Identifier: GPL-3.0-or-later

import { Glottis } from '@/synth/glottis'

/**
 * Klatt 1980 source generator.
 *
 * Real Klatt has SIX independent source amplitudes that
 * collectively determine the source mix entering the
 * formant filters:
 *
 *   AV  — Amplitude of Voicing into the CASCADE path.
 *         Drives vowels and sonorants. Goes through F1-F5
 *         + nasal pole-zero pair.
 *   AVS — Amplitude of Voicing into the PARALLEL path.
 *         Used for voiced fricatives where periodic source
 *         needs to be mixed with frication noise BEFORE
 *         going through the parallel formant bank.
 *   AH  — Amplitude of Aspiration noise into the CASCADE.
 *         Noise from a partially-open glottis. Drives /h/
 *         and the post-VOT window of voiceless stops.
 *   AF  — Amplitude of Frication noise into the PARALLEL
 *         path. Drives fricatives + the noise part of
 *         affricates and stop bursts.
 *   AB  — Amplitude of Bypass noise — frication noise
 *         routed DIRECTLY to the output, bypassing all
 *         formant filters. Klatt uses this for some
 *         high-frequency noise components.
 *   AN  — Amplitude of the Nasal pole. Activated for
 *         nasals and nasalized vowels.
 *
 * Plus the spectral-tilt parameter TL, a per-sample
 * one-pole lowpass on the voicing source that controls
 * source brightness. Breathy voices have high TL,
 * pressed voices have low TL. After voiceless stop
 * releases, TL rises briefly during the breathy-onset
 * window.
 *
 * Reference: Klatt 1980 §III, Tables I-II.
 */

export type KlattSourceAmplitudes = {
  /** Voicing → cascade. 0-1. */
  av: number
  /** Voicing → parallel. 0-1. */
  avs: number
  /** Aspiration → cascade. 0-1. */
  ah: number
  /** Frication → parallel. 0-1. */
  af: number
  /** Frication → bypass (direct to output). 0-1. */
  ab: number
  /** Nasal pole excitation. 0-1. */
  an: number
}

export type KlattSourceInputs = {
  /** Time in seconds (for the voicing source's vibrato). */
  seconds: number
  /** f0 in Hz. */
  frequency: number
  /** Source amplitudes. */
  amps: KlattSourceAmplitudes
  /** Voice quality (LF Rd). 0 = breathy, 1 = pressed. */
  tenseness: number
  /** Spectral tilt: dB attenuation at 3 kHz relative to DC. 0-30. */
  tl: number
}

export type KlattSourceOutputs = {
  /** Sample to feed into the CASCADE filter path. */
  cascadeInput: number
  /** Sample to feed into the PARALLEL filter path. */
  parallelInput: number
  /** Sample to add directly to output (bypass). */
  bypassOutput: number
  /** Glottal phase in [0, 1] for frication AM by glottal cycle. */
  glottalPhase: number
}

/**
 * Stateful Klatt source. One instance per render pass.
 */

export class KlattSource {
  private readonly glottis: Glottis
  // Spectral-tilt 1-pole lowpass state. Per Klatt 1980 eq.
  // for TL, this is a one-pole IIR whose cutoff varies
  // with the TL parameter.
  private tiltState = 0
  // LCG noise generator for aspiration + frication.
  private lcg = 0xa5a5a5a5
  // Track of glottal cycle phase for the AM modulator.
  private cycleStart = 0

  constructor(public readonly sampleRate: number) {
    this.glottis = new Glottis()
  }

  process(input: KlattSourceInputs): KlattSourceOutputs {
    const { seconds, frequency, amps, tenseness, tl } = input

    // Voicing source (LF model).
    const noiseForGlottis = this.nextNoise()
    const voiced = this.glottis.process({
      seconds,
      frequency,
      intensity: 1,
      loudness: 1,
      tenseness,
      noise: noiseForGlottis,
    })

    // Spectral-tilt lowpass. TL = dB attenuation at 3 kHz.
    // alpha = 1 / (1 + 2π · fc / fs), with fc derived from
    // TL: fc ≈ 3000 · 10^(-TL/20) gives a one-pole whose
    // -3 dB point lands at the frequency that produces the
    // requested attenuation at 3 kHz.
    let voicedTilted = voiced
    if (tl > 0) {
      const fc = Math.max(200, 3000 * Math.pow(10, -tl / 20))
      const alpha = Math.exp((-2 * Math.PI * fc) / this.sampleRate)
      this.tiltState = (1 - alpha) * voiced + alpha * this.tiltState
      voicedTilted = this.tiltState
    } else {
      this.tiltState = voiced
    }

    // Aperiodic source (white noise for aspiration + frication).
    const fricNoise = this.nextNoise()
    const aspNoise = this.nextNoise() * 0.5

    // Glottal phase for frication AM (voiced fricatives).
    // Use the period of the current f0.
    const period = 1 / Math.max(frequency, 1)
    if (seconds - this.cycleStart >= period) {
      this.cycleStart = seconds - ((seconds - this.cycleStart) % period)
    }
    const glottalPhase = ((seconds - this.cycleStart) / period) % 1

    // For voiced fricatives, frication noise is amplitude-
    // modulated by the glottal cycle: stronger during the
    // open phase, quieter during closure.
    const fricationAm = amps.avs > 0
      ? 0.5 + 0.5 * Math.sin(2 * Math.PI * glottalPhase)
      : 1
    const fricationModulated = fricNoise * fricationAm

    // Mix sources per Klatt's routing.
    //
    // Cascade input: AV·voiced + AH·aspiration.
    //   - The voicing source drives the cascade for vowels
    //     + sonorants.
    //   - Aspiration adds turbulent noise during /h/ and
    //     stop-release VOT.
    const cascadeInput = amps.av * voicedTilted + amps.ah * aspNoise

    // Parallel input: AVS·voiced + AF·frication.
    //   - The voicing source can ALSO drive the parallel
    //     bank during voiced fricatives.
    //   - Frication noise drives the parallel bank for all
    //     fricatives.
    const parallelInput =
      amps.avs * voicedTilted + amps.af * fricationModulated

    // Bypass: AB·frication, sent directly to output.
    const bypassOutput = amps.ab * fricationModulated

    return {
      cascadeInput,
      parallelInput,
      bypassOutput,
      glottalPhase,
    }
  }

  reset(): void {
    this.tiltState = 0
    this.cycleStart = 0
  }

  private nextNoise(): number {
    this.lcg = (this.lcg * 1664525 + 1013904223) >>> 0
    return (this.lcg / 0xffffffff - 0.5) * 2
  }
}
