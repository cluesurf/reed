// SPDX-License-Identifier: GPL-3.0-or-later

import type { Phone } from '@/types/phone'
import type { Syllable, SyllableWeight } from '@/types/utterance'

/**
 * Default syllabifier used by parse when no phonology
 * is supplied. Walks the phone stream; every vowel cluster
 * is a nucleus; preceding consonants attach as onset
 * (with the Maximum Onset Principle deferring to the next
 * nucleus), following consonants attach as coda.
 *
 * Syllabic consonants (Phone.features.syllabic === true)
 * can act as a nucleus.
 *
 * Returns an array of Syllables in left-to-right order.
 *
 * This is the sonority-fallback path described in
 * `note/library/reed/syllable.md`. The phonology-aware
 * pattern-based segmenter lands in a later phase.
 */

export function syllabifyDefault(phones: Phone[]): Syllable[] {
  if (phones.length === 0) return []

  // Find nucleus positions (indices of vowels or syllabic
  // consonants). Adjacent vowels merge into one nucleus —
  // we record only the FIRST index of each contiguous
  // vowel run, since the diphthong-tail logic below picks
  // up the rest.
  const nucleusIndices: number[] = []
  let prevWasVowel = false
  for (let i = 0; i < phones.length; i += 1) {
    const p = phones[i]!
    const isVowel = p.features.kind === 'vowel'
    const isSyllabicC = p.features.syllabic === true
    if (isSyllabicC) {
      nucleusIndices.push(i)
      prevWasVowel = false
      continue
    }
    if (isVowel) {
      if (!prevWasVowel) nucleusIndices.push(i)
      prevWasVowel = true
    } else {
      prevWasVowel = false
    }
  }

  // Edge case: no vowel + no syllabic consonant. Treat the
  // whole phone run as one onsetless / nucleusless / coda-
  // less syllable so we don't lose phones silently. This
  // matches Talk's permissive handling — Nuxalk-style
  // consonant-only words still produce a single syllable
  // with all phones in the onset.
  if (nucleusIndices.length === 0) {
    return [emptyNucleusSyllable(phones)]
  }

  const syllables: Syllable[] = []
  for (let n = 0; n < nucleusIndices.length; n += 1) {
    const nucleusIdx = nucleusIndices[n]!
    const prevNucleusIdx = n > 0 ? nucleusIndices[n - 1]! : -1
    const nextNucleusIdx =
      n < nucleusIndices.length - 1
        ? nucleusIndices[n + 1]!
        : phones.length

    // Onset: consonants between the previous nucleus's
    // boundary and this nucleus. We use the Maximum
    // Onset Principle: every consonant that COULD attach
    // as onset to the next nucleus does.
    //
    // First nucleus: take everything from start.
    // Subsequent nuclei: take everything from after the
    // previous nucleus.
    const onsetStart = prevNucleusIdx + 1
    // ... but we have to split the run between previous
    // syllable's coda and this syllable's onset. v1 rule:
    // MOP — all medial consonants go to onset; the
    // previous syllable gets no coda.
    //
    // For the LAST syllable, all trailing consonants are
    // coda (no following nucleus to attract them).
    let onsetEnd: number
    if (n === 0) {
      // First nucleus: onset is everything up to it.
      onsetEnd = nucleusIdx
    } else {
      // MOP: everything from the previous nucleus's
      // boundary up to this nucleus is onset.
      onsetEnd = nucleusIdx
    }

    const onset = phones.slice(onsetStart, onsetEnd)

    // Nucleus: just the one phone at nucleusIdx, plus any
    // immediately-following vowels (diphthong tail).
    let nucleusEnd = nucleusIdx + 1
    while (
      nucleusEnd < nextNucleusIdx &&
      nucleusEnd < phones.length &&
      phones[nucleusEnd]!.features.kind === 'vowel'
    ) {
      nucleusEnd += 1
    }
    const nucleus = phones.slice(nucleusIdx, nucleusEnd)

    // Coda: phones between nucleus end and the next
    // nucleus's onset. Empty unless this is the last
    // syllable.
    const coda =
      n === nucleusIndices.length - 1
        ? phones.slice(nucleusEnd, phones.length)
        : []

    const stress = nucleus.some(p => p.features.tense === true)
      ? 'primary'
      : null
    const tone = nucleus[0]?.features.tone

    const weight = computeWeight({ nucleus, coda })

    const start = onset[0]?.source.start ?? nucleus[0]!.source.start
    const end =
      coda[coda.length - 1]?.source.end ??
      nucleus[nucleus.length - 1]!.source.end

    syllables.push({
      onset,
      nucleus,
      coda,
      stress,
      tone,
      weight,
      source: { start, end },
    })
  }

  return syllables
}

function emptyNucleusSyllable(phones: Phone[]): Syllable {
  const start = phones[0]!.source.start
  const end = phones[phones.length - 1]!.source.end
  return {
    onset: phones,
    nucleus: [],
    coda: [],
    stress: null,
    weight: 'light',
    source: { start, end },
  }
}

function computeWeight(input: {
  nucleus: Phone[]
  coda: Phone[]
}): SyllableWeight {
  const { nucleus, coda } = input
  const hasLongVowel =
    nucleus.some(p => p.features.long === true) || nucleus.length > 1
  const hasCoda = coda.length > 0
  if (hasLongVowel && hasCoda) return 'superheavy'
  if (hasLongVowel || hasCoda) return 'heavy'
  return 'light'
}
