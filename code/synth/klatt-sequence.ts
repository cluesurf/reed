// SPDX-License-Identifier: GPL-3.0-or-later

import { FormantResonator } from '@/synth/formant'
import { AntiResonator } from '@/synth/anti-resonator'
import { KlattSource } from '@/synth/klatt-source'
import { Biquad, buildLowShelfBoostCoeffs } from '@/synth/spectral-shape'
import {
  KLATT_CONSONANTS,
  interpolateKlattFrame,
  hasKlattSpec,
  type KlattFrame,
  type FormantSpec,
  type ParallelFormantSpec,
  type SourceMix,
} from '@/synth/klatt-trajectories'
import type { VowelKey } from '@/synth/vowel-shapes'

/**
 * Phone-sequence renderer.
 *
 * Takes an arbitrary sequence of phones (vowels, consonants,
 * silences) and renders ONE continuous trajectory through
 * the Klatt synth state — no per-CV resets. Articulators
 * (formants) move smoothly from each phone's target to the
 * next, like real connected speech.
 *
 * Compared to chaining `synthesizeConsonantVowel()` calls:
 *   - No per-render attack/release envelope at each phone
 *     boundary (which is what made chained CVs sound
 *     choppy).
 *   - Cascade + parallel filter state CARRIES OVER across
 *     phone boundaries — no clean restart, no clicks.
 *   - Consonants can stand alone (no schwa carrier needed
 *     for /l/ before another consonant, etc.).
 *
 * What's NOT done here (still architectural debt):
 *   - True coarticulation (anticipatory + carryover
 *     effects on adjacent phones) — that's the gesture +
 *     task-dynamics layer in `research-index.md` §6.
 *   - Per-phone duration prediction from prosody.
 *
 * For each phone we emit 1-3 keyframes:
 *   - vowel: 2 keyframes (start + steady), flat target
 *   - sonorant consonant (m,n,l,r,w,y,...): 2 keyframes
 *     at the consonant's steady source/formant state
 *   - stop / affricate: 3 keyframes (closure + burst +
 *     post-release)
 *   - fricative: 2 keyframes at the fricative source
 *   - silence: 2 zeroed keyframes
 *
 * The synth's keyframe interpolator handles the cross-
 * boundary smoothing automatically — the last frame of
 * phone N and the first frame of phone N+1 interpolate
 * linearly, so the formants glide between targets.
 */

export type SequencePhone =
  | { kind: 'vowel'; sym: VowelKey; duration: number }
  | { kind: 'consonant'; sym: string; duration: number }
  | { kind: 'silence'; duration: number }

export type SynthesizeSequenceInput = {
  phones: SequencePhone[]
  sampleRate?: number
  frequency?: number
  tenseness?: number
}

// ============== Vowel targets ==============

const VOWEL_FORMANTS: Record<
  VowelKey,
  { cascade: FormantSpec[] }
> = {
  i: {
    cascade: [
      { freq: 270, bw: 60 },
      { freq: 2290, bw: 90 },
      { freq: 3010, bw: 150 },
      { freq: 3700, bw: 200 },
      { freq: 4500, bw: 200 },
    ],
  },
  e: {
    cascade: [
      { freq: 480, bw: 60 },
      { freq: 1880, bw: 90 },
      { freq: 2632, bw: 150 },
      { freq: 3500, bw: 200 },
      { freq: 4500, bw: 200 },
    ],
  },
  a: {
    cascade: [
      { freq: 730, bw: 60 },
      { freq: 1090, bw: 90 },
      { freq: 2440, bw: 150 },
      { freq: 3400, bw: 200 },
      { freq: 4500, bw: 200 },
    ],
  },
  o: {
    cascade: [
      { freq: 555, bw: 60 },
      { freq: 819, bw: 90 },
      { freq: 2400, bw: 150 },
      { freq: 3400, bw: 200 },
      { freq: 4500, bw: 200 },
    ],
  },
  u: {
    cascade: [
      { freq: 300, bw: 60 },
      { freq: 870, bw: 90 },
      { freq: 2240, bw: 150 },
      { freq: 3300, bw: 200 },
      { freq: 4500, bw: 200 },
    ],
  },
  schwa: {
    cascade: [
      { freq: 500, bw: 60 },
      { freq: 1500, bw: 90 },
      { freq: 2500, bw: 150 },
      { freq: 3500, bw: 200 },
      { freq: 4500, bw: 200 },
    ],
  },
}

const VOWEL_SOURCE: SourceMix = {
  av: 1.0,
  avs: 0,
  ah: 0,
  af: 0,
  ab: 0,
  an: 0,
}

const SILENT_SOURCE: SourceMix = {
  av: 0,
  avs: 0,
  ah: 0,
  af: 0,
  ab: 0,
  an: 0,
}

const NEUTRAL_NASAL_POLE: FormantSpec = { freq: 270, bw: 200 }
const NEUTRAL_NASAL_ZERO: FormantSpec = { freq: 270, bw: 200 }
const NEUTRAL_NASAL_POLE2: FormantSpec = { freq: 5500, bw: 200 }
const NEUTRAL_NASAL_ZERO2: FormantSpec = { freq: 5500, bw: 200 }

function emptyParallelBank(): ParallelFormantSpec[] {
  return [
    { freq: 1500, bw: 200, amp: 0 },
    { freq: 2500, bw: 250, amp: 0 },
    { freq: 3500, bw: 300, amp: 0 },
    { freq: 4800, bw: 500, amp: 0 },
    { freq: 6000, bw: 800, amp: 0 },
  ]
}

// ============== Build trajectory ==============

function frameFromVowel(input: {
  time: number
  vowel: VowelKey
}): KlattFrame {
  const target = VOWEL_FORMANTS[input.vowel]
  return {
    time: input.time,
    source: VOWEL_SOURCE,
    tl: 0,
    cascade: target.cascade,
    parallel: emptyParallelBank(),
    nasalPole: NEUTRAL_NASAL_POLE,
    nasalZero: NEUTRAL_NASAL_ZERO,
    nasalPole2: NEUTRAL_NASAL_POLE2,
    nasalZero2: NEUTRAL_NASAL_ZERO2,
    noiseType: 'channel',
  }
}

function frameFromConsonant(input: {
  time: number
  sym: string
  useBurst?: boolean
}): KlattFrame {
  const spec = KLATT_CONSONANTS[input.sym]
  if (!spec) {
    throw new Error(`Klatt sequence: no spec for consonant '${input.sym}'`)
  }
  const source = input.useBurst && spec.burstSource ? spec.burstSource : spec.source
  const tl = input.useBurst && spec.burstTl != null ? spec.burstTl : spec.tl
  return {
    time: input.time,
    source,
    tl,
    cascade: spec.cascade,
    parallel: spec.parallel,
    nasalPole: spec.nasalPole,
    nasalZero: spec.nasalZero,
    nasalPole2: spec.nasalPole2,
    nasalZero2: spec.nasalZero2,
    noiseType: spec.noiseType ?? 'channel',
  }
}

function silenceFrame(t: number): KlattFrame {
  return {
    time: t,
    source: SILENT_SOURCE,
    tl: 0,
    cascade: VOWEL_FORMANTS.schwa.cascade,
    parallel: emptyParallelBank(),
    nasalPole: NEUTRAL_NASAL_POLE,
    nasalZero: NEUTRAL_NASAL_ZERO,
    nasalPole2: NEUTRAL_NASAL_POLE2,
    nasalZero2: NEUTRAL_NASAL_ZERO2,
    noiseType: 'channel',
  }
}

/**
 * Build a flat keyframe list across the whole sequence.
 *
 * Each phone emits keyframes at the time points where the
 * articulator targets change. Linear interpolation between
 * consecutive keyframes does the smoothing.
 */

function buildSequenceFrames(phones: SequencePhone[]): {
  frames: KlattFrame[]
  totalTime: number
} {
  const frames: KlattFrame[] = []
  let t = 0

  for (const phone of phones) {
    if (phone.kind === 'silence') {
      frames.push(silenceFrame(t))
      t += phone.duration
      frames.push(silenceFrame(t))
      continue
    }

    if (phone.kind === 'vowel') {
      // Vowel: hold at target for the whole duration.
      frames.push(frameFromVowel({ time: t, vowel: phone.sym }))
      t += phone.duration
      frames.push(frameFromVowel({ time: t, vowel: phone.sym }))
      continue
    }

    // Consonant.
    const spec = KLATT_CONSONANTS[phone.sym]
    if (!spec) {
      throw new Error(`Klatt sequence: no spec for consonant '${phone.sym}'`)
    }

    if (spec.burstSource) {
      // Stop or affricate: closure → burst → post-burst.
      // Closure for spec.holdDuration, burst for
      // spec.releaseDuration, remainder for the post-
      // burst transition (where formants and source ramp
      // toward neutrals).
      const tHoldEnd = t + Math.min(spec.holdDuration, phone.duration)
      const tBurstEnd = Math.min(
        tHoldEnd + spec.releaseDuration,
        t + phone.duration,
      )
      const tPhoneEnd = t + phone.duration

      // Closure start.
      frames.push(frameFromConsonant({ time: t, sym: phone.sym, useBurst: false }))
      // Closure end / burst start.
      frames.push(frameFromConsonant({ time: tHoldEnd, sym: phone.sym, useBurst: false }))
      // Burst peak (uses burstSource).
      frames.push(frameFromConsonant({ time: tHoldEnd, sym: phone.sym, useBurst: true }))
      // Burst end — start of post-burst.
      frames.push(frameFromConsonant({ time: tBurstEnd, sym: phone.sym, useBurst: true }))
      // Post-burst trail: source returns to a neutral
      // partially-voiced state so the next phone has
      // something to interpolate from.
      const postBurstFrame: KlattFrame = {
        ...frameFromConsonant({ time: tPhoneEnd, sym: phone.sym, useBurst: true }),
        source: { ...SILENT_SOURCE, av: 0.3 },
      }
      frames.push(postBurstFrame)

      t = tPhoneEnd
    } else {
      // Sonorant or fricative — steady source/target.
      frames.push(frameFromConsonant({ time: t, sym: phone.sym, useBurst: false }))
      t += phone.duration
      frames.push(frameFromConsonant({ time: t, sym: phone.sym, useBurst: false }))
    }
  }

  return { frames, totalTime: t }
}

// ============== Render ==============

export function synthesizeSequence(input: SynthesizeSequenceInput): Float32Array {
  const sampleRate = input.sampleRate ?? 24_000
  const frequency = input.frequency ?? 130
  const tenseness = input.tenseness ?? 0.6

  // Validate phones up front so we fail early on typos.
  for (const phone of input.phones) {
    if (phone.kind === 'consonant' && !hasKlattSpec(phone.sym)) {
      throw new Error(
        `synthesizeSequence: no Klatt spec for consonant '${phone.sym}'`,
      )
    }
  }

  const { frames, totalTime } = buildSequenceFrames(input.phones)
  const totalSamples = Math.floor(totalTime * sampleRate)
  const out = new Float32Array(totalSamples)

  // === Filter chain — same topology as synthesizeKlattCv ===
  const cascadeFormants = [
    new FormantResonator(sampleRate),
    new FormantResonator(sampleRate),
    new FormantResonator(sampleRate),
    new FormantResonator(sampleRate),
    new FormantResonator(sampleRate),
  ]
  const nasalPole = new FormantResonator(sampleRate)
  const nasalZero = new AntiResonator(sampleRate)
  const nasalPole2 = new FormantResonator(sampleRate)
  const nasalZero2 = new AntiResonator(sampleRate)
  const parallelFormants = [
    new FormantResonator(sampleRate),
    new FormantResonator(sampleRate),
    new FormantResonator(sampleRate),
    new FormantResonator(sampleRate),
    new FormantResonator(sampleRate),
  ]
  const source = new KlattSource(sampleRate)

  // Boundary envelope ONLY at the start + end of the
  // whole sequence — internal phone boundaries flow
  // continuously through the same filter state.
  const attackSamples = Math.floor(0.020 * sampleRate)
  const releaseSamples = Math.floor(0.020 * sampleRate)

  // Jitter (small per-sample formant variation) so the
  // synth doesn't ring like a pure resonator.
  let jitterPhase1 = 0
  let jitterPhase2 = Math.PI / 3
  let jitterPhase3 = Math.PI / 2
  const jitterRate1 = 4.7
  const jitterRate2 = 5.3
  const jitterRate3 = 6.1

  for (let n = 0; n < totalSamples; n += 1) {
    const t = n / sampleRate
    const frame = interpolateKlattFrame({ frames, t })

    // Formant jitter.
    jitterPhase1 += (2 * Math.PI * jitterRate1) / sampleRate
    jitterPhase2 += (2 * Math.PI * jitterRate2) / sampleRate
    jitterPhase3 += (2 * Math.PI * jitterRate3) / sampleRate
    const j1 = Math.sin(jitterPhase1) * 6
    const j2 = Math.sin(jitterPhase2) * 12
    const j3 = Math.sin(jitterPhase3) * 18

    // Configure filters.
    for (let i = 0; i < cascadeFormants.length; i += 1) {
      const f = frame.cascade[i]
      if (f) {
        const jitter = i === 0 ? j1 : i === 1 ? j2 : i === 2 ? j3 : 0
        cascadeFormants[i]!.setFrequencyBandwidth(f.freq + jitter, f.bw)
      }
    }
    nasalPole.setFrequencyBandwidth(frame.nasalPole.freq, frame.nasalPole.bw)
    nasalZero.setFrequencyBandwidth(frame.nasalZero.freq, frame.nasalZero.bw)
    nasalPole2.setFrequencyBandwidth(frame.nasalPole2.freq, frame.nasalPole2.bw)
    nasalZero2.setFrequencyBandwidth(frame.nasalZero2.freq, frame.nasalZero2.bw)
    for (let i = 0; i < parallelFormants.length; i += 1) {
      const f = frame.parallel[i]
      if (f) parallelFormants[i]!.setFrequencyBandwidth(f.freq, f.bw)
    }

    // Source.
    const sourceOut = source.process({
      seconds: t,
      frequency,
      amps: frame.source,
      tenseness,
      tl: frame.tl,
      noiseType: frame.noiseType,
    })

    // Cascade with Klatt 1980 2-pole/2-zero nasal topology.
    // First pair: zero always in cascade (parked at 270 Hz
    // so non-nasal vowels are barely affected); pole gated
    // by AN. Second pair: both zero and pole gated by AN
    // via dry/wet mix so non-nasal frames are exactly
    // bypassed (otherwise the always-on second zero cuts a
    // small slice of HF and the post-cascade peak-normalize
    // amplifies the closure noise floor).
    let cascadeSample = sourceOut.cascadeInput
    for (const f of cascadeFormants) cascadeSample = f.process(cascadeSample)
    cascadeSample = nasalZero.process(cascadeSample)
    const z2 = nasalZero2.process(cascadeSample)
    const an = frame.source.an
    cascadeSample = (1 - an) * cascadeSample + an * z2
    const nasalPoleSample = nasalPole.process(cascadeSample)
    const nasalPole2Sample = nasalPole2.process(cascadeSample)
    cascadeSample =
      cascadeSample + an * (nasalPoleSample + 0.6 * nasalPole2Sample)

    // Parallel.
    let parallelSample = 0
    for (let i = 0; i < parallelFormants.length; i += 1) {
      const spec = frame.parallel[i]
      if (!spec || spec.amp <= 0) continue
      const sign = i % 2 === 0 ? 1 : -1
      parallelSample +=
        sign * spec.amp * parallelFormants[i]!.process(sourceOut.parallelInput)
    }

    const bypassSample = sourceOut.bypassOutput
    let total = cascadeSample + parallelSample + bypassSample

    // Boundary envelope at clip ends only.
    let env = 1
    if (n < attackSamples) env = n / attackSamples
    else if (n > totalSamples - releaseSamples)
      env = (totalSamples - n) / releaseSamples

    out[n] = total * env
  }

  // === Post-processing — same as synthesizeKlattCv ===
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

  // Low-pass at 6.5 kHz (anti-metallic).
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

  // Piriform-sinus broadband notch.
  // Lateral closed-side branches at the larynx contribute
  // an antiformant around 4.5 kHz in natural voices. The
  // notch cuts the metallic shimmer in the 4-5 kHz region
  // without affecting F1-F4 vowel identity. See note/
  // library/reed/topics/piriform-sinuses.md.
  {
    const piriform = new AntiResonator(sampleRate)
    piriform.setFrequencyBandwidth(4500, 800)
    for (let n = 0; n < out.length; n += 1) {
      out[n] = piriform.process(out[n]!)
    }
  }

  // Yielding-wall warmth boost — low-shelf +3 dB below
  // 250 Hz. Models the sub-F1 lift contributed by soft-
  // tissue tract walls in natural voices. See note/
  // library/reed/topics/yielding-walls.md.
  {
    const shelf = new Biquad(
      buildLowShelfBoostCoeffs({
        sampleRate,
        cornerHz: 250,
        gainDb: 3,
      }),
    )
    for (let n = 0; n < out.length; n += 1) {
      out[n] = shelf.process(out[n]!)
    }
  }

  // Peak-normalize to 0.55.
  let peak = 0
  for (let n = 0; n < out.length; n += 1) {
    const a = Math.abs(out[n]!)
    if (a > peak) peak = a
  }
  if (peak > 0) {
    const target = 0.55
    const scale = target / peak
    for (let n = 0; n < out.length; n += 1) out[n] = out[n]! * scale
  }

  return out
}
