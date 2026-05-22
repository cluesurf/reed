// SPDX-License-Identifier: GPL-3.0-or-later

import { Glottis } from '@/synth/glottis'
import { CascadeFormantBank, FormantResonator } from '@/synth/formant'
import {
  buildTrajectory,
  interpolateFrame,
  hasTrajectory,
} from '@/synth/formant-trajectories'
import type { VowelKey } from '@/synth/vowel-shapes'

/**
 * Klatt-style formant synthesizer for CV syllables.
 *
 * Replaces the articulatory tract-based renderer with a
 * source-and-formant-filter pipeline. The key difference:
 * formant frequencies and bandwidths are SPECIFIED
 * directly from acoustic phonetics tables (see
 * `formant-trajectories.ts`) rather than derived from
 * physical tract simulation. This is the proven approach
 * (Klatt 1980, DECtalk, KlattTalk).
 *
 * Per-sample pipeline:
 *
 *   1. Look up the interpolated formant frame for time t
 *      (F1/F2/F3/F4 + bandwidths + voicing/noise gains).
 *   2. Run the voicing source (LF glottal pulses) at the
 *      requested voiced amplitude.
 *   3. Generate white noise scaled by the noise amplitude,
 *      filtered to the consonant's frication peak.
 *   4. Sum voicing + noise into the cascade formant bank.
 *   5. Apply the cascade with the current formant
 *      frequencies/bandwidths.
 *   6. Output. Lip radiation applied post-loop.
 */

export type SynthesizeFormantCvInput = {
  consonant: string
  vowel?: VowelKey
  /** Total duration in seconds. Default 0.65. */
  duration?: number
  sampleRate?: number
  /** f0 in Hz. Default 130. */
  frequency?: number
  /** LF tenseness. Default 0.6. */
  tenseness?: number
}

export function synthesizeFormantCv(
  input: SynthesizeFormantCvInput,
): Float32Array {
  const consonant = input.consonant
  const vowel: VowelKey = input.vowel ?? 'a'
  const duration = input.duration ?? 0.65
  const sampleRate = input.sampleRate ?? 24_000
  const frequency = input.frequency ?? 130
  const tenseness = input.tenseness ?? 0.6

  if (!hasTrajectory(consonant)) {
    throw new Error(
      `synthesizeFormantCv: no formant trajectory for '${consonant}'`,
    )
  }

  const { spec, frames } = buildTrajectory({ consonant, vowel })
  const trajectoryEnd = frames[frames.length - 1]!.time

  const totalSamples = Math.floor(duration * sampleRate)
  const out = new Float32Array(totalSamples)

  const glottis = new Glottis()
  const cascade = new CascadeFormantBank(sampleRate, 4)
  const noiseFilter = new FormantResonator(sampleRate)

  // LCG noise generator.
  let lcg = 0xa5a5a5a5
  const nextNoise = () => {
    lcg = (lcg * 1664525 + 1013904223) >>> 0
    return (lcg / 0xffffffff - 0.5) * 2
  }

  // Sub-Hz wandering "jitter" generators for per-sample
  // formant frequency variation. Pure Klatt resonators
  // sound synth-like without this — slight random
  // variation in F1/F2/F3 emulates the micro-shifts in
  // real articulator position and breaks the alarm-like
  // pure-tone character.
  let jitterPhase1 = 0
  let jitterPhase2 = Math.PI / 3
  let jitterPhase3 = Math.PI / 2
  // 4-8 Hz wandering — slightly faster than vibrato.
  const jitterRate1 = 4.7
  const jitterRate2 = 5.3
  const jitterRate3 = 6.1

  // Trill modulation if applicable.
  const isTrill = spec.source === 'voiced' && (consonant === 'r' || consonant === 'R')
  const trillRateHz = 28

  // Boundary ramps to avoid clicks.
  const attackSamples = Math.floor(0.005 * sampleRate)
  const releaseSamples = Math.floor(0.020 * sampleRate)

  for (let n = 0; n < totalSamples; n += 1) {
    const t = n / sampleRate
    const frameT = Math.min(t, trajectoryEnd)
    const frame = interpolateFrame({ frames, t: frameT })

    // Per-sample formant jitter. Wide-Hz low-frequency
    // wander around the target — breaks the pure-tone
    // synth character without affecting perceived pitch
    // or formant identity.
    jitterPhase1 += (2 * Math.PI * jitterRate1) / sampleRate
    jitterPhase2 += (2 * Math.PI * jitterRate2) / sampleRate
    jitterPhase3 += (2 * Math.PI * jitterRate3) / sampleRate
    const j1 = Math.sin(jitterPhase1) * 6
    const j2 = Math.sin(jitterPhase2) * 12
    const j3 = Math.sin(jitterPhase3) * 18

    // Update formants for this sample.
    cascade.setFormants([
      { freq: frame.f1 + j1, bandwidth: frame.bw1 },
      { freq: frame.f2 + j2, bandwidth: frame.bw2 },
      { freq: frame.f3 + j3, bandwidth: frame.bw3 },
      { freq: frame.f4, bandwidth: frame.bw4 },
    ])

    // Frication noise. CRITICAL: this output BYPASSES
    // the cascade. If we ran the noise through the
    // voicing-formant cascade, /s/'s 5500 Hz peak would
    // get re-filtered by F1=400, F2=1500, F3=2700 and
    // come out sounding like a vowel-shaped buzz. The
    // proper Klatt routing is: voicing → cascade
    // (vowel-formant filter); noise → its own bandpass.
    // Sum the two paths.
    let noiseSample = 0
    if (frame.noise > 0 && frame.noisePeakHz && frame.noisePeakHz > 0) {
      noiseFilter.setFrequencyBandwidth(
        frame.noisePeakHz,
        frame.noiseBandwidthHz ?? 1500,
      )
      noiseSample = noiseFilter.process(nextNoise()) * frame.noise
    }

    // Voicing source via LF model.
    let voicingSample = 0
    if (frame.voiced > 0) {
      voicingSample = glottis.process({
        seconds: t,
        frequency,
        intensity: frame.voiced,
        loudness: 1,
        tenseness,
        noise: nextNoise(),
      })
    }

    // Trill amplitude modulation on the voiced source.
    if (isTrill && t < trajectoryEnd - spec.transitionDuration) {
      const mod = 0.5 + 0.5 * Math.sin(2 * Math.PI * trillRateHz * t)
      voicingSample *= mod
    }

    // Two-path output: cascade-filtered voicing + direct
    // bandpass-filtered noise.
    const cascadeOutput = cascade.process(voicingSample)
    const total = cascadeOutput + noiseSample

    // Boundary envelope.
    let env = 1
    if (n < attackSamples) env = n / attackSamples
    else if (n > totalSamples - releaseSamples)
      env = (totalSamples - n) / releaseSamples

    out[n] = total * env
  }

  // Lip radiation: 1-pole HPF + makeup gain. Avoid
  // peak-normalizing the whole clip (that crushes the
  // consonant). Apply a fixed gain + tanh limiter.
  const alpha = 0.95
  let prev = 0
  let prevOut = 0
  for (let n = 0; n < out.length; n += 1) {
    const x = out[n]!
    const y = alpha * (prevOut + x - prev)
    prev = x
    prevOut = y
    // Makeup gain + soft saturation.
    out[n] = Math.tanh(y * 3.5) * 0.9
  }

  return out
}
