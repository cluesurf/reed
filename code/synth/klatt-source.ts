// SPDX-License-Identifier: GPL-3.0-or-later

import { Glottis } from '@/synth/glottis'
import { SubglottalFilter } from '@/synth/subglottal'

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
  /**
   * Turbulence noise class. 'obstacle' = peaked spectrum
   * around 5-7 kHz for sibilants + alveolar/velar stop
   * bursts. 'channel' = broadband flat for non-sibilants +
   * bilabial bursts + aspiration. See note/library/reed/
   * topics/turbulence-noise-generation.md. Defaults to
   * 'channel'.
   */
  noiseType?: 'obstacle' | 'channel'
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
  private readonly subglottal: SubglottalFilter
  // Spectral-tilt 1-pole lowpass state. Per Klatt 1980 eq.
  // for TL, this is a one-pole IIR whose cutoff varies
  // with the TL parameter.
  private tiltState = 0
  // LCG noise generator for aspiration + frication.
  private lcg = 0xa5a5a5a5
  // Track of glottal cycle phase for the AM modulator.
  private cycleStart = 0
  // ===== Channel noise filter (non-sibilants /f v θ ð h/
  // and aspiration). 1-pole LP, mild HF rolloff above
  // 1500 Hz so noise has natural -6 dB/octave high band
  // but still significant mid energy.
  private channelLpState = 0
  private readonly channelLpAlpha: number

  // ===== Obstacle noise filter (sibilants /s ʃ z ʒ/ and
  // alveolar/velar stop bursts). Biquad bandpass peaked
  // around 6 kHz to mimic the teeth-surface noise
  // concentration. RBJ cookbook BPF coefficients.
  private obstacleX1 = 0
  private obstacleX2 = 0
  private obstacleY1 = 0
  private obstacleY2 = 0
  private readonly obstacleB0: number
  private readonly obstacleB1: number
  private readonly obstacleB2: number
  private readonly obstacleA1: number
  private readonly obstacleA2: number

  constructor(public readonly sampleRate: number) {
    this.glottis = new Glottis()
    this.subglottal = new SubglottalFilter(sampleRate)
    // Channel-noise filter: 1-pole LP at 1000 Hz. Matches
    // the previous always-on noise color so non-sibilant
    // baselines are unchanged.
    const channelCutoff = 1000
    this.channelLpAlpha = Math.exp((-2 * Math.PI * channelCutoff) / sampleRate)
    // Obstacle-noise filter: biquad BPF peaked at 6 kHz,
    // Q=1.5. RBJ cookbook constant-skirt BPF
    // (b0 = sin(ω)/2, b1 = 0, b2 = -sin(ω)/2, ...).
    const obstacleFreq = 6000
    const obstacleQ = 1.5
    const omega = (2 * Math.PI * obstacleFreq) / sampleRate
    const sin = Math.sin(omega)
    const cos = Math.cos(omega)
    const alpha = sin / (2 * obstacleQ)
    const a0 = 1 + alpha
    this.obstacleB0 = (sin / 2) / a0
    this.obstacleB1 = 0
    this.obstacleB2 = (-sin / 2) / a0
    this.obstacleA1 = (-2 * cos) / a0
    this.obstacleA2 = (1 - alpha) / a0
  }

  process(input: KlattSourceInputs): KlattSourceOutputs {
    const { seconds, frequency, amps, tenseness, tl } = input
    const noiseType = input.noiseType ?? 'channel'

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

    // Subglottal coupling: notches the source spectrum at
    // ~600 Hz + ~1500 Hz so the natural-voice antiformants
    // appear in radiated output. Source-side only — putting
    // this on the output side would damage F1 of mid vowels.
    // See note/library/reed/topics/subglottal-coupling.md.
    voicedTilted = this.subglottal.process(voicedTilted)

    // Aperiodic source — class-aware turbulence noise.
    // Sibilants (/s ʃ z ʒ tʃ dʒ/ + alveolar/velar stop
    // bursts) use a bandpass-peaked source ("obstacle"
    // noise, energy concentrated 5-7 kHz from teeth-
    // surface effects). Everything else (non-sibilants
    // + bilabial bursts + aspiration) uses a 1-pole LP
    // ("channel" noise, broadband). Aspiration always
    // uses channel-style coloring because its noise is
    // generated at the glottis and shaped by the
    // supraglottal cascade.
    const whiteNoise = this.nextNoise()
    // Channel path: 1-pole LP.
    this.channelLpState =
      (1 - this.channelLpAlpha) * whiteNoise +
      this.channelLpAlpha * this.channelLpState
    const channelColored =
      0.7 * this.channelLpState * 3.0 + 0.3 * whiteNoise
    // Obstacle path: biquad BPF.
    const obstacleFiltered =
      this.obstacleB0 * whiteNoise +
      this.obstacleB1 * this.obstacleX1 +
      this.obstacleB2 * this.obstacleX2 -
      this.obstacleA1 * this.obstacleY1 -
      this.obstacleA2 * this.obstacleY2
    this.obstacleX2 = this.obstacleX1
    this.obstacleX1 = whiteNoise
    this.obstacleY2 = this.obstacleY1
    this.obstacleY1 = obstacleFiltered
    // BPF output is significantly quieter than LP output
    // because most of the signal is rejected. Boost so
    // sibilants are loud (real sibilants are 10-15 dB
    // louder than non-sibilants per Stevens 1998 §11).
    const obstacleColored = obstacleFiltered * 6.0
    // Pick the frication-noise spectrum class.
    const fricNoise =
      noiseType === 'obstacle' ? obstacleColored : channelColored
    // Aspiration is always channel-style (cascade-shaped).
    const aspNoise = channelColored * 0.5

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
    this.channelLpState = 0
    this.obstacleX1 = 0
    this.obstacleX2 = 0
    this.obstacleY1 = 0
    this.obstacleY2 = 0
  }

  private nextNoise(): number {
    this.lcg = (this.lcg * 1664525 + 1013904223) >>> 0
    return (this.lcg / 0xffffffff - 0.5) * 2
  }
}
