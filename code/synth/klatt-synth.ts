// SPDX-License-Identifier: GPL-3.0-or-later

import { FormantResonator } from '@/synth/formant'
import { AntiResonator } from '@/synth/anti-resonator'
import { KlattSource } from '@/synth/klatt-source'
import {
  buildKlattTrajectory,
  interpolateKlattFrame,
  hasKlattSpec,
} from '@/synth/klatt-trajectories'
import type { VowelKey } from '@/synth/vowel-shapes'

/**
 * Full Klatt 1980 cascade/parallel formant synthesizer.
 *
 * Pipeline per sample:
 *
 *   1. KlattSource produces three signals:
 *      - cascadeInput (voicing + aspiration)
 *      - parallelInput (frication + voiced-fricative voicing)
 *      - bypassOutput (high-frequency noise direct to out)
 *
 *   2. Cascade path:
 *      cascadeInput → F1 → F2 → F3 → F4 → F5 → nasalPole
 *      → nasalZero → cascadeOutput
 *
 *      For sonorants the nasal pole/zero are heavily
 *      damped (effectively inactive). For nasals the
 *      pole/zero are sharp and place-specific.
 *
 *   3. Parallel path: each of 5 parallel formant filters
 *      processes parallelInput independently with its
 *      own amplitude scaling. Outputs summed.
 *
 *   4. Total = cascadeOutput + parallelOutput + bypassOutput.
 *
 *   5. Post-processing: lip radiation + makeup gain +
 *      tanh limiter.
 *
 * Per-sample formant frequencies + bandwidths +
 * amplitudes come from interpolating the per-CV
 * trajectory (4 keyframes typically).
 *
 * Reference: Klatt 1980, §III, Fig. 1 (synthesizer
 * topology).
 */

export type SynthesizeKlattCvInput = {
  consonant: string
  vowel?: VowelKey
  /** Total duration in seconds. Default 0.55. */
  duration?: number
  /** Output sample rate. Default 24 kHz. */
  sampleRate?: number
  /** f0 in Hz. Default 130. */
  frequency?: number
  /** LF tenseness (voice quality). Default 0.6. */
  tenseness?: number
}

export function synthesizeKlattCv(input: SynthesizeKlattCvInput): Float32Array {
  const consonant = input.consonant
  const vowel: VowelKey = input.vowel ?? 'a'
  const duration = input.duration ?? 0.55
  const sampleRate = input.sampleRate ?? 24_000
  const frequency = input.frequency ?? 130
  const tenseness = input.tenseness ?? 0.6

  if (!hasKlattSpec(consonant)) {
    throw new Error(
      `synthesizeKlattCv: no Klatt parameter spec for '${consonant}'`,
    )
  }

  const { frames, trajectoryEnd } = buildKlattTrajectory({ consonant, vowel })

  const totalSamples = Math.floor(duration * sampleRate)
  const out = new Float32Array(totalSamples)

  // === Build the filter chain ===

  // Cascade: 5 formant resonators + nasal pole + nasal zero
  // (the nasal pair is part of the cascade path per Klatt).
  const cascadeFormants = [
    new FormantResonator(sampleRate),
    new FormantResonator(sampleRate),
    new FormantResonator(sampleRate),
    new FormantResonator(sampleRate),
    new FormantResonator(sampleRate),
  ]
  const nasalPole = new FormantResonator(sampleRate)
  const nasalZero = new AntiResonator(sampleRate)

  // Parallel: 5 independent formant filters with their own
  // amplitudes (per Klatt, parallel bank is A2-A6; A1 is
  // typically a dedicated low-frequency parallel formant
  // but rarely used).
  const parallelFormants = [
    new FormantResonator(sampleRate),
    new FormantResonator(sampleRate),
    new FormantResonator(sampleRate),
    new FormantResonator(sampleRate),
    new FormantResonator(sampleRate),
  ]

  const source = new KlattSource(sampleRate)

  // Boundary envelope to avoid clicks.
  const attackSamples = Math.floor(0.005 * sampleRate)
  const releaseSamples = Math.floor(0.020 * sampleRate)

  // Trill modulator (for /r/ /R/).
  const isTrill = consonant === 'r' || consonant === 'R'
  const trillRateHz = 28

  for (let n = 0; n < totalSamples; n += 1) {
    const t = n / sampleRate
    const frameT = Math.min(t, trajectoryEnd)
    const frame = interpolateKlattFrame({ frames, t: frameT })

    // Configure cascade formants.
    for (let i = 0; i < cascadeFormants.length; i += 1) {
      const f = frame.cascade[i]
      if (f) cascadeFormants[i]!.setFrequencyBandwidth(f.freq, f.bw)
    }
    nasalPole.setFrequencyBandwidth(frame.nasalPole.freq, frame.nasalPole.bw)
    nasalZero.setFrequencyBandwidth(frame.nasalZero.freq, frame.nasalZero.bw)

    // Configure parallel formants.
    for (let i = 0; i < parallelFormants.length; i += 1) {
      const f = frame.parallel[i]
      if (f) parallelFormants[i]!.setFrequencyBandwidth(f.freq, f.bw)
    }

    // === Generate source samples ===
    const sourceOut = source.process({
      seconds: t,
      frequency,
      amps: frame.source,
      tenseness,
      tl: frame.tl,
    })

    // === Cascade path ===
    // F1 → F2 → F3 → F4 → F5 → nasalZero → nasalPole·an + cascade
    //
    // Klatt's nasal pole-zero is configured so that, with
    // an=0, the pole and zero cancel and the cascade is
    // unaffected. With an>0, the pole adds the nasal
    // resonance and the zero removes the place-specific
    // antiformant.
    let cascadeSample = sourceOut.cascadeInput
    for (const f of cascadeFormants) cascadeSample = f.process(cascadeSample)
    // Apply nasal pole-zero pair (in series).
    cascadeSample = nasalZero.process(cascadeSample)
    // The nasal pole contributes proportionally to AN.
    const nasalPoleSample = nasalPole.process(cascadeSample)
    cascadeSample = cascadeSample + frame.source.an * nasalPoleSample

    // === Parallel path ===
    // Each formant processes the parallel input separately,
    // outputs summed with the per-formant amplitudes.
    let parallelSample = 0
    for (let i = 0; i < parallelFormants.length; i += 1) {
      const spec = frame.parallel[i]
      if (!spec || spec.amp <= 0) continue
      // Alternating sign across formants per Klatt (avoids
      // spectral notches at cross-overs between adjacent
      // parallel resonators).
      const sign = i % 2 === 0 ? 1 : -1
      parallelSample +=
        sign * spec.amp * parallelFormants[i]!.process(sourceOut.parallelInput)
    }

    // === Bypass path (direct noise to output) ===
    const bypassSample = sourceOut.bypassOutput

    // === Mix ===
    let total = cascadeSample + parallelSample + bypassSample

    // Trill amplitude modulation during the hold window
    // only (not during the vowel tail).
    if (isTrill && frameT < trajectoryEnd * 0.5) {
      const mod = 0.5 + 0.5 * Math.sin(2 * Math.PI * trillRateHz * t)
      total *= mod
    }

    // Boundary envelope.
    let env = 1
    if (n < attackSamples) env = n / attackSamples
    else if (n > totalSamples - releaseSamples)
      env = (totalSamples - n) / releaseSamples

    out[n] = total * env
  }

  // === Post-processing ===
  // 1. Lip radiation: 1-pole HPF (DC blocker only).
  const radAlpha = 0.95
  let prevIn = 0
  let prevOut = 0
  for (let n = 0; n < out.length; n += 1) {
    const x = out[n]!
    const y = radAlpha * (prevOut + x - prevIn)
    prevIn = x
    prevOut = y
    out[n] = y
  }

  // 2. High-frequency tame — 2-pole low-pass at ~7 kHz.
  // Real radiation impedance + tissue/jaw losses roll off
  // above ~7 kHz. Without this the synth sounds metallic
  // because cascade + parallel formants have too much
  // high-frequency content that real radiation would
  // attenuate. RBJ-style biquad LPF coefficients.
  {
    const cutoff = 6500
    const q = 0.707
    const omega = (2 * Math.PI * cutoff) / sampleRate
    const cos = Math.cos(omega)
    const sin = Math.sin(omega)
    const alpha = sin / (2 * q)
    const b0 = (1 - cos) / 2
    const b1 = 1 - cos
    const b2 = (1 - cos) / 2
    const a0 = 1 + alpha
    const a1 = -2 * cos
    const a2 = 1 - alpha
    const nb0 = b0 / a0
    const nb1 = b1 / a0
    const nb2 = b2 / a0
    const na1 = a1 / a0
    const na2 = a2 / a0
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0
    for (let n = 0; n < out.length; n += 1) {
      const x = out[n]!
      const y = nb0 * x + nb1 * x1 + nb2 * x2 - na1 * y1 - na2 * y2
      x2 = x1
      x1 = x
      y2 = y1
      y1 = y
      out[n] = y
    }
  }

  // 3. Low-shelf warmth boost — adds body around 250 Hz.
  // Klatt cascade tends to underweight the low-mid
  // region because each cascade stage attenuates low
  // frequencies relative to its formant peak. A gentle
  // +3 dB shelf below 400 Hz restores natural vocal
  // warmth.
  {
    const corner = 400
    const gainDb = 3
    const q = 0.707
    const A = Math.pow(10, gainDb / 40)
    const omega = (2 * Math.PI * corner) / sampleRate
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
    const nb0 = b0 / a0
    const nb1 = b1 / a0
    const nb2 = b2 / a0
    const na1 = a1 / a0
    const na2 = a2 / a0
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0
    for (let n = 0; n < out.length; n += 1) {
      const x = out[n]!
      const y = nb0 * x + nb1 * x1 + nb2 * x2 - na1 * y1 - na2 * y2
      x2 = x1
      x1 = x
      y2 = y1
      y1 = y
      out[n] = y
    }
  }

  // 4. Peak-find normalization to a conservative target
  // (0.55 — leaves headroom, no clipping). NO tanh
  // limiter — clean linear scale.
  let peak = 0
  for (let n = 0; n < out.length; n += 1) {
    const a = Math.abs(out[n]!)
    if (a > peak) peak = a
  }
  if (peak > 0) {
    const target = 0.55
    const scale = target / peak
    for (let n = 0; n < out.length; n += 1) {
      out[n] = out[n]! * scale
    }
  }

  return out
}
