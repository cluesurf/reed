// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import {
  PHONOLOGIES,
  english,
  spanish,
  arabic,
  hindi,
  mandarin,
} from '@/phonology'
import { parse, ReedParseError } from '@/parse'

describe('phonology registry', () => {
  it('exposes all v1 baseline languages', () => {
    expect(Object.keys(PHONOLOGIES).sort()).toEqual(
      ['ar', 'en', 'es', 'hi', 'zh'].sort(),
    )
  })

  it('keys match the canonical exports', () => {
    expect(PHONOLOGIES.en).toBe(english)
    expect(PHONOLOGIES.es).toBe(spanish)
    expect(PHONOLOGIES.ar).toBe(arabic)
    expect(PHONOLOGIES.hi).toBe(hindi)
    expect(PHONOLOGIES.zh).toBe(mandarin)
  })

  it('every phonology has a non-empty inventory', () => {
    for (const [code, ph] of Object.entries(PHONOLOGIES)) {
      expect(ph.phones.length, `${code} should have phones`).toBeGreaterThan(0)
      expect(ph.name, `${code} should have a name`).toBeTruthy()
    }
  })

  it('every phonology is frozen', () => {
    for (const ph of Object.values(PHONOLOGIES)) {
      expect(Object.isFrozen(ph)).toBe(true)
    }
  })

  it('no phonology has duplicate Talk glyphs', () => {
    for (const [code, ph] of Object.entries(PHONOLOGIES)) {
      const seen = new Set<string>()
      for (const p of ph.phones) {
        expect(
          seen.has(p.talk),
          `${code} has duplicate glyph ${p.talk}`,
        ).toBe(false)
        seen.add(p.talk)
      }
    }
  })
})

describe('Spanish phonology', () => {
  it('has the five-vowel system', () => {
    const talks = new Set(spanish.phones.map(p => p.talk))
    for (const v of ['a', 'e', 'i', 'o', 'u']) {
      expect(talks.has(v), `missing ${v}`).toBe(true)
    }
  })

  it('includes the jota /x/', () => {
    const talks = new Set(spanish.phones.map(p => p.talk))
    expect(talks.has('x')).toBe(true)
  })

  it('excludes the Castilian /θ/ (no `T` in inventory)', () => {
    const talks = new Set(spanish.phones.map(p => p.talk))
    expect(talks.has('T')).toBe(false)
  })

  it('parses a simple Spanish word ("pato") cleanly', () => {
    expect(() => parse('pato', { phonology: spanish })).not.toThrow()
  })

  it('rejects English-only phonemes like /θ/', () => {
    expect(() => parse('Tap', { phonology: spanish })).toThrow(ReedParseError)
  })
})

describe('Arabic phonology', () => {
  it('includes the pharyngeals /ħ/ and /ʕ/', () => {
    const talks = new Set(arabic.phones.map(p => p.talk))
    expect(talks.has('H')).toBe(true)
    expect(talks.has('Q')).toBe(true)
  })

  it('includes the uvular /q/ as `K`', () => {
    const talks = new Set(arabic.phones.map(p => p.talk))
    expect(talks.has('K')).toBe(true)
  })

  it('uses the three-vowel system /a i u/', () => {
    const talks = new Set(arabic.phones.map(p => p.talk))
    expect(talks.has('a')).toBe(true)
    expect(talks.has('i')).toBe(true)
    expect(talks.has('u')).toBe(true)
    expect(talks.has('e')).toBe(false)
    expect(talks.has('o')).toBe(false)
  })

  it('parses a simple Arabic word ("kataba") cleanly', () => {
    expect(() => parse('kataba', { phonology: arabic })).not.toThrow()
  })
})

describe('Hindi phonology', () => {
  it('includes the schwa /ə/ (Talk `@`)', () => {
    const talks = new Set(hindi.phones.map(p => p.talk))
    expect(talks.has('@')).toBe(true)
  })

  it('includes the palatal affricates /tʃ/ and /dʒ/', () => {
    const talks = new Set(hindi.phones.map(p => p.talk))
    expect(talks.has('ch')).toBe(true)
    expect(talks.has('j')).toBe(true)
  })

  it('parses a simple Hindi word ("pan") cleanly', () => {
    expect(() => parse('pan', { phonology: hindi })).not.toThrow()
  })

  it('parses aspirated stops (modifier-based)', () => {
    // `kh~i` = aspirated k + i. Tokenizer treats `kh~` as
    // /k/ + aspiration modifier; the base /k/ is in the
    // Hindi inventory.
    expect(() => parse('kh~i', { phonology: hindi })).not.toThrow()
  })
})

describe('Mandarin phonology', () => {
  it('includes the velar nasal /ŋ/ (Talk `q`)', () => {
    const talks = new Set(mandarin.phones.map(p => p.talk))
    expect(talks.has('q')).toBe(true)
  })

  it('includes the alveolar affricate /ts/ (Talk `tx`)', () => {
    const talks = new Set(mandarin.phones.map(p => p.talk))
    expect(talks.has('tx')).toBe(true)
  })

  it('excludes voiced stops /b d g/ (no voicing contrast in Mandarin)', () => {
    const talks = new Set(mandarin.phones.map(p => p.talk))
    expect(talks.has('b')).toBe(false)
    expect(talks.has('d')).toBe(false)
    expect(talks.has('g')).toBe(false)
  })

  it('parses a simple Mandarin word ("ma") cleanly', () => {
    expect(() => parse('ma', { phonology: mandarin })).not.toThrow()
  })

  it('parses a syllable with a tone mark ("ma+")', () => {
    expect(() => parse('ma+', { phonology: mandarin })).not.toThrow()
  })
})

describe('cross-language parse behavior', () => {
  it('rejects /q/ in Spanish (no velar nasal in coda)', () => {
    expect(() => parse('paq', { phonology: spanish })).toThrow(ReedParseError)
  })

  it('rejects /T/ in Mandarin', () => {
    expect(() => parse('Ti', { phonology: mandarin })).toThrow(ReedParseError)
  })

  it('rejects pharyngeal /H/ in English', () => {
    expect(() => parse('Hap', { phonology: english })).toThrow(ReedParseError)
  })

  it('accepts /k a t/ across all phonologies', () => {
    // /k/, /a/, /t/ exist in all five v1 baseline
    // languages (Arabic notably lacks /p/, so we use a
    // commonly-shared CVC instead).
    for (const ph of Object.values(PHONOLOGIES)) {
      expect(() => parse('kat', { phonology: ph })).not.toThrow()
    }
  })
})
