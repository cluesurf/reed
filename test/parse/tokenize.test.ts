// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import { tokenize, type Token } from '@/parse/tokenize'
import { ReedParseError } from '@/parse/errors'

describe('tokenize', () => {
  it('emits a phone for a single consonant', () => {
    const tokens = tokenize('t')
    expect(tokens).toHaveLength(1)
    expect(tokens[0]?.kind).toBe('phone')
    const phone = (tokens[0] as Extract<Token, { kind: 'phone' }>).phone
    expect(phone.talk).toBe('t')
    expect(phone.features.kind).toBe('consonant')
    expect(phone.features.site).toBe('alveolar')
    expect(phone.features.mold).toBe('plosive')
    expect(phone.source).toEqual({ start: 0, end: 1 })
  })

  it('emits a phone for a single vowel', () => {
    const tokens = tokenize('a')
    expect(tokens).toHaveLength(1)
    const phone = (tokens[0] as Extract<Token, { kind: 'phone' }>).phone
    expect(phone.features.kind).toBe('vowel')
    expect(phone.features.height).toBe('open')
  })

  it('handles a sequence of phones', () => {
    const tokens = tokenize('tap')
    const phones = tokens
      .filter((t): t is Extract<Token, { kind: 'phone' }> => t.kind === 'phone')
      .map(t => t.phone.talk)
    expect(phones).toEqual(['t', 'a', 'p'])
  })

  it('recognizes Talk digraphs as a single base glyph', () => {
    const tokens = tokenize('shap')
    const phones = tokens
      .filter((t): t is Extract<Token, { kind: 'phone' }> => t.kind === 'phone')
      .map(t => t.phone.talk)
    expect(phones).toEqual(['sh', 'a', 'p'])
  })

  it('attaches a tone mark to the preceding vowel', () => {
    const tokens = tokenize('a+')
    expect(tokens).toHaveLength(1)
    const phone = (tokens[0] as Extract<Token, { kind: 'phone' }>).phone
    expect(phone.features.tone).toBe('high')
    expect(phone.raw).toBe('a+')
    expect(phone.source).toEqual({ start: 0, end: 2 })
  })

  it('recognizes double tone marks', () => {
    const tokens = tokenize('a++')
    const phone = (tokens[0] as Extract<Token, { kind: 'phone' }>).phone
    expect(phone.features.tone).toBe('extra-high')
  })

  it('attaches a nasalization mark', () => {
    const tokens = tokenize('a&')
    const phone = (tokens[0] as Extract<Token, { kind: 'phone' }>).phone
    expect(phone.features.nasalized).toBe(true)
  })

  it('attaches aspiration to a consonant', () => {
    // Talk semantics: `t` base + `h~` aspiration modifier.
    // 'th' is NOT a digraph; capitals like 'T' cover /θ/.
    const tokens = tokenize('th~')
    const phones = tokens.filter(
      (t): t is Extract<Token, { kind: 'phone' }> => t.kind === 'phone',
    )
    expect(phones).toHaveLength(1)
    expect(phones[0]!.phone.talk).toBe('t')
    expect(phones[0]!.phone.features.aspirated).toBe(true)
    expect(phones[0]!.phone.raw).toBe('th~')
  })

  it('handles ejective ! on consonants', () => {
    const tokens = tokenize('t!a')
    const phones = tokens.filter(
      (t): t is Extract<Token, { kind: 'phone' }> => t.kind === 'phone',
    )
    expect(phones[0]!.phone.talk).toBe('t')
    expect(phones[0]!.phone.features.ejective).toBe(true)
    expect(phones[1]!.phone.talk).toBe('a')
  })

  it('emits a word boundary on whitespace', () => {
    const tokens = tokenize('ba ba')
    const kinds = tokens.map(t => t.kind)
    expect(kinds).toEqual([
      'phone',
      'phone',
      'word-boundary',
      'phone',
      'phone',
    ])
  })

  it('collapses runs of whitespace into one boundary', () => {
    const tokens = tokenize('ba   ba')
    const boundaries = tokens.filter(t => t.kind === 'word-boundary')
    expect(boundaries).toHaveLength(1)
  })

  it('emits an utterance-end on `.`', () => {
    const tokens = tokenize('ba.')
    const last = tokens[tokens.length - 1]!
    expect(last.kind).toBe('utterance-end')
    if (last.kind === 'utterance-end') {
      expect(last.terminator).toBe('.')
    }
  })

  it('emits an utterance-end on `?`', () => {
    const tokens = tokenize('ba?')
    const last = tokens[tokens.length - 1]!
    expect(last.kind).toBe('utterance-end')
    if (last.kind === 'utterance-end') {
      expect(last.terminator).toBe('?')
    }
  })

  it('emits a prosodic-boundary on `,`', () => {
    const tokens = tokenize('ba, da')
    const boundary = tokens.find(t => t.kind === 'prosodic-boundary')
    expect(boundary).toBeDefined()
    if (boundary?.kind === 'prosodic-boundary') {
      expect(boundary.mark).toBe(',')
    }
  })

  it('rejects empty input', () => {
    expect(() => tokenize('')).toThrow(ReedParseError)
    try {
      tokenize('')
    } catch (e) {
      expect(e).toBeInstanceOf(ReedParseError)
      expect((e as ReedParseError).code).toBe('empty-input')
    }
  })

  it('rejects non-ASCII (Simplified form)', () => {
    expect(() => tokenize('txandȯ')).toThrow(ReedParseError)
    try {
      tokenize('txandȯ')
    } catch (e) {
      expect((e as ReedParseError).code).toBe('simplified-form-rejected')
    }
  })

  it('reports the offset of an unknown glyph', () => {
    try {
      tokenize('ba#da')
    } catch (e) {
      expect(e).toBeInstanceOf(ReedParseError)
      expect((e as ReedParseError).code).toBe('unknown-glyph')
      expect((e as ReedParseError).offset).toBe(2)
    }
  })

  it('tracks source offsets through marks', () => {
    const tokens = tokenize('a+b')
    const phones = tokens.filter(
      (t): t is Extract<Token, { kind: 'phone' }> => t.kind === 'phone',
    )
    expect(phones[0]!.phone.source).toEqual({ start: 0, end: 2 })
    expect(phones[1]!.phone.source).toEqual({ start: 2, end: 3 })
  })
})
