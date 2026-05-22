// SPDX-License-Identifier: GPL-3.0-or-later

import { Glottis } from '@/synth/glottis'
import { Tract } from '@/synth/tract'
import { vowelDiameters, type VowelKey } from '@/synth/vowel-shapes'
import { LipRadiation } from '@/synth/radiation'
import { SpectralShape } from '@/synth/spectral-shape'

/**
 * Top-level offline synth interface.
 *
 * v0.4 — tract length fix:
 *
 * The Kelly-Lochbaum segment length is `c / fs`, with c
 * ≈ 350 m/s. At 48 kHz with 44 segments, the tract was
 * 32 cm — roughly double an adult vocal tract. Every
 * formant came out halved; only /i/ survived as
 * recognizable (its huge F1/F2 ratio preserves identity
 * under scaling).
 *
 * Fix: run the propagation at 96 kHz internally so each
 * segment is 3.65 mm and the 44-segment tract lands at
 * ~16 cm. Decimate to the requested output rate (96 →
 * 24 kHz is a clean 4× ratio; 96 → 48 kHz is 2×).
 *
 * Full analysis in note/library/reed/vowel-quality-analysis.md.
 */

export type SynthesizeVowelInput = {
  vowel: VowelKey
  /** Seconds. */
  duration: number
  /** Output sample rate. Default 24 kHz. Internal fixed at 96 kHz. */
  sampleRate?: number
  /** f0 in Hz. Default 120 (typical adult-male baseline). */
  frequency?: number
  /** Master amplitude. Default 1. */
  intensity?: number
  /** Voice quality knob, [0, 1]. Default 0.6. */
  tenseness?: number
  /** Number of tract segments. Default 44 (Pink-Trombone-compatible). */
  segments?: number
}

/**
 * Internal propagation rate. Tuned so that
 * 44 segments × (c / INTERNAL_RATE) ≈ 16 cm, which is
 * close to an adult male vocal tract length. The exact
 * choice of 96 kHz also gives clean integer decimation
 * to 48 / 24 / 16 kHz output rates.
 */
const INTERNAL_RATE = 96_000

export function synthesizeVowel(input: SynthesizeVowelInput): Float32Array {
  const outputRate = input.sampleRate ?? 24_000
  const frequency = input.frequency ?? 120
  const intensity = input.intensity ?? 1
  const tenseness = input.tenseness ?? 0.6
  const segments = input.segments ?? 44

  const internalSamples = Math.floor(input.duration * INTERNAL_RATE)
  const internalOut = new Float64Array(internalSamples)

  const glottis = new Glottis()
  const tract = new Tract({ length: segments })
  tract.setDiameters(vowelDiameters(input.vowel, segments))

  let lcg = 7919
  const nextNoise = () => {
    lcg = (lcg * 1664525 + 1013904223) >>> 0
    return (lcg / 0xffffffff - 0.5) * 2
  }

  // 30 ms attack + release ramps to prevent boundary clicks.
  const rampSamples = Math.min(
    Math.floor(0.03 * INTERNAL_RATE),
    Math.floor(internalSamples / 4),
  )

  for (let n = 0; n < internalSamples; n += 1) {
    const t = n / INTERNAL_RATE
    const env =
      n < rampSamples
        ? n / rampSamples
        : n > internalSamples - rampSamples
          ? (internalSamples - n) / rampSamples
          : 1

    const noise = nextNoise()
    const glottalSample = glottis.process({
      seconds: t,
      frequency,
      intensity: intensity * env,
      loudness: 1,
      tenseness,
      noise,
    })

    // ONE tract step per internal sample (Pink Trombone's
    // actual loop). The INTERNAL_RATE controls effective
    // tract length, not this step count.
    internalOut[n] = tract.step(glottalSample)
  }

  // Decimate from INTERNAL_RATE → outputRate with an
  // anti-aliasing FIR lowpass.
  const decimated =
    outputRate === INTERNAL_RATE
      ? floatFrom(internalOut)
      : decimate({
          input: internalOut,
          inRate: INTERNAL_RATE,
          outRate: outputRate,
        })

  // Lip radiation impedance (DC rejection + HF boost) +
  // gentle spectral shape (top-end rolloff). Applied at
  // output rate post-decimation.
  const radiation = new LipRadiation({ sampleRate: outputRate })
  const shape = new SpectralShape(outputRate)
  for (let n = 0; n < decimated.length; n += 1) {
    decimated[n] = shape.process(radiation.process(decimated[n]!))
  }

  // DC blocking + soft limiter.
  let dc = 0
  let peak = 0
  for (let n = 0; n < decimated.length; n += 1) {
    dc = dc * 0.998 + decimated[n]! * 0.002
    const s = decimated[n]! - dc
    decimated[n] = s
    const ab = Math.abs(s)
    if (ab > peak) peak = ab
  }
  // Soft normalization: scale so peak ≈ 0.85 (leaving
  // 1.5 dB of headroom). After radiation + shaping the
  // absolute amplitude is unpredictable, so we calibrate
  // per render rather than hard-clip at the end.
  if (peak > 0) {
    const target = 0.85
    const g = Math.min(target / peak, 4.0) // clamp boost
    for (let n = 0; n < decimated.length; n += 1) {
      let s = decimated[n]! * g
      if (s > 1) s = 1
      else if (s < -1) s = -1
      decimated[n] = s
    }
  }

  return decimated
}

function floatFrom(buf: Float64Array): Float32Array {
  const out = new Float32Array(buf.length)
  for (let i = 0; i < buf.length; i += 1) out[i] = buf[i]!
  return out
}

/**
 * Decimate by a (possibly non-integer) factor with a
 * Hamming-windowed-sinc anti-aliasing lowpass.
 *
 * For a 4× decimation (96 → 24 kHz) the cutoff is
 * 0.45 × output Nyquist = 5400 Hz. That's WAY too low —
 * we'd cut off F3 and higher. Setting cutoff in terms of
 * the OUTPUT Nyquist isn't enough for high-ratio
 * decimation. We use 0.9 × output Nyquist, which leaves
 * just enough margin to avoid aliasing while keeping
 * formants up to ~11 kHz intact for a 24 kHz output.
 */

function decimate(input: {
  input: Float64Array
  inRate: number
  outRate: number
}): Float32Array {
  const { input: src, inRate, outRate } = input
  const ratio = inRate / outRate
  const outLen = Math.floor(src.length / ratio)
  const out = new Float32Array(outLen)

  // Number of taps scales with the decimation ratio. More
  // ratio = wider transition band = need sharper filter.
  const taps = Math.max(33, Math.ceil(16 * ratio) | 1)
  const cutoffRelativeToInternal = 0.45 / ratio // = 0.45 × output Nyquist
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
  // Normalize to unity DC gain so the decimated signal
  // has the same amplitude as the source.
  for (let i = 0; i < taps; i += 1) out[i]! /= sum
  return out
}

export { Glottis } from '@/synth/glottis'
export { Tract } from '@/synth/tract'
export { vowelDiameters, type VowelKey } from '@/synth/vowel-shapes'
export { LipRadiation } from '@/synth/radiation'
export {
  SpectralShape,
  Biquad,
  buildHighShelfCutCoeffs,
  buildPeakingNotchCoeffs,
  type BiquadCoeffs,
} from '@/synth/spectral-shape'
export { encodeWav, type WavInput } from '@/synth/wav'
export {
  synthesizeConsonantVowel,
  type SynthesizeConsonantVowelInput,
} from '@/synth/consonant'
export {
  synthesizeArticulatoryCv,
  type SynthesizeArticulatoryCvInput,
} from '@/synth/articulatory-synth'
export {
  articulationFor,
  type ConsonantArticulation,
} from '@/synth/consonant-articulations'
export {
  FormantResonator,
  CascadeFormantBank,
  ParallelFormantBank,
} from '@/synth/formant'
export {
  buildTrajectory,
  interpolateFrame,
  hasTrajectory,
  type FormantFrame,
} from '@/synth/formant-trajectories'
export {
  synthesizeFormantCv,
  type SynthesizeFormantCvInput,
} from '@/synth/formant-synth'
export { NoiseSource, type NoiseSourceConfig } from '@/synth/noise-source'
export { AntiResonator } from '@/synth/anti-resonator'
export {
  KlattSource,
  type KlattSourceAmplitudes,
  type KlattSourceInputs,
  type KlattSourceOutputs,
} from '@/synth/klatt-source'
export {
  KLATT_CONSONANTS,
  buildKlattTrajectory,
  interpolateKlattFrame,
  hasKlattSpec,
  type KlattFrame,
  type FormantSpec,
  type ParallelFormantSpec,
  type SourceMix,
} from '@/synth/klatt-trajectories'
export {
  synthesizeKlattCv,
  type SynthesizeKlattCvInput,
} from '@/synth/klatt-synth'
