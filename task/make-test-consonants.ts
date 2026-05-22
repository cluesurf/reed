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
 * Canonical IPA-chart order for the consonant test files
 * — plosives first (bilabial → glottal), then nasals,
 * fricatives, affricates, approximants, laterals, trills.
 *
 * Naming convention: filename uses a safe ASCII slug
 * (e.g. `'` is named `glottal-stop`, capital letters get
 * a `-cap` suffix to avoid colliding with their lowercase
 * counterparts on case-insensitive filesystems).
 */

const CONSONANTS: ReadonlyArray<{ talk: string; slug: string }> = [
  // Plosives
  { talk: 'p', slug: 'p' },
  { talk: 'b', slug: 'b' },
  { talk: 't', slug: 't' },
  { talk: 'd', slug: 'd' },
  { talk: 'c', slug: 'c' },
  { talk: 'J', slug: 'J-cap' },
  { talk: 'k', slug: 'k' },
  { talk: 'g', slug: 'g' },
  { talk: 'K', slug: 'K-cap' },
  { talk: "'", slug: 'glottal-stop' },
  // Nasals
  { talk: 'm', slug: 'm' },
  { talk: 'M', slug: 'M-cap' },
  { talk: 'n', slug: 'n' },
  { talk: 'N', slug: 'N-cap' },
  { talk: 'q', slug: 'q' },
  // Fricatives
  { talk: 'F', slug: 'F-cap' },
  { talk: 'B', slug: 'B-cap' },
  { talk: 'f', slug: 'f' },
  { talk: 'v', slug: 'v' },
  { talk: 'T', slug: 'T-cap' },
  { talk: 'D', slug: 'D-cap' },
  { talk: 's', slug: 's' },
  { talk: 'z', slug: 'z' },
  { talk: 'sh', slug: 'sh' },
  { talk: 'zh', slug: 'zh' },
  { talk: 'C', slug: 'C-cap' },
  { talk: 'Z', slug: 'Z-cap' },
  { talk: 'x', slug: 'x' },
  { talk: 'G', slug: 'G-cap' },
  { talk: 'X', slug: 'X-cap' },
  { talk: 'H', slug: 'H-cap' },
  { talk: 'Q', slug: 'Q-cap' },
  { talk: 'h', slug: 'h' },
  // Affricates
  { talk: 'tx', slug: 'tx' },
  { talk: 'dj', slug: 'dj' },
  { talk: 'ch', slug: 'ch' },
  { talk: 'j', slug: 'j' },
  // Approximants
  { talk: 'V', slug: 'V-cap' },
  { talk: 'y', slug: 'y' },
  { talk: 'w', slug: 'w' },
  // Laterals
  { talk: 'l', slug: 'l' },
  { talk: 'L', slug: 'L-cap' },
  // Trills
  { talk: 'r', slug: 'r' },
  { talk: 'R', slug: 'R-cap' },
]

async function main(): Promise<void> {
  const duration = Number(process.argv[2] ?? '0.6')
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
