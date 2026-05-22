// SPDX-License-Identifier: GPL-3.0-or-later

import type { Phone, SourceSpan, ToneMark } from '@/types/phone'
import { ReedParseError } from '@/parse/errors'
import { deriveFeatures, type ModifierFlags } from '@/parse/features'

/**
 * Lex a Talk ASCII string into a flat phone stream with
 * source offsets. Walks the input character by character,
 * recognizing:
 *
 *   - Base glyphs (single letter or known digraph).
 *   - Modifier marks (`h~`, `^`, `&`, `_`, `!`, `@`, etc.)
 *     attached to the immediately preceding base.
 *   - Tone marks (`+`, `-`, `/`, `\\`, `++`, `--`, etc.)
 *     attached to the immediately preceding vowel.
 *   - Whitespace as a word boundary marker.
 *   - Sentence-terminal punctuation `.`, `?`, `!` as
 *     utterance boundary markers (returned as Token, not
 *     Phone).
 *   - Intra-sentence punctuation `,`, `;`, `:` as a
 *     prosodic-boundary marker.
 *
 * Refuses Talk's Simplified Unicode form (any non-ASCII
 * character outside the explicit allow-list raises
 * `unknown-glyph`). ASCII-only input per the design's
 * locked decision.
 */

export type Token =
  | { kind: 'phone'; phone: Phone }
  | { kind: 'word-boundary'; source: SourceSpan }
  | { kind: 'utterance-end'; terminator: '.' | '?' | '!'; source: SourceSpan }
  | { kind: 'prosodic-boundary'; mark: ',' | ';' | ':'; source: SourceSpan }

export function tokenize(input: string): Token[] {
  if (input.length === 0) {
    throw new ReedParseError({
      code: 'empty-input',
      message: 'parse() received an empty input string',
      offset: 0,
    })
  }

  // Reject Simplified-form characters early. The check is
  // generous: any non-ASCII codepoint is rejected. Talk's
  // ASCII vocabulary is strictly < 0x80.
  for (let i = 0; i < input.length; i += 1) {
    const ch = input.charCodeAt(i)
    if (ch > 0x7f) {
      throw new ReedParseError({
        code: 'simplified-form-rejected',
        message:
          'reed.parse only accepts Talk ASCII; the Simplified Unicode form is not supported. Convert with @cluesurf/talk first.',
        offset: i,
      })
    }
  }

  const tokens: Token[] = []
  let i = 0
  while (i < input.length) {
    const ch = input[i]!

    // Whitespace → word boundary.
    if (WHITESPACE.test(ch)) {
      const start = i
      while (i < input.length && WHITESPACE.test(input[i]!)) i += 1
      // Collapse runs; emit single boundary if not adjacent
      // to an existing boundary.
      const last = tokens[tokens.length - 1]
      if (last == null || last.kind === 'phone') {
        tokens.push({
          kind: 'word-boundary',
          source: { start, end: i },
        })
      }
      continue
    }

    // Sentence terminators.
    if (ch === '.' || ch === '?' || ch === '!') {
      // `!` is ambiguous between sentence-terminal and a
      // consonant modifier (ejective on the preceding
      // consonant). Resolution rule: if the very next
      // character is EOF or whitespace OR another
      // terminator, treat `!` as sentence-final. Otherwise
      // (a letter follows) treat as an ejective modifier
      // on the preceding consonant phone.
      if (ch === '!') {
        const next = input[i + 1]
        const followedByMore =
          next != null && !WHITESPACE.test(next) && next !== '.'
        if (followedByMore) {
          const consumedAsMark = tryConsumeMarkOnPrevious(input, i, tokens)
          if (consumedAsMark > 0) {
            i += consumedAsMark
            continue
          }
        }
      }
      tokens.push({
        kind: 'utterance-end',
        terminator: ch as '.' | '?' | '!',
        source: { start: i, end: i + 1 },
      })
      i += 1
      continue
    }

    // Intra-sentence punctuation.
    if (ch === ',' || ch === ';' || ch === ':') {
      tokens.push({
        kind: 'prosodic-boundary',
        mark: ch as ',' | ';' | ':',
        source: { start: i, end: i + 1 },
      })
      i += 1
      continue
    }

    // Otherwise: try to read a base glyph + its marks.
    const phoneAt = readPhone(input, i)
    if (phoneAt == null) {
      throw new ReedParseError({
        code: 'unknown-glyph',
        message: `unrecognized character ${JSON.stringify(ch)} at offset ${i}`,
        offset: i,
      })
    }
    tokens.push({ kind: 'phone', phone: phoneAt.phone })
    i = phoneAt.endOffset
  }

  return tokens
}

const WHITESPACE = /\s/

/**
 * Try to read a base glyph + attached marks starting at
 * `start`. Returns null when the character doesn't start a
 * known base glyph.
 */

function readPhone(
  input: string,
  start: number,
): { phone: Phone; endOffset: number } | null {
  const baseMatch = readBaseGlyph(input, start)
  if (baseMatch == null) return null

  // Now read modifier marks that follow the base.
  let cursor = baseMatch.endOffset
  const modifiers: ModifierFlags = {}
  while (cursor < input.length) {
    const consumed = applyModifierMarkAt({
      input,
      offset: cursor,
      modifiers,
      isVowel: isVowelGlyph(baseMatch.glyph),
    })
    if (consumed === 0) break
    cursor += consumed
  }

  const features = deriveFeatures({
    glyph: baseMatch.glyph,
    modifiers,
  })

  return {
    phone: {
      talk: baseMatch.glyph,
      raw: input.slice(start, cursor),
      features,
      source: { start, end: cursor },
    },
    endOffset: cursor,
  }
}

/**
 * Read the longest legal Talk base glyph at `start`.
 *
 * Trigraphs are checked first (none currently in the
 * minimal v0 vocabulary), then digraphs (sh, zh, ch, ph,
 * etc. — Talk uses these for postalveolar phonemes), then
 * single characters.
 */

function readBaseGlyph(
  input: string,
  start: number,
): { glyph: string; endOffset: number } | null {
  // Digraphs first.
  const di = input.slice(start, start + 2)
  if (BASE_DIGRAPHS.has(di)) {
    return { glyph: di, endOffset: start + 2 }
  }
  const c = input[start]!
  if (BASE_SINGLES.has(c)) {
    return { glyph: c, endOffset: start + 1 }
  }
  return null
}

/**
 * Talk's real consonant digraphs. NOT included here:
 * 'th', 'dh', 'ph', 'kh', 'gh' — those parse as the base
 * consonant + `h~` (aspiration) per talk.js's mark
 * vocabulary, not as a single digraph. Capital letters
 * (`T`, `D`) cover the dental fricatives instead.
 */

const BASE_DIGRAPHS = new Set([
  'sh', // postalveolar sibilant /ʃ/
  'zh', // postalveolar sibilant /ʒ/
  'ch', // postalveolar affricate /tʃ/
  'tx', // alveolar affricate /ts/
  'dj', // alveolar affricate /dz/
])

const BASE_SINGLES = new Set([
  // Stops + nasals
  'p', 'b', 't', 'd', 'k', 'g',
  'm', 'n', 'q',
  // Bilabial / labiodental fricatives + approximants
  'f', 'v', 'F', 'B', 'V', 'M',
  // Dental + alveolar fricatives
  'T', 'D', 's', 'z',
  // Liquids
  'l', 'r',
  // Palatal series
  'c', 'C', 'J', 'N', 'L', 'Z', 'y',
  // Velar + uvular series
  'w', 'x', 'X', 'G', 'K', 'R',
  // Pharyngeal + glottal
  'h', 'H', 'Q', "'",
  // Voiced affricate (Talk's /dʒ/)
  'j',
  // Vowels.
  'a', 'e', 'i', 'o', 'u',
  'A', 'E', 'I', 'O', 'U',
  '@',
])

function isVowelGlyph(glyph: string): boolean {
  return /^[aeiouAEIOU@]$/.test(glyph)
}

/**
 * Try to consume one modifier mark at `offset`. Updates
 * `modifiers` in place. Returns the number of characters
 * consumed (0 if no mark matched).
 *
 * Modifier marks come in three families:
 *
 *   - Suffix marks bound to consonants: `h!` (voiceless),
 *     `h~` (aspiration), `w~` (labial), `y~` (palatal),
 *     `G~` (velar), `Q~` (pharyngeal). These are two-char
 *     sequences.
 *   - Single-char marks: `^` (stress), `&` (nasal), `_`
 *     (long), `!` (geminated / ejective when on consonant),
 *     `@` (syllabic), `$` (variant), `*` (click — handled
 *     elsewhere), `.` (stop — talk.js internal usage).
 *   - Tone marks on vowels: `+`, `-`, `/`, `\\`. Double
 *     forms (`++`, `--`, `//`, `\\\\`) and compound forms
 *     (`/\\`, `\\/`) are supported.
 */

function applyModifierMarkAt(input: {
  input: string
  offset: number
  modifiers: ModifierFlags
  isVowel: boolean
}): number {
  const { input: src, offset, modifiers, isVowel } = input
  const two = src.slice(offset, offset + 2)

  // Two-char suffix marks on consonants.
  switch (two) {
    case 'h!':
      modifiers.voiceless = true
      return 2
    case 'h~':
      modifiers.aspirated = true
      return 2
    case 'w~':
      modifiers.labialized = true
      return 2
    case 'y~':
      modifiers.palatalized = true
      return 2
    case 'G~':
      modifiers.velarized = true
      return 2
    case 'Q~':
      modifiers.pharyngealized = true
      return 2
    case 'R~':
      modifiers.retroflex = true
      return 2
    case 't~':
    case 'd~':
    case 'n~':
      // Dentalization marks expressed as base + ~.
      // Only valid on the matching consonant; we accept
      // anywhere and consume 1 char (the `~`).
      modifiers.dentalized = true
      return 1
  }

  // Compound tone marks (vowels only).
  if (isVowel) {
    switch (two) {
      case '++':
        modifiers.tone = 'extra-high'
        return 2
      case '--':
        modifiers.tone = 'extra-low'
        return 2
      case '//':
        modifiers.tone = 'rising-2'
        return 2
      case '\\\\':
        modifiers.tone = 'falling-2'
        return 2
      case '/\\':
        modifiers.tone = 'rising-falling'
        return 2
      case '\\/':
        modifiers.tone = 'falling-rising'
        return 2
    }
  }

  // Single-char marks.
  const c = src[offset]
  switch (c) {
    case '^':
      // Accent / stress is captured as a flag on the
      // phone; the syllabification step propagates it to
      // the syllable.
      modifiers.tense = true // placeholder; real stress
      // is read from a different channel in v1.
      return 1
    case '&':
      modifiers.nasalized = true
      return 1
    case '_':
      modifiers.long = true
      return 1
    case '!': {
      // On a vowel, `!` is a short / truncation mark.
      if (isVowel) {
        modifiers.short = true
        return 1
      }
      // On a consonant, `!` is normally ejective. But when
      // followed by EOF, whitespace, or another terminator,
      // it's actually the sentence-final exclamation — don't
      // consume here; let the outer loop handle it.
      const peek = src[offset + 1]
      if (
        peek == null ||
        WHITESPACE.test(peek) ||
        peek === '.' ||
        peek === '?' ||
        peek === '!'
      ) {
        return 0
      }
      modifiers.ejective = true
      return 1
    }
    case '@':
      modifiers.syllabic = true
      return 1
    case '+':
      if (isVowel) {
        modifiers.tone = 'high'
        return 1
      }
      break
    case '-':
      if (isVowel) {
        modifiers.tone = 'low'
        return 1
      }
      break
    case '/':
      if (isVowel) {
        modifiers.tone = 'rising'
        return 1
      }
      break
    case '\\':
      if (isVowel) {
        modifiers.tone = 'falling'
        return 1
      }
      break
  }

  return 0
}

/**
 * Helper for the ambiguous `!` case in `tokenize`. If the
 * previous-emitted token is a consonant phone, treat `!`
 * as an ejective modifier on that phone (append the flag
 * and return 1). Otherwise return 0.
 */

function tryConsumeMarkOnPrevious(
  _input: string,
  _offset: number,
  tokens: Token[],
): number {
  const prev = tokens[tokens.length - 1]
  if (prev == null || prev.kind !== 'phone') return 0
  if (prev.phone.features.kind !== 'consonant') return 0
  prev.phone.features.ejective = true
  prev.phone.raw = prev.phone.raw + '!'
  prev.phone.source = {
    start: prev.phone.source.start,
    end: prev.phone.source.end + 1,
  }
  return 1
}
