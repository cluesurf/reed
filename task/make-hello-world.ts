// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * "hello world" demo — synthesized as a CONTINUOUS PHONE
 * SEQUENCE via `synthesizeSequence()`. No CV-pair chunks,
 * no schwa carriers for the trailing consonants, no
 * per-render boundary envelopes choking the flow.
 *
 * Talk encoding: `hElo wOu$ld`
 *   h E   l o      →  /h ɛ l o/    "hello"
 *   w O u$ l d     →  /w ɔ ɹ l d/  "world" with English
 *                                  approximant /ɹ/.
 *
 * The sequence renderer builds one long keyframe
 * trajectory through the Klatt synth — articulators
 * (formants) glide smoothly between targets, filter state
 * carries across phone boundaries, no clicks or amplitude
 * dips at internal boundaries.
 *
 * Writes:
 *   base/test/hello-world.wav
 *
 * Usage from deck/reed/:
 *   tsx task/make-hello-world.ts
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { synthesizeSequence, encodeWav, type SequencePhone } from '@/synth'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = resolve(HERE, '../base/test')

const SAMPLE_RATE = 24_000

/**
 * Talk-encoded "hElo wOu$ld" expanded to per-phone
 * targets with naturalistic English durations:
 *
 *   /h/    glottal aspiration, brief
 *   /ɛ/    stressed vowel ("E" → 'e' in reed's mapping)
 *   /l/    light /l/, voiced sonorant
 *   /o/    stressed vowel
 *   silence inter-word pause
 *   /w/    labial-velar glide
 *   /ɔ/    rounded vowel ("O" → 'o' in reed's mapping)
 *   /ɹ/    English approximant (Talk `u$`)
 *   /l/    light /l/
 *   /d/    final alveolar stop with brief closure + release
 *
 * Durations are realistic conversational rates: stressed
 * vowels ~150-180 ms, consonants 60-110 ms, /d/ closure
 * + release ~120 ms.
 */

const PHONES: SequencePhone[] = [
  { kind: 'consonant', sym: 'h',  duration: 0.08 },
  { kind: 'vowel',     sym: 'e',  duration: 0.16 },
  { kind: 'consonant', sym: 'l',  duration: 0.07 },
  { kind: 'vowel',     sym: 'o',  duration: 0.20 },
  { kind: 'silence',                duration: 0.13 },
  { kind: 'consonant', sym: 'w',  duration: 0.09 },
  { kind: 'vowel',     sym: 'o',  duration: 0.16 },
  { kind: 'consonant', sym: 'u$', duration: 0.09 },
  { kind: 'consonant', sym: 'l',  duration: 0.07 },
  { kind: 'consonant', sym: 'd',  duration: 0.14 },
]

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true })

  const samples = synthesizeSequence({
    phones: PHONES,
    sampleRate: SAMPLE_RATE,
    frequency: 125,
    tenseness: 0.6,
  })

  const wav = encodeWav({ samples, sampleRate: SAMPLE_RATE })
  const path = resolve(OUT_DIR, 'hello-world.wav')
  writeFileSync(path, wav)
  console.log(
    `[hello-world] wrote ${path} (${samples.length} samples, ${(
      wav.length / 1024
    ).toFixed(1)} KB, ${(samples.length / SAMPLE_RATE).toFixed(2)} s)`,
  )
}

main().catch(error => {
  console.error('[hello-world] failed:', error)
  process.exit(1)
})
