// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import { parse } from '@/parse'

describe('parse', () => {
  it('parses a single word as one declarative utterance', () => {
    const out = parse('tap')
    expect(out).toHaveLength(1)
    expect(out[0]!.intonation).toBe('declarative')
    expect(out[0]!.words).toHaveLength(1)
    expect(out[0]!.words[0]!.syllables).toHaveLength(1)
  })

  it('parses two words separated by whitespace', () => {
    const out = parse('tap pat')
    expect(out).toHaveLength(1)
    expect(out[0]!.words).toHaveLength(2)
  })

  it('splits utterances on a period', () => {
    const out = parse('tap. pat.')
    expect(out).toHaveLength(2)
    expect(out[0]!.intonation).toBe('declarative')
    expect(out[1]!.intonation).toBe('declarative')
  })

  it('marks an utterance as interrogative on `?`', () => {
    const out = parse('tap?')
    expect(out[0]!.intonation).toBe('interrogative')
  })

  it('marks an utterance as exclamative on `!` at end', () => {
    const out = parse('tap !')
    // Trailing `!` after whitespace and EOF is sentence-
    // terminal (not an ejective on the previous phone,
    // since whitespace breaks the binding).
    expect(out).toHaveLength(1)
    expect(out[0]!.intonation).toBe('exclamative')
  })

  it('attaches a comma as trailing punctuation on the preceding word', () => {
    const out = parse('tap, pat')
    expect(out[0]!.words[0]!.trailingPunctuation).toBe(',')
    expect(out[0]!.words[1]!.trailingPunctuation).toBeUndefined()
  })

  it('tracks source spans through the whole pipeline', () => {
    const out = parse('tap pat.')
    expect(out[0]!.words[0]!.source.start).toBe(0)
    expect(out[0]!.words[0]!.source.end).toBe(3)
    expect(out[0]!.words[1]!.source.start).toBe(4)
    expect(out[0]!.words[1]!.source.end).toBe(7)
    expect(out[0]!.source.end).toBe(8)
  })

  it('handles a vowel-marked word', () => {
    const out = parse('ba+')
    const word = out[0]!.words[0]!
    const nucleus = word.syllables[0]!.nucleus[0]!
    expect(nucleus.features.tone).toBe('high')
  })

  it('parses a multi-syllable word with MOP', () => {
    const out = parse('tapa')
    expect(out[0]!.words[0]!.syllables).toHaveLength(2)
    const [s1, s2] = out[0]!.words[0]!.syllables
    expect(s1!.onset.map(p => p.talk)).toEqual(['t'])
    expect(s1!.nucleus.map(p => p.talk)).toEqual(['a'])
    expect(s2!.onset.map(p => p.talk)).toEqual(['p'])
    expect(s2!.nucleus.map(p => p.talk)).toEqual(['a'])
  })

  it('handles three sentences', () => {
    const out = parse('tap. pat? bap!')
    expect(out).toHaveLength(3)
    expect(out.map(u => u.intonation)).toEqual([
      'declarative',
      'interrogative',
      'exclamative',
    ])
  })

  it('handles a Talk digraph word', () => {
    const out = parse('sha')
    const phones = out[0]!.words[0]!.syllables[0]!
    expect(phones.onset.map(p => p.talk)).toEqual(['sh'])
    expect(phones.nucleus.map(p => p.talk)).toEqual(['a'])
  })
})
