// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Generate one CV (consonant + /a/) audio file per
 * consonant in our IPA-coverage table.
 *
 * Outputs to `deck/reed/base/test/`:
 *
 *   consonant-p.wav, consonant-b.wav, ...
 *   consonants-chained.wav  — all in canonical IPA order
 *
 * Each file is the same consonant followed by the vowel
 * /a/ at ~130 Hz. Listening order matches the IPA chart
 * (place left-to-right, manner top-to-bottom).
 *
 * Usage from deck/reed/:
 *
 *   tsx task/make-test-consonants.ts
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { synthesizeConsonantVowel, encodeWav } from '@/synth'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = resolve(HERE, '../base/test')

/**
 * Demo consonant set — the 22 basic English-relevant
 * consonants in spot-check order, using talk.js's
 * canonical IPA mapping (see deck/talk.js/make/ipa.ts).
 *
 * Talk symbol → IPA:
 *   j → /ʒ/, x → /ʃ/, c → /θ/, C → /ð/, q → /ŋ/, y → /j/.
 *
 * The Klatt parameter table aliases the canonical talk.js
 * symbols to the right parameter sets internally.
 */

const CONSONANTS: ReadonlyArray<{ talk: string; slug: string }> = [
  { talk: 'm', slug: 'm' },     // /m/  bilabial nasal
  { talk: 'n', slug: 'n' },     // /n/  alveolar nasal
  { talk: 'q', slug: 'q' },     // /ŋ/  velar nasal
  { talk: 'g', slug: 'g' },     // /ɡ/  velar voiced stop
  { talk: 'd', slug: 'd' },     // /d/  alveolar voiced stop
  { talk: 'b', slug: 'b' },     // /b/  bilabial voiced stop
  { talk: 'p', slug: 'p' },     // /p/  bilabial voiceless stop
  { talk: 't', slug: 't' },     // /t/  alveolar voiceless stop
  { talk: 'k', slug: 'k' },     // /k/  velar voiceless stop
  { talk: 'h', slug: 'h' },     // /h/  glottal fricative
  { talk: 's', slug: 's' },     // /s/  alveolar fricative
  { talk: 'f', slug: 'f' },     // /f/  labiodental fricative
  { talk: 'v', slug: 'v' },     // /v/  labiodental voiced fric
  { talk: 'z', slug: 'z' },     // /z/  alveolar voiced fric
  { talk: 'j', slug: 'j' },     // /ʒ/  postalveolar voiced fric
  { talk: 'x', slug: 'x' },     // /ʃ/  postalveolar voiceless fric
  { talk: 'c', slug: 'c' },     // /θ/  voiceless dental fricative
  { talk: 'C', slug: 'C-cap' }, // /ð/  voiced dental fricative
  { talk: 'w', slug: 'w' },     // /w/  labio-velar approximant
  { talk: 'l', slug: 'l' },     // /l/  alveolar lateral
  { talk: 'r', slug: 'r' },     // /r/  alveolar trill
  { talk: 'y', slug: 'y' },     // /j/  palatal approximant
]

async function main(): Promise<void> {
  const duration = Number(process.argv[2] ?? '0.55')
  const frequency = Number(process.argv[3] ?? '130')
  const sampleRate = 24_000

  mkdirSync(OUT_DIR, { recursive: true })

  let chainTotalLength = 0
  const segments: Float32Array[] = []

  for (const { talk, slug } of CONSONANTS) {
    const samples = synthesizeConsonantVowel({
      consonant: talk,
      vowel: 'a',
      duration,
      sampleRate,
      frequency,
    })
    const wav = encodeWav({ samples, sampleRate })
    const path = resolve(OUT_DIR, `consonant-${slug}.wav`)
    writeFileSync(path, wav)
    segments.push(samples)
    chainTotalLength += samples.length
    console.log(
      `[make-test-consonants] wrote consonant-${slug}.wav (${(wav.length / 1024).toFixed(1)} KB)`,
    )
  }

  // Chained version: every consonant in canonical order,
  // separated by a brief silence so the listener can hear
  // each individually.
  const gapSamples = Math.floor(0.12 * sampleRate)
  const gap = new Float32Array(gapSamples)
  const totalWithGaps = chainTotalLength + gapSamples * (segments.length - 1)
  const chained = new Float32Array(totalWithGaps)
  let cursor = 0
  for (let i = 0; i < segments.length; i += 1) {
    chained.set(segments[i]!, cursor)
    cursor += segments[i]!.length
    if (i < segments.length - 1) {
      chained.set(gap, cursor)
      cursor += gapSamples
    }
  }
  const chainedWav = encodeWav({ samples: chained, sampleRate })
  const chainedPath = resolve(OUT_DIR, 'consonants-chained.wav')
  writeFileSync(chainedPath, chainedWav)
  console.log(`[make-test-consonants] wrote ${chainedPath}`)
}

main().catch(error => {
  console.error('[make-test-consonants] failed:', error)
  process.exit(1)
})
