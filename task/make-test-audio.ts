// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Generate sample audio files into `deck/reed/base/test/`.
 *
 * Each invocation renders one short WAV per cardinal
 * vowel at a default pitch. The point is to have an
 * audible sanity check on the synth — run the script, open
 * the produced WAVs, hear vowel-like sounds.
 *
 * Run from `deck/reed/`:
 *
 *   pnpm tsx task/make-test-audio.ts
 *
 * Writes:
 *
 *   base/test/vowel-i.wav
 *   base/test/vowel-e.wav
 *   base/test/vowel-a.wav
 *   base/test/vowel-o.wav
 *   base/test/vowel-u.wav
 *   base/test/vowel-schwa.wav
 *
 * Optional positional arguments override the duration
 * (seconds) and pitch (Hz):
 *
 *   pnpm tsx task/make-test-audio.ts 1.5 200
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { synthesizeVowel, encodeWav, type VowelKey } from '@/synth'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = resolve(HERE, '../base/test')

const VOWELS: VowelKey[] = ['i', 'e', 'a', 'o', 'u', 'schwa']

async function main(): Promise<void> {
  const duration = Number(process.argv[2] ?? '1.0')
  const frequency = Number(process.argv[3] ?? '120')

  mkdirSync(OUT_DIR, { recursive: true })

  for (const vowel of VOWELS) {
    const samples = synthesizeVowel({
      vowel,
      duration,
      frequency,
      sampleRate: 24_000,
    })
    const wav = encodeWav({ samples, sampleRate: 24_000 })
    const path = resolve(OUT_DIR, `vowel-${vowel}.wav`)
    writeFileSync(path, wav)
    console.log(
      `[make-test-audio] wrote ${path} (${samples.length} samples, ${(wav.length / 1024).toFixed(1)} KB)`,
    )
  }

  // Optionally, a chained-vowel demo: walk through the
  // five cardinals so the listener can hear the formant
  // transitions reed's tract produces.
  const segmentDuration = duration / 5
  const segmentSamples = Math.floor(segmentDuration * 24_000)
  const combined = new Float32Array(segmentSamples * 5)
  for (let v = 0; v < 5; v += 1) {
    const seg = synthesizeVowel({
      vowel: VOWELS[v]!,
      duration: segmentDuration,
      frequency,
      sampleRate: 24_000,
    })
    combined.set(seg.subarray(0, segmentSamples), v * segmentSamples)
  }
  const combinedWav = encodeWav({ samples: combined, sampleRate: 24_000 })
  const combinedPath = resolve(OUT_DIR, 'vowels-chained.wav')
  writeFileSync(combinedPath, combinedWav)
  console.log(`[make-test-audio] wrote ${combinedPath}`)
}

main().catch(error => {
  console.error('[make-test-audio] failed:', error)
  process.exit(1)
})
