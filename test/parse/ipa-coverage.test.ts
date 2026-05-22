// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import { tokenize } from '@/parse/tokenize'
import { deriveFeatures } from '@/parse/features'
import type { Phone } from '@/types/phone'

/**
 * Verify the full IPA chart is encodable in Talk.
 *
 * Each entry below pairs an IPA phoneme with its Talk
 * encoding and the structured features that should fall
 * out of the parser. If any pairing breaks, this is the
 * single test surface to inspect.
 *
 * The encoding convention is documented in
 * note/library/reed/talk-ipa-mapping.md.
 */

function parsePhone(input: string): Phone {
  const tokens = tokenize(input)
  const phone = tokens.find((t): t is Extract<typeof t, { kind: 'phone' }> => t.kind === 'phone')
  if (!phone) throw new Error(`no phone token from "${input}"`)
  return phone.phone
}

describe('IPA pulmonic consonant chart coverage', () => {
  // Plosives ----------------------------------------------
  describe('plosives', () => {
    it.each([
      ['p', 'p', 'bilabial', false],
      ['b', 'b', 'bilabial', true],
      ['t', 't', 'alveolar', false],
      ['d', 'd', 'alveolar', true],
      ['c', 'c', 'palatal', false],
      ['J', 'J', 'palatal', true],
      ['k', 'k', 'velar', false],
      ['g', 'g', 'velar', true],
      ['K', 'K', 'uvular', false],
      ["'", "'", 'glottal', false],
    ])('IPA plosive %s → Talk %s at %s', (ipa, talk, site, voiced) => {
      const phone = parsePhone(talk)
      expect(phone.talk).toBe(talk)
      expect(phone.features.kind).toBe('consonant')
      expect(phone.features.site).toBe(site)
      expect(phone.features.mold).toBe('plosive')
      expect(phone.features.voiced).toBe(voiced)
    })
  })

  // Nasals ------------------------------------------------
  describe('nasals', () => {
    it.each([
      ['m', 'bilabial'],
      ['M', 'labiodental'],
      ['n', 'alveolar'],
      ['N', 'palatal'],
      ['q', 'velar'],
    ])('nasal %s at %s', (talk, site) => {
      const phone = parsePhone(talk)
      expect(phone.features.kind).toBe('consonant')
      expect(phone.features.mold).toBe('nasal')
      expect(phone.features.site).toBe(site)
      expect(phone.features.voiced).toBe(true)
    })
  })

  // Fricatives --------------------------------------------
  describe('fricatives', () => {
    it.each([
      ['F', 'bilabial', false],
      ['B', 'bilabial', true],
      ['f', 'labiodental', false],
      ['v', 'labiodental', true],
      ['T', 'dental', false],
      ['D', 'dental', true],
      ['s', 'alveolar', false],
      ['z', 'alveolar', true],
      ['sh', 'postalveolar', false],
      ['zh', 'postalveolar', true],
      ['C', 'palatal', false],
      ['Z', 'palatal', true],
      ['x', 'velar', false],
      ['G', 'velar', true],
      ['X', 'uvular', false],
      ['H', 'pharyngeal', false],
      ['Q', 'pharyngeal', true],
      ['h', 'glottal', false],
    ])('fricative %s at %s', (talk, site, voiced) => {
      const phone = parsePhone(talk)
      expect(phone.features.kind).toBe('consonant')
      expect(['fricative', 'sibilant']).toContain(phone.features.mold)
      expect(phone.features.site).toBe(site)
      expect(phone.features.voiced).toBe(voiced)
    })
  })

  // Affricates --------------------------------------------
  describe('affricates', () => {
    it.each([
      ['tx', 'alveolar', false],
      ['dj', 'alveolar', true],
      ['ch', 'postalveolar', false],
      ['j', 'postalveolar', true],
    ])('affricate %s', (talk, site, voiced) => {
      const phone = parsePhone(talk)
      expect(phone.features.mold).toBe('affricate')
      expect(phone.features.site).toBe(site)
      expect(phone.features.voiced).toBe(voiced)
    })
  })

  // Approximants ------------------------------------------
  describe('approximants', () => {
    it.each([
      ['V', 'labiodental'],
      ['y', 'palatal'],
      ['w', 'velar'],
    ])('approximant %s at %s', (talk, site) => {
      const phone = parsePhone(talk)
      expect(phone.features.mold).toBe('approximant')
      expect(phone.features.site).toBe(site)
    })
  })

  // Lateral approximants ----------------------------------
  it('alveolar lateral /l/', () => {
    expect(parsePhone('l').features.mold).toBe('lateral-approximant')
  })

  it('palatal lateral /ʎ/ = L', () => {
    const phone = parsePhone('L')
    expect(phone.features.mold).toBe('lateral-approximant')
    expect(phone.features.site).toBe('palatal')
  })

  // Trills / taps -----------------------------------------
  it('alveolar trill /r/', () => {
    const phone = parsePhone('r')
    expect(phone.features.mold).toBe('trill')
    expect(phone.features.site).toBe('alveolar')
  })

  it('uvular trill /ʀ/ = R', () => {
    const phone = parsePhone('R')
    expect(phone.features.mold).toBe('trill')
    expect(phone.features.site).toBe('uvular')
  })
})

describe('IPA non-pulmonic consonants (via modifiers)', () => {
  it('aspirated /pʰ/ via h~', () => {
    const phone = parsePhone('ph~')
    expect(phone.features.aspirated).toBe(true)
    expect(phone.features.site).toBe('bilabial')
    expect(phone.features.mold).toBe('plosive')
  })

  it('palatalized /tʲ/ via y~', () => {
    const phone = parsePhone('ty~')
    expect(phone.features.palatalized).toBe(true)
  })

  it('labialized /kʷ/ via w~', () => {
    const phone = parsePhone('kw~')
    expect(phone.features.labialized).toBe(true)
  })

  it('velarized /tˠ/ via G~', () => {
    const phone = parsePhone('tG~')
    expect(phone.features.velarized).toBe(true)
  })

  it('pharyngealized /tˤ/ via Q~', () => {
    const phone = parsePhone('tQ~')
    expect(phone.features.pharyngealized).toBe(true)
  })

  it('retroflex /ʈ/ via R~', () => {
    const phone = parsePhone('tR~')
    expect(phone.features.retroflex).toBe(true)
    expect(phone.features.site).toBe('alveolar') // base /t/
  })

  it('ejective /pʼ/ via ! (not at EOF)', () => {
    const phone = parsePhone('p!a')
    expect(phone.features.ejective).toBe(true)
  })
})

describe('IPA vowel chart coverage', () => {
  it.each([
    ['i', 'close', 'front', false],
    ['I', 'near-close', 'front', false],
    ['u', 'close', 'back', true],
    ['U', 'near-close', 'back', true],
    ['e', 'close-mid', 'front', false],
    ['o', 'close-mid', 'back', true],
    ['E', 'open-mid', 'front', false],
    ['O', 'open-mid', 'back', true],
    ['a', 'open', 'central', false],
    ['A', 'near-open', 'front', false],
    ['@', 'mid', 'central', false],
  ])('vowel %s → height=%s backness=%s rounded=%s', (glyph, height, backness, rounded) => {
    const phone = parsePhone(glyph)
    expect(phone.features.kind).toBe('vowel')
    expect(phone.features.height).toBe(height)
    expect(phone.features.backness).toBe(backness)
    expect(phone.features.rounded).toBe(rounded)
  })

  it('rounded front vowel /y/ via i + w~ modifier', () => {
    const phone = parsePhone('iw~')
    expect(phone.features.kind).toBe('vowel')
    expect(phone.features.height).toBe('close')
    expect(phone.features.backness).toBe('front')
    expect(phone.features.labialized).toBe(true)
  })

  it('unrounded back vowel /ɯ/ via u + G~ modifier (velarized = pull back)', () => {
    const phone = parsePhone('uG~')
    expect(phone.features.kind).toBe('vowel')
    expect(phone.features.velarized).toBe(true)
  })
})

describe('deriveFeatures defaults', () => {
  it('unknown consonant glyph falls back to kind=consonant', () => {
    const f = deriveFeatures({ glyph: 'Y', modifiers: {} })
    expect(f.kind).toBe('consonant')
  })

  it('unknown vowel-shaped glyph falls back to kind=vowel', () => {
    const f = deriveFeatures({ glyph: 'AA', modifiers: {} })
    expect(f.kind).toBe('vowel')
  })

  it('schwa @ derives as vowel', () => {
    const f = deriveFeatures({ glyph: '@', modifiers: {} })
    expect(f.kind).toBe('vowel')
    expect(f.height).toBe('mid')
  })
})
