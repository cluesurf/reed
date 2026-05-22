// SPDX-License-Identifier: GPL-3.0-or-later

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parse } from '@/parse'
import { ReedParseError } from '@/parse/errors'
import { definePhonology } from '@/api/define-phonology'
import { english } from '@/phonology/english'

describe('parse — phonology validation', () => {
  it('accepts a string with phones in the inventory', () => {
    const out = parse('tap.', { phonology: english })
    expect(out).toHaveLength(1)
    expect(out[0]!.words).toHaveLength(1)
  })

  it('throws by default when a phone is not in inventory', () => {
    // The Talk 'Q' (pharyngeal stop) is not in English.
    expect(() =>
      parse('taQ', { phonology: english }),
    ).toThrow(ReedParseError)
  })

  it('reports the offset of the offending phone in the error', () => {
    try {
      parse('taQ', { phonology: english })
    } catch (err) {
      expect(err).toBeInstanceOf(ReedParseError)
      expect((err as ReedParseError).code).toBe('phone-not-in-phonology')
      expect((err as ReedParseError).offset).toBe(2)
    }
  })

  it('respects onUnknownPhone: "warn"', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const out = parse('taQ', {
        phonology: english,
        onUnknownPhone: 'warn',
      })
      expect(warnSpy).toHaveBeenCalledOnce()
      const phones = out[0]!.words[0]!.syllables.flatMap(s => [
        ...s.onset,
        ...s.nucleus,
        ...s.coda,
      ])
      const q = phones.find(p => p.talk === 'Q')
      expect(q).toBeDefined()
      expect((q?.features as { foreign?: boolean }).foreign).toBe(true)
    } finally {
      warnSpy.mockRestore()
    }
  })

  it('respects onUnknownPhone: "ignore"', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const out = parse('taQ', {
        phonology: english,
        onUnknownPhone: 'ignore',
      })
      expect(warnSpy).not.toHaveBeenCalled()
      expect(out).toHaveLength(1)
    } finally {
      warnSpy.mockRestore()
    }
  })

  it('does not validate when no phonology is passed', () => {
    // 'Q' is fine — no phonology means no validation.
    const out = parse('taQ')
    expect(out).toHaveLength(1)
  })

  it('works with a custom phonology defined inline', () => {
    const tiny = definePhonology({
      name: 'tiny',
      phones: ['t', 'a', 'p'],
    })
    expect(() => parse('tap', { phonology: tiny })).not.toThrow()
    expect(() => parse('tab', { phonology: tiny })).toThrow(ReedParseError)
  })

  it('validates against nuclei and codas, not just onsets', () => {
    const onlyT = definePhonology({ name: 't', phones: ['t', 'a'] })
    // 'k' is in coda — should still be detected as foreign.
    expect(() => parse('tak', { phonology: onlyT })).toThrow(ReedParseError)
  })
})
