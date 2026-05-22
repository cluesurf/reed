// SPDX-License-Identifier: GPL-3.0-or-later

import { Glottis } from '@/synth/glottis'
import { Tract } from '@/synth/tract'
import { LipRadiation } from '@/synth/radiation'
import { SpectralShape } from '@/synth/spectral-shape'
import { vowelDiameters, type VowelKey } from '@/synth/vowel-shapes'
import { deriveFeatures } from '@/parse/features'
import {
  articulationFor,
  type ConsonantArticulation,
} from '@/synth/consonant-articulations'

/**
 * Articulatory CV (consonant-vowel) synthesizer.
 *
 * This is the Phase 1+2+3+5+6+7 implementation described
 * in `consonant-quality-analysis.md`. The same
 * Kelly-Lochbaum tract that produces vowels is driven
 * continuously through a time-varying diameter trajectory
 * that morphs from the consonant's articulator
 * configuration into the vowel's. Frication noise is
 * injected INSIDE the tract at the constriction location.
 * Voicing is gated by Voice Onset Time.
 *
 * Per-sample loop (at 96 kHz internal rate):
 *
 *   1. Compute progress through the phases: closure →
 *      release → voicing-onset → steady vowel.
 *   2. Build the current diameter array by morphing
 *      between consonant target shape and vowel shape.
 *   3. Update the tract diameters + reflection
 *      coefficients.
 *   4. Compute glottal intensity (0 during voiceless
 *      closure / aspiration; ramping up at voicing
 *      onset; full during the vowel).
 *   5. Compute frication noise intensity (scaled by
 *      constriction tightness; zero outside the hold +
 *      release).
 *   6. Step the tract once with both inputs.
 *   7. Apply lip radiation + spectral shape post-tract.
 *
 * Output is decimated from 96 kHz to the user's chosen
 * sample rate via the same FIR lowpass the vowel synth
 * uses.
 */

export type SynthesizeArticulatoryCvInput = {
  /** Talk consonant glyph. */
  consonant: string
  /** Vowel that follows. Default 'a'. */
  vowel?: VowelKey
  /** Total duration in seconds. Default 0.65. */
  duration?: number
  /** Output sample rate. Default 24 kHz. */
  sampleRate?: number
  /** f0 in Hz for the voiced portion. Default 130. */
  frequency?: number
  /** Voice quality knob, [0, 1]. Default 0.6. */
  tenseness?: number
  /** Tract segment count. Default 44. */
  segments?: number
}

const INTERNAL_RATE = 96_000

export function synthesizeArticulatoryCv(
  input: SynthesizeArticulatoryCvInput,
): Float32Array {
  const consonantGlyph = input.consonant
  const vowel: VowelKey = input.vowel ?? 'a'
  const duration = input.duration ?? 0.65
  const outputRate = input.sampleRate ?? 24_000
  const frequency = input.frequency ?? 130
  const tenseness = input.tenseness ?? 0.6
  const segments = input.segments ?? 44

  const features = deriveFeatures({ glyph: consonantGlyph, modifiers: {} })
  if (features.kind !== 'consonant') {
    throw new Error(
      `synthesizeArticulatoryCv: '${consonantGlyph}' is not a consonant`,
    )
  }
  const articulation = articulationFor({
    talk: consonantGlyph,
    site: features.site ?? 'alveolar',
    mold: features.mold ?? 'plosive',
    voiced: features.voiced ?? false,
  })

  // Pre-compute the two endpoint diameter profiles.
  const vowelTarget = vowelDiameters(vowel, segments)
  const consonantTarget = applyConstriction({
    base: vowelTarget,
    site: articulation.constrictionSegment,
    diameter: articulation.constrictionDiameter,
    spread: articulation.constrictionSpread,
  })

  // Phase plan (in seconds):
  //   [0, holdDuration]              : closure / hold
  //   [holdDuration, hd+releaseDur]  : release
  //   [hd+rd, hd+rd+vot]             : aspiration (voiceless only)
  //   [hd+rd+vot, duration]          : voiced vowel
  const holdDur = articulation.holdDuration
  const releaseDur = articulation.releaseDuration
  const vot = articulation.vot
  const holdEnd = holdDur
  const releaseEnd = holdDur + releaseDur
  const voicingStart = releaseEnd + vot

  const internalSamples = Math.floor(duration * INTERNAL_RATE)
  const tract = new Tract({ length: segments })
  const glottis = new Glottis()
  const internalOut = new Float64Array(internalSamples)

  // Scratch buffer for the per-sample diameter array.
  const liveDiameters = new Float64Array(segments)

  // LCG for aspiration + frication noise.
  let lcg = 0xa5a5a5a5
  const nextNoise = () => {
    lcg = (lcg * 1664525 + 1013904223) >>> 0
    return (lcg / 0xffffffff - 0.5) * 2
  }

  // Brief overall attack ramp to avoid clicks at clip start.
  const attackSamples = Math.floor(0.005 * INTERNAL_RATE)
  // Release ramp at the very end.
  const tailSamples = Math.floor(0.015 * INTERNAL_RATE)

  for (let n = 0; n < internalSamples; n += 1) {
    const t = n / INTERNAL_RATE

    // Articulator progress: 0 during hold, 0→1 during
    // release, 1 after release. Smoothed with a half-cosine
    // for natural-feeling transitions.
    let progress: number
    if (t < holdEnd) {
      progress = 0
    } else if (t < releaseEnd) {
      const u = (t - holdEnd) / releaseDur
      progress = 0.5 * (1 - Math.cos(Math.PI * u))
    } else {
      progress = 1
    }

    // Trill modulation: periodic full-closure during the
    // hold window.
    let trillFactor = 0
    if (articulation.mold === 'trill' && t < releaseEnd) {
      const rate = 28 // Hz
      trillFactor = Math.max(0, Math.sin(2 * Math.PI * rate * t))
    }

    // Build live diameter array.
    for (let i = 0; i < segments; i += 1) {
      // Interpolate consonant target → vowel target.
      let d =
        consonantTarget[i]! * (1 - progress) + vowelTarget[i]! * progress
      // Trill: pull the constriction back to closure
      // every flap.
      if (trillFactor > 0) {
        const distToConstriction = Math.abs(
          i - articulation.constrictionSegment,
        )
        if (distToConstriction <= articulation.constrictionSpread) {
          const localFactor =
            1 - distToConstriction / (articulation.constrictionSpread + 1)
          d = d * (1 - trillFactor * localFactor)
        }
      }
      liveDiameters[i] = d
    }
    tract.setDiametersAndRefresh(liveDiameters)

    // Glottal intensity envelope.
    let glottalIntensity = 0
    if (articulation.voiced) {
      // Voiced consonant — glottis runs continuously,
      // reduced during closure. The voice bar at 80%
      // intensity ensures it's audible at the lip end
      // (with the leaky closure modeled in
      // consonant-articulations).
      if (t < holdEnd) {
        glottalIntensity = 0.8
      } else if (t < voicingStart) {
        const u = (t - holdEnd) / Math.max(0.001, voicingStart - holdEnd)
        glottalIntensity = 0.8 + 0.2 * u
      } else {
        glottalIntensity = 1
      }
    } else {
      // Voiceless — glottis is OFF until VOT elapses.
      if (t < voicingStart) {
        glottalIntensity = 0
      } else {
        // Smooth onset over 20 ms after VOT to avoid click.
        const onsetSamples = 0.02
        const u = Math.min(1, (t - voicingStart) / onsetSamples)
        glottalIntensity = u
      }
    }

    // Overall clip-edge ramps.
    let envelope = 1
    if (n < attackSamples) envelope = n / attackSamples
    else if (n > internalSamples - tailSamples)
      envelope = (internalSamples - n) / tailSamples
    glottalIntensity *= envelope

    const noiseSample = nextNoise()

    // Compute glottal sample.
    const glottalSample = glottis.process({
      seconds: t,
      frequency,
      intensity: glottalIntensity,
      loudness: 1,
      tenseness,
      noise: noiseSample,
    })

    // Frication / aspiration / release-burst noise.
    //
    // Kelly-Lochbaum is a wave-propagation model — it
    // doesn't track pressure buildup behind a closure.
    // Real stop releases get their "pop" from pressure
    // equalizing through the suddenly-open lips, which
    // K-L can't produce on its own. We model the release
    // transient as an explicit noise burst injected at
    // the constriction segment at the moment of release.
    let injectAmplitude = 0
    let injectSegment = articulation.constrictionSegment
    const currentConstrictionDiameter =
      liveDiameters[articulation.constrictionSegment]!

    if (articulation.hasFrication && t < releaseEnd) {
      // Frication during hold + release. Amplitude
      // scales with constriction tightness.
      const tightness = Math.max(0, 1 - currentConstrictionDiameter / 1.0)
      injectAmplitude = articulation.fricationAmplitude * tightness * 0.8
    }

    // Release burst — only for stops + affricates. A
    // brief broadband noise pulse at the constriction,
    // peaking at the moment of release and decaying
    // exponentially over ~25 ms.
    const isBurstManner =
      articulation.mold === 'plosive' || articulation.mold === 'affricate'
    if (isBurstManner) {
      const burstDecayWindow = 0.025 // seconds
      const sinceRelease = t - holdEnd
      if (sinceRelease >= 0 && sinceRelease < burstDecayWindow) {
        const decay = Math.exp(-sinceRelease / 0.008) // 8 ms time constant
        // Burst amplitude depends on voicing — voiceless
        // stops have louder bursts (stronger pressure
        // buildup) than voiced.
        const burstStrength = articulation.voiced ? 0.4 : 0.9
        injectAmplitude = Math.max(injectAmplitude, burstStrength * decay)
      }
    }

    // Aspiration during the voiceless VOT window. Injected
    // at the glottal end (it's a glottal-source phenomenon).
    if (!articulation.voiced && t >= releaseEnd && t < voicingStart) {
      // Aspiration tapers off over the VOT window.
      const aspProgress = (t - releaseEnd) / Math.max(0.001, voicingStart - releaseEnd)
      const aspAmplitude = 0.4 * (1 - 0.5 * aspProgress)
      if (aspAmplitude > injectAmplitude) {
        injectAmplitude = aspAmplitude
        injectSegment = 2 // glottal end
      }
    }

    const fricationSample = noiseSample * injectAmplitude * envelope

    // Affricate: as the release progresses, the
    // constriction widens but stays narrow enough to
    // sustain frication; we already get this from the
    // constriction-diameter-driven amplitude above.

    internalOut[n] = tract.step(
      glottalSample,
      fricationSample,
      injectSegment,
    )
  }

  // Decimate to output rate (same FIR lowpass approach
  // as the vowel synth).
  const out =
    outputRate === INTERNAL_RATE
      ? float32From(internalOut)
      : decimate({ input: internalOut, inRate: INTERNAL_RATE, outRate: outputRate })

  // Post-process: lip radiation + spectral shape.
  const radiation = new LipRadiation({ sampleRate: outputRate })
  const shape = new SpectralShape(outputRate)
  for (let i = 0; i < out.length; i += 1) {
    out[i] = shape.process(radiation.process(out[i]!))
  }

  // Phase 4 (simplified): nasal antiformant filter.
  // When the consonant is a nasal, add a place-specific
  // spectral notch to approximate the oral-side-branch
  // antiformant.
  if (articulation.mold === 'nasal') {
    applyNasalAntiformant(out, outputRate, articulation.site)
  }

  // Phase 9 (simplified): subglottal antiformant on the
  // whole signal. Adds a faint notch around 600 Hz to
  // give the voice some natural depth.
  applySubglottalAntiformant(out, outputRate)

  // Apply a fixed makeup gain + soft tanh limiter.
  // CRITICAL: do NOT peak-normalize the whole clip — that
  // would let the loud vowel pull the gain down and
  // crush the quieter consonant into inaudibility. The
  // soft limiter preserves the natural amplitude balance
  // between consonant and vowel.
  const makeupGain = 2.8
  for (let n = 0; n < out.length; n += 1) {
    // Soft saturation via tanh — gentler than hard clip.
    out[n] = Math.tanh(out[n]! * makeupGain) * 0.9
  }

  return out
}

/**
 * Apply a constriction profile to a base diameter array.
 * Narrows segments around `site` to `diameter`, with
 * cosine falloff out to `spread` segments on each side.
 *
 * Used to build the consonant-target diameter array from
 * a vowel-target one. The vowel shape is the "where the
 * articulators want to be" baseline; the constriction is
 * the local override that defines the consonant.
 */

function applyConstriction(input: {
  base: number[]
  site: number
  diameter: number
  spread: number
}): number[] {
  const { base, site, diameter, spread } = input
  const out = base.slice()
  // Closure radius is `spread + 1` so the falloff
  // reaches zero exactly at the next segment beyond
  // `spread`.
  for (let i = 0; i < out.length; i += 1) {
    const dist = Math.abs(i - site)
    if (dist > spread + 1) continue
    const t = dist / (spread + 1)
    // Cosine taper: 1 at center, 0 at edge.
    const factor = 0.5 * (1 + Math.cos(Math.PI * t))
    out[i] = out[i]! * (1 - factor) + diameter * factor
  }
  return out
}

function float32From(buf: Float64Array): Float32Array {
  const out = new Float32Array(buf.length)
  for (let i = 0; i < buf.length; i += 1) out[i] = buf[i]!
  return out
}

function decimate(input: {
  input: Float64Array
  inRate: number
  outRate: number
}): Float32Array {
  const { input: src, inRate, outRate } = input
  const ratio = inRate / outRate
  const outLen = Math.floor(src.length / ratio)
  const out = new Float32Array(outLen)
  const taps = Math.max(33, Math.ceil(16 * ratio) | 1)
  const cutoffRelativeToInternal = 0.45 / ratio
  const filt = buildLowpass(taps, cutoffRelativeToInternal)
  const halfTaps = (taps - 1) / 2

  for (let i = 0; i < outLen; i += 1) {
    const srcPos = i * ratio
    const srcIdx = Math.round(srcPos)
    let acc = 0
    for (let t = 0; t < taps; t += 1) {
      const k = srcIdx - halfTaps + t
      if (k < 0 || k >= src.length) continue
      acc += src[k]! * filt[t]!
    }
    out[i] = acc as number
  }
  return out
}

function buildLowpass(taps: number, cutoff: number): number[] {
  const half = (taps - 1) / 2
  const out = new Array<number>(taps)
  let sum = 0
  for (let i = 0; i < taps; i += 1) {
    const n = i - half
    const sinc =
      n === 0
        ? 2 * cutoff
        : Math.sin(2 * Math.PI * cutoff * n) / (Math.PI * n)
    const window = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (taps - 1))
    out[i] = sinc * window
    sum += out[i]!
  }
  for (let i = 0; i < taps; i += 1) out[i]! /= sum
  return out
}

/**
 * Phase 4 (simplified): nasal antiformant.
 *
 * Real nasals produce antiformants (spectral zeros) from
 * the oral side branch. Without the full nasal-tract
 * waveguide, we approximate the dominant antiformant per
 * place via a biquad notch on the output:
 *
 *   /m/ (bilabial closure)  — 12-15 cm side branch
 *                              → antiformant ~750 Hz
 *   /n/ (alveolar closure)  — 8-10 cm side branch
 *                              → antiformant ~1300 Hz
 *   /ŋ/ (velar closure)     — 3-5 cm side branch
 *                              → antiformant ~2700 Hz
 *   /ɲ/ (palatal closure)   — 5-7 cm side branch
 *                              → antiformant ~2000 Hz
 *   /ɱ/ (labiodental)       — similar to /m/
 *
 * This is a stand-in for the proper nasal-tract branch.
 * The full implementation lands in a later iteration.
 */

function applyNasalAntiformant(
  signal: Float32Array,
  sampleRate: number,
  site: string,
): void {
  let freq = 1000
  switch (site) {
    case 'bilabial':
    case 'labiodental':
      freq = 750
      break
    case 'alveolar':
    case 'dental':
    case 'retroflex':
      freq = 1300
      break
    case 'palatal':
      freq = 2000
      break
    case 'velar':
      freq = 2700
      break
    case 'uvular':
      freq = 1800
      break
  }
  applyNotch({ signal, sampleRate, freqHz: freq, depthDb: -12, q: 3.5 })
}

function applySubglottalAntiformant(
  signal: Float32Array,
  sampleRate: number,
): void {
  // Faint notch around 600 Hz; the subglottal cavity
  // contributes an antiformant there. Real strength
  // ~ -3 dB.
  applyNotch({ signal, sampleRate, freqHz: 600, depthDb: -3, q: 2.0 })
}

function applyNotch(input: {
  signal: Float32Array
  sampleRate: number
  freqHz: number
  depthDb: number
  q: number
}): void {
  const { signal, sampleRate, freqHz, depthDb, q } = input
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
  const nb0 = b0 / a0
  const nb1 = b1 / a0
  const nb2 = b2 / a0
  const na1 = a1 / a0
  const na2 = a2 / a0
  let x1 = 0
  let x2 = 0
  let y1 = 0
  let y2 = 0
  for (let n = 0; n < signal.length; n += 1) {
    const x = signal[n]!
    const y = nb0 * x + nb1 * x1 + nb2 * x2 - na1 * y1 - na2 * y2
    x2 = x1
    x1 = x
    y2 = y1
    y1 = y
    signal[n] = y
  }
}
