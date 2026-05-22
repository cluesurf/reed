// SPDX-License-Identifier: GPL-3.0-or-later

import type { Phone, SourceSpan, ToneMark } from '@/types/phone'

/**
 * One syllable of a word. Onset / nucleus / coda follow
 * standard linguistic decomposition.
 *
 * `stress` carries Talk's `^` mark, propagated up from
 * whichever Phone in the syllable bore it. `tone` is the
 * nucleus's tone, if any.
 *
 * `weight` is computed at syllabification time based on
 * the nucleus length + presence of coda. It's used by
 * the prosody layer for stress placement and duration
 * computation.
 */

export type Syllable = {
  onset: Phone[]
  nucleus: Phone[]
  coda: Phone[]
  stress: StressLevel
  tone?: ToneMark
  weight: SyllableWeight
  source: SourceSpan
}

export type StressLevel = 'primary' | 'secondary' | null

export type SyllableWeight = 'light' | 'heavy' | 'superheavy'

/**
 * A word — one or more syllables bounded by whitespace
 * (or, eventually, by word-boundary phonological rules).
 *
 * `trailingPunctuation` holds intra-utterance punctuation
 * that attaches to the end of this word (',', ';', ':').
 * Terminal punctuation ('.', '?', '!') doesn't appear
 * here; it closes the parent `Utterance` instead.
 */

export type Word = {
  syllables: Syllable[]
  trailingPunctuation?: string
  source: SourceSpan
}

/**
 * A complete prosodic unit terminated by sentence-final
 * punctuation. Reed's prosody system reads `intonation`
 * to pick the right f0 contour template.
 */

export type Utterance = {
  words: Word[]
  intonation: Intonation
  source: SourceSpan
}

export type Intonation = 'declarative' | 'interrogative' | 'exclamative'
