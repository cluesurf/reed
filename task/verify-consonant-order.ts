// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Quick verification dump — for each consonant in the
 * demo set, print:
 *   - slug (filename), Talk symbol, expected IPA
 *   - what the Klatt table actually has for that Talk
 *     symbol (source params, parallel-bank amps,
 *     cascade locus, hold/release timing)
 *
 * Lets us confirm the mapping from user-facing slug to
 * synth-internal parameters is what we expect, BEFORE
 * listening.
 */

import { KLATT_CONSONANTS } from '@/synth/klatt-trajectories'

const DEMO: { slug: string; talk: string; ipa: string; name: string }[] = [
  { slug: 'm', talk: 'm', ipa: 'm', name: 'bilabial nasal' },
  { slug: 'n', talk: 'n', ipa: 'n', name: 'alveolar nasal' },
  { slug: 'q', talk: 'q', ipa: 'ŋ', name: 'velar nasal' },
  { slug: 'g', talk: 'g', ipa: 'ɡ', name: 'velar voiced stop' },
  { slug: 'd', talk: 'd', ipa: 'd', name: 'alveolar voiced stop' },
  { slug: 'b', talk: 'b', ipa: 'b', name: 'bilabial voiced stop' },
  { slug: 'p', talk: 'p', ipa: 'p', name: 'bilabial voiceless stop' },
  { slug: 't', talk: 't', ipa: 't', name: 'alveolar voiceless stop' },
  { slug: 'k', talk: 'k', ipa: 'k', name: 'velar voiceless stop' },
  { slug: 'h', talk: 'h', ipa: 'h', name: 'glottal fricative' },
  { slug: 's', talk: 's', ipa: 's', name: 'alveolar fricative' },
  { slug: 'f', talk: 'f', ipa: 'f', name: 'labiodental fricative' },
  { slug: 'v', talk: 'v', ipa: 'v', name: 'labiodental voiced fric' },
  { slug: 'z', talk: 'z', ipa: 'z', name: 'alveolar voiced fric' },
  { slug: 'j', talk: 'j', ipa: 'ʒ', name: 'postalveolar voiced fric' },
  { slug: 'x', talk: 'x', ipa: 'ʃ', name: 'postalveolar voiceless fric' },
  { slug: 'c', talk: 'c', ipa: 'θ', name: 'voiceless dental fricative' },
  { slug: 'C-cap', talk: 'C', ipa: 'ð', name: 'voiced dental fricative' },
  { slug: 'w', talk: 'w', ipa: 'w', name: 'labio-velar approximant' },
  { slug: 'l', talk: 'l', ipa: 'l', name: 'alveolar lateral' },
  { slug: 'r', talk: 'r', ipa: 'r', name: 'alveolar trill' },
  { slug: 'y', talk: 'y', ipa: 'j', name: 'palatal approximant' },
]

for (const item of DEMO) {
  const spec = KLATT_CONSONANTS[item.talk]
  if (!spec) {
    console.log(`✗ ${item.slug.padEnd(8)} (${item.talk}) — MISSING in KLATT_CONSONANTS`)
    continue
  }
  const f1 = spec.cascade[0]?.freq ?? '?'
  const f2 = spec.cascade[1]?.freq ?? '?'
  const f3 = spec.cascade[2]?.freq ?? '?'
  const parallelActive = spec.parallel.filter(p => p.amp > 0).map(p => `${p.freq}Hz@${p.amp.toFixed(1)}`).join(',')
  const src = spec.source
  const srcStr = `av=${src.av} ah=${src.ah} af=${src.af} an=${src.an}`
  console.log(
    `${item.slug.padEnd(8)} ${item.talk.padEnd(2)} → ${item.ipa.padEnd(2)} (${item.name})`,
  )
  console.log(
    `   F1=${f1} F2=${f2} F3=${f3}  hold=${spec.holdDuration}s rel=${spec.releaseDuration}s`,
  )
  console.log(`   source: ${srcStr}`)
  if (parallelActive) console.log(`   parallel: ${parallelActive}`)
  if (spec.burstSource) {
    const b = spec.burstSource
    console.log(`   burst: av=${b.av} ah=${b.ah} af=${b.af} an=${b.an}`)
  }
  console.log()
}
