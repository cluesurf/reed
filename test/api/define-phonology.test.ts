// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import { definePhonology } from '@/api/define-phonology'

describe('definePhonology', () => {
  it('builds a phonology from a name + Talk-glyph list', () => {
    const ph = definePhonology({
      name: 'tiny',
      phones: ['p', 'a', 't'],
    })
    expect(ph.name).toBe('tiny')
    expect(ph.phones).toHaveLength(3)
    expect(ph.phones.map(p => p.talk)).toEqual(['p', 'a', 't'])
  })

  it('looks up consonant features for each glyph string', () => {
    const ph = definePhonology({ name: 't', phones: ['p'] })
    expect(ph.phones[0]!.features.kind).toBe('consonant')
    expect(ph.phones[0]!.features.site).toBe('bilabial')
    expect(ph.phones[0]!.features.mold).toBe('plosive')
  })

  it('looks up vowel features for each glyph string', () => {
    const ph = definePhonology({ name: 't', phones: ['i'] })
    expect(ph.phones[0]!.features.kind).toBe('vowel')
    expect(ph.phones[0]!.features.height).toBe('close')
    expect(ph.phones[0]!.features.backness).toBe('front')
  })

  it('accepts pre-built Phone objects in the spec', () => {
    const custom = {
      talk: 'p',
      raw: 'p',
      features: { kind: 'consonant' as const, site: 'bilabial' as const },
      source: { start: 0, end: 1 },
    }
    const ph = definePhonology({ name: 'mixed', phones: [custom, 'a'] })
    expect(ph.phones[0]!.talk).toBe('p')
    expect(ph.phones[1]!.talk).toBe('a')
  })

  it('freezes the result so consumers cannot mutate', () => {
    const ph = definePhonology({ name: 'frozen', phones: ['a'] })
    expect(Object.isFrozen(ph)).toBe(true)
    expect(Object.isFrozen(ph.phones)).toBe(true)
    expect(Object.isFrozen(ph.phones[0])).toBe(true)
  })

  it('handles an empty inventory without crashing', () => {
    const ph = definePhonology({ name: 'empty', phones: [] })
    expect(ph.phones).toHaveLength(0)
  })

  it('handles Talk digraphs in the spec', () => {
    const ph = definePhonology({
      name: 'with-digraphs',
      phones: ['sh', 'ch', 'a'],
    })
    expect(ph.phones.map(p => p.talk)).toEqual(['sh', 'ch', 'a'])
  })
})
