// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Dump the measured formants for each cardinal vowel so
 * we can recalibrate the formant-extraction test tolerances
 * AND the per-vowel diameter presets.
 *
 * Usage: tsx task/inspect-formants.ts
 */

import { synthesizeVowel } from '@/synth'

const SAMPLE_RATE = 24_000

function computeFFT(samples: Float32Array): { mag: Float32Array; freqs: Float32Array } {
  const N = samples.length
  const mag = new Float32Array(N / 2)
  const freqs = new Float32Array(N / 2)
  for (let k = 0; k < N / 2; k += 1) {
    let re = 0
    let im = 0
    for (let n = 0; n < N; n += 1) {
      const angle = (-2 * Math.PI * k * n) / N
      re += samples[n]! * Math.cos(angle)
      im += samples[n]! * Math.sin(angle)
    }
    mag[k] = Math.sqrt(re * re + im * im)
    freqs[k] = (k * SAMPLE_RATE) / N
  }
  return { mag, freqs }
}

function applyHann(input: Float32Array): Float32Array {
  const N = input.length
  const out = new Float32Array(N)
  for (let n = 0; n < N; n += 1) {
    const w = 0.5 * (1 - Math.cos((2 * Math.PI * n) / (N - 1)))
    out[n] = input[n]! * w
  }
  return out
}

function analyzeVowel(vowel: 'i' | 'e' | 'a' | 'o' | 'u'): void {
  const samples = synthesizeVowel({
    vowel,
    duration: 0.4,
    sampleRate: SAMPLE_RATE,
    frequency: 110,
    tenseness: 0.6,
  })
  const start = Math.floor(0.1 * SAMPLE_RATE)
  const N = 4096
  const slice = applyHann(samples.subarray(start, start + N))
  const { mag, freqs } = computeFFT(slice)

  // Smooth.
  const binWidth = freqs[1]! - freqs[0]!
  const smoothBins = Math.max(1, Math.round(120 / binWidth))
  const smooth = new Float32Array(mag.length)
  for (let i = 0; i < mag.length; i += 1) {
    let s = 0
    let c = 0
    for (let j = -smoothBins; j <= smoothBins; j += 1) {
      const k = i + j
      if (k < 0 || k >= mag.length) continue
      s += mag[k]!
      c += 1
    }
    smooth[i] = s / c
  }

  // Top peaks in 150-3500 Hz, sorted by magnitude.
  const lower = Math.max(1, Math.floor(150 / binWidth))
  const upper = Math.min(smooth.length - 1, Math.ceil(3500 / binWidth))
  type Peak = { freq: number; mag: number }
  const peaks: Peak[] = []
  for (let i = lower + 1; i < upper - 1; i += 1) {
    const v = smooth[i]!
    if (v > smooth[i - 1]! && v > smooth[i + 1]!) {
      peaks.push({ freq: freqs[i]!, mag: v })
    }
  }
  peaks.sort((a, b) => b.mag - a.mag)
  const top5 = peaks.slice(0, 5).sort((a, b) => a.freq - b.freq)

  console.log(`\n${vowel.toUpperCase()}  top 5 peaks (sorted by freq):`)
  for (const p of top5) {
    console.log(`    ${p.freq.toFixed(0).padStart(5)} Hz   mag ${p.mag.toFixed(2)}`)
  }
}

for (const v of ['i', 'e', 'a', 'o', 'u'] as const) {
  analyzeVowel(v)
}
