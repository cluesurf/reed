// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import { english } from '@/phonology/english'
import { PHONOLOGIES } from '@/phonology'

describe('English phonology', () => {
  it('exists in the registry under "en"', () => {
    expect(PHONOLOGIES.en).toBe(english)
  })

  it('has a name', () => {
    expect(english.name).toBe('english')
  })

  it('has the expected core consonants', () => {
    const talks = new Set(english.phones.map(p => p.talk))
    for (const c of [
      'p', 'b', 't', 'd', 'k', 'g',
      'm', 'n', 'q',
      'f', 'v', 'T', 'D', 's', 'z', 'sh', 'zh', 'h',
      'ch', 'j',
      'l', 'r', 'w', 'y',
    ]) {
      expect(talks.has(c), `missing consonant ${c}`).toBe(true)
    }
  })

  it('has the expected vowel inventory', () => {
    const talks = new Set(english.phones.map(p => p.talk))
    for (const v of ['i', 'I', 'e', 'E', 'a', 'A', 'o', 'O', 'u', 'U', '@']) {
      expect(talks.has(v), `missing vowel ${v}`).toBe(true)
    }
  })

  it('contains no duplicate Talk glyphs', () => {
    const seen = new Set<string>()
    for (const p of english.phones) {
      expect(seen.has(p.talk), `duplicate ${p.talk}`).toBe(false)
      seen.add(p.talk)
    }
  })

  it('has the right number of phones (35: 24 C + 11 V)', () => {
    expect(english.phones).toHaveLength(35)
  })

  it('is frozen', () => {
    expect(Object.isFrozen(english)).toBe(true)
  })
})
