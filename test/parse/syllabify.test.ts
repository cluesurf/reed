// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import { syllabifyDefault } from '@/parse/syllabify'
import type { Phone } from '@/types/phone'

function phone(
  talk: string,
  kind: 'consonant' | 'vowel',
  start: number,
  end: number,
): Phone {
  return {
    talk,
    raw: talk,
    features: { kind },
    source: { start, end },
  }
}

describe('syllabifyDefault', () => {
  it('returns one syllable for a single CV', () => {
    const phones = [
      phone('t', 'consonant', 0, 1),
      phone('a', 'vowel', 1, 2),
    ]
    const syllables = syllabifyDefault(phones)
    expect(syllables).toHaveLength(1)
    expect(syllables[0]!.onset.map(p => p.talk)).toEqual(['t'])
    expect(syllables[0]!.nucleus.map(p => p.talk)).toEqual(['a'])
    expect(syllables[0]!.coda).toHaveLength(0)
  })

  it('attaches a final consonant as coda on a single syllable', () => {
    const phones = [
      phone('t', 'consonant', 0, 1),
      phone('a', 'vowel', 1, 2),
      phone('p', 'consonant', 2, 3),
    ]
    const syllables = syllabifyDefault(phones)
    expect(syllables).toHaveLength(1)
    expect(syllables[0]!.coda.map(p => p.talk)).toEqual(['p'])
  })

  it('applies Maximum Onset Principle on medial consonants', () => {
    // tapa → ta.pa (the medial /p/ becomes onset of the
    // second syllable rather than coda of the first).
    const phones = [
      phone('t', 'consonant', 0, 1),
      phone('a', 'vowel', 1, 2),
      phone('p', 'consonant', 2, 3),
      phone('a', 'vowel', 3, 4),
    ]
    const syllables = syllabifyDefault(phones)
    expect(syllables).toHaveLength(2)
    expect(syllables[0]!.onset.map(p => p.talk)).toEqual(['t'])
    expect(syllables[0]!.coda).toHaveLength(0)
    expect(syllables[1]!.onset.map(p => p.talk)).toEqual(['p'])
    expect(syllables[1]!.nucleus.map(p => p.talk)).toEqual(['a'])
  })

  it('groups adjacent vowels into a single nucleus', () => {
    // ai → one syllable with both vowels in the nucleus.
    const phones = [
      phone('a', 'vowel', 0, 1),
      phone('i', 'vowel', 1, 2),
    ]
    const syllables = syllabifyDefault(phones)
    expect(syllables).toHaveLength(1)
    expect(syllables[0]!.nucleus.map(p => p.talk)).toEqual(['a', 'i'])
  })

  it('assigns light weight to open CV syllables', () => {
    const phones = [
      phone('t', 'consonant', 0, 1),
      phone('a', 'vowel', 1, 2),
    ]
    const syllables = syllabifyDefault(phones)
    expect(syllables[0]!.weight).toBe('light')
  })

  it('assigns heavy weight to CVC syllables', () => {
    const phones = [
      phone('t', 'consonant', 0, 1),
      phone('a', 'vowel', 1, 2),
      phone('p', 'consonant', 2, 3),
    ]
    const syllables = syllabifyDefault(phones)
    expect(syllables[0]!.weight).toBe('heavy')
  })

  it('handles vowel-only input', () => {
    const phones = [phone('a', 'vowel', 0, 1)]
    const syllables = syllabifyDefault(phones)
    expect(syllables).toHaveLength(1)
    expect(syllables[0]!.onset).toHaveLength(0)
    expect(syllables[0]!.nucleus.map(p => p.talk)).toEqual(['a'])
  })

  it('handles consonant-only input (no nucleus) gracefully', () => {
    const phones = [
      phone('p', 'consonant', 0, 1),
      phone('s', 'consonant', 1, 2),
      phone('t', 'consonant', 2, 3),
    ]
    const syllables = syllabifyDefault(phones)
    expect(syllables).toHaveLength(1)
    expect(syllables[0]!.onset.map(p => p.talk)).toEqual(['p', 's', 't'])
    expect(syllables[0]!.nucleus).toHaveLength(0)
  })

  it('treats a syllabic consonant as a nucleus', () => {
    const syllabicN: Phone = {
      talk: 'n',
      raw: 'n@',
      features: { kind: 'consonant', syllabic: true },
      source: { start: 0, end: 2 },
    }
    const phones = [
      phone('b', 'consonant', 0, 1),
      syllabicN,
    ]
    const syllables = syllabifyDefault(phones)
    expect(syllables).toHaveLength(1)
    expect(syllables[0]!.nucleus.map(p => p.talk)).toEqual(['n'])
    expect(syllables[0]!.nucleus[0]!.features.syllabic).toBe(true)
  })
})
